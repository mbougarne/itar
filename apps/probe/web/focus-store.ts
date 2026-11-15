import type {
  FocusOutcome,
  FocusRequest,
  FocusState,
} from '../../../packages/itar/src/api/types';
import type { EngineEffect, EngineNode, WebEngine } from './engine-types';

export type Registration = EngineNode & {
  element?: HTMLElement;
  publicKey?: string;
  adjust?: (delta: -1 | 1) => void;
};

type Collection = {
  nodes: Registration[];
  reveal(key: string): boolean;
  release?(key: string): void;
};

type Pending = {
  resolve(value: FocusOutcome): void;
  command: string;
  timer: ReturnType<typeof setTimeout>;
};

const unknown: FocusState = {
  kind: 'unknown',
  occurrenceKey: null,
  lifetime: null,
  mount: null,
};

const kinds = ['managed', 'unmanaged', 'absent', 'unknown'] as const;
let nextLifetime = 0;

export let directionalNavigationEnabled = true;

const ownershipListeners = new Set<() => void>();

export function setDirectionalNavigationEnabled(enabled: boolean) {
  directionalNavigationEnabled = enabled;

  if (!enabled) {
    ownershipListeners.forEach(listener => listener());
  }
}

// The host owns DOM effects and measurements. All destination policy stays in Wasm.
export class WebFocusStore {
  readonly lifetime = String(++nextLifetime);
  private records = new Map<string, Registration>();
  private collections = new Map<object, Collection>();
  private visibilityChecks = new Map<object, () => void>();
  private listeners = new Set<() => void>();
  private pending = new Map<number, Pending>();
  private reveals = new Map<number, EngineEffect & { release(): void }>();
  private input: FocusState = unknown;
  private accessibility: FocusState = unknown;
  private queued = false;
  private running = false;
  private dispatching = 0;
  private live = true;
  private enabled = true;
  private serial = 0;
  private intentRevision = 0;
  private directionalTimer?: ReturnType<typeof setTimeout>;
  private timedRequest = 0;
  private relinquish = () => {
    if (!this.live) {
      return;
    }

    const request = this.engine.snapshot().activeRequest;

    if (request) {
      this.engine.cancel(request);
      this.finish(request, 'cancelled', 'ownership-changed');
    }

    this.engine.release();
    this.pump();
    this.observe(this.activeElement());
  };

  private activeElement: () => Element | null;
  constructor(
    readonly engine: WebEngine,
    activeElement = () => document.activeElement,
  ) {
    this.activeElement = activeElement;
    ownershipListeners.add(this.relinquish);
  }

  mountId = () => ++this.serial;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  };

  snapshot = () => this.input;
  accessibilitySnapshot = () => this.accessibility;
  available = () => this.live && this.enabled;
  setEnabled(enabled: boolean) {
    this.enabled = enabled;
    this.schedule();
  }

  get(key: string) {
    return this.records.get(key);
  }

  register(record: Registration) {
    if (this.records.has(record.key)) {
      throw new Error(`Duplicate web focus key: ${record.key}`);
    }

    this.records.set(record.key, record);
    this.schedule();

    return () => {
      if (this.records.get(record.key) !== record) {
        return;
      }

      if (this.live && record.mount) {
        this.engine.detach(record.key, record.mount);
      }

      this.records.delete(record.key);
      this.schedule();
    };
  }

  update(record: Registration, value: Partial<Registration>) {
    Object.assign(record, value);
    this.schedule();
  }

  canAlign() {
    return (
      this.available() &&
      directionalNavigationEnabled &&
      !this.engine.snapshot().activeRequest
    );
  }

  collection(token: object, collection: Collection) {
    const element = this.activeElement();

    const target = [...this.records.values()].find(
      node => node.element === element,
    );

    const intent = this.intentRevision;

    this.collections.set(token, collection);
    this.schedule();

    // A retained pagination target can move without another focus effect.
    if (target && this.engine.snapshot().inputKey === target.key) {
      this.visibilityChecks.set(token, () => {
        if (
          !this.available() ||
          !directionalNavigationEnabled ||
          intent !== this.intentRevision ||
          this.collections.get(token) !== collection ||
          this.activeElement() !== element ||
          target.element !== element ||
          this.records.get(target.key) !== target ||
          !target.active ||
          !target.enabled ||
          !target.element?.isConnected ||
          this.engine.snapshot().activeRequest ||
          !collection.nodes.some(
            node => node.key === target.key && node.active && node.enabled,
          )
        ) {
          return;
        }

        target.element.scrollIntoView({
          block: 'nearest',
          inline: 'nearest',
          behavior: 'auto',
        });
      });
    }
  }

  removeCollection(token: object) {
    this.visibilityChecks.delete(token);
    this.collections.delete(token);
    this.schedule();
  }

  private retireReveal(id: number) {
    const reveal = this.reveals.get(id);

    this.reveals.delete(id);
    reveal?.release();
  }

  private schedule() {
    if (this.queued || !this.live) {
      return;
    }

    this.queued = true;

    queueMicrotask(() => {
      this.queued = false;

      if (this.live) {
        this.flush();
        this.pump();

        const checks = [...this.visibilityChecks.values()];

        this.visibilityChecks.clear();
        checks.forEach(check => check());
      }
    });
  }

  flush() {
    if (!this.live) {
      return;
    }

    this.engine.advance(performance.now());

    const nodes = new Map<string, Registration>();

    for (const collection of this.collections.values()) {
      for (const node of collection.nodes) {
        nodes.set(node.key, node);
      }
    }

    for (const record of this.records.values()) {
      const rect = record.element?.getBoundingClientRect();

      const mounted =
        !!record.element?.isConnected &&
        !!rect &&
        rect.width > 0 &&
        rect.height > 0;

      nodes.set(record.key, {
        ...record,
        order: nodes.get(record.key)?.order ?? record.order,
        collection: nodes.get(record.key)?.collection,
        extent: nodes.get(record.key)?.extent,
        rowEntry: nodes.get(record.key)?.rowEntry,
        horizontalAlignment: nodes.get(record.key)?.horizontalAlignment,
        mounted,
        active: this.enabled && record.active,
        x: rect?.x ?? 0,
        y: rect?.y ?? 0,
        width: rect?.width ?? 0,
        height: rect?.height ?? 0,
      });
    }

    // Ancestors are registered before descendants even though React effects run child-first.
    const ordered: Registration[] = [];

    const visit = (node: Registration) => {
      if (ordered.some(value => value.key === node.key)) {
        return;
      }

      const parent = nodes.get(node.parent);

      if (parent) {
        visit(parent);
      }

      ordered.push({ ...node, active: this.enabled && node.active });
    };

    nodes.forEach(visit);

    const status = this.engine.sync(ordered);

    if (status !== 0) {
      throw new Error(`Web focus snapshot rejected (${status})`);
    }

    for (const [id, effect] of this.reveals) {
      const node = this.records.get(effect.key);

      if (
        node?.element?.isConnected &&
        node.element.getBoundingClientRect().width > 0
      ) {
        const result = this.engine.realize(id, effect.key, node.mount);

        if (result.status === 0) {
          this.retireReveal(id);
        } else if (result.status !== 16) {
          this.retireReveal(id);
          this.engine.complete(id, 1);
          this.finish(effect.request, 'unavailable', 'stale-reveal');
        }
      }
    }

    this.publish();
  }

  observe(element: Element | null, effect = 0) {
    if (!this.live) {
      return;
    }

    const node = [...this.records.values()].find(
      value => value.element === element,
    );

    const result = node
      ? this.engine.observe(node.key, node.mount, 0, effect || this.dispatching)
      : element && element !== document.body
      ? this.engine.unmanaged(0)
      : this.engine.observe('', 0, 0, 0);

    if (result.status === 8 && result.request) {
      this.finish(result.request, 'applied', 'confirmed');
    }

    this.publish();
  }

  direction(direction: number) {
    if (!this.available() || !directionalNavigationEnabled) {
      return;
    }

    this.flush();
    this.observe(this.activeElement());
    this.engine.advance(performance.now());

    const source = [...this.records.values()].find(
      value => value.element === this.activeElement(),
    );

    if (!source || !source.active || !source.enabled) {
      return;
    }

    this.intentRevision++;

    if (source.adjust && direction < 2) {
      source.adjust(direction === 0 ? -1 : 1);

      return;
    }

    const result = this.engine.direction(direction, 0);

    if (result.request && result.request !== this.timedRequest) {
      clearTimeout(this.directionalTimer);
      this.timedRequest = result.request;

      this.directionalTimer = setTimeout(() => {
        if (this.live) {
          this.engine.advance(performance.now());
          this.pump();
        }
      }, 1010);
    }

    this.pump();
  }

  request(key: string, restore = false): FocusRequest {
    this.intentRevision++;

    const command = String(++this.serial);
    let request = 0;
    let cancelled = false;
    let settle!: (value: FocusOutcome) => void;

    const result = new Promise<FocusOutcome>(resolve => {
      settle = resolve;
    });

    // React finishes the full commit before command selection and geometry capture.
    queueMicrotask(() => {
      if (cancelled || !this.available()) {
        settle({
          status: cancelled ? 'cancelled' : 'unavailable',
          reason: 'inactive',
          command,
          request: null,
          lifetime: this.lifetime,
        });

        return;
      }

      this.flush();
      this.observe(this.activeElement());
      this.engine.advance(performance.now());

      const started = restore
        ? this.engine.restore(key)
        : this.engine.focus(key, 0);

      request = started.request;

      if (!request || started.status !== 0) {
        settle({
          status: started.status === 8 ? 'applied' : 'unavailable',
          reason: 'selection',
          command,
          request: request ? String(request) : null,
          lifetime: this.lifetime,
        });

        return;
      }

      const timer = setTimeout(() => {
        if (!this.live) {
          return;
        }

        this.engine.advance(performance.now());
        this.pump();
        this.finish(request, 'unavailable', 'deadline');
      }, 1010);

      this.pending.set(request, { resolve: settle, command, timer });
      this.pump();
    });

    return {
      command,
      result,
      cancel: () => {
        cancelled = true;

        if (request && this.live) {
          this.engine.cancel(request);
          this.finish(request, 'cancelled', 'cancelled');
          this.pump();
        }
      },
    };
  }

  private finish(
    request: number,
    status: FocusOutcome['status'],
    reason: string,
  ) {
    const pending = this.pending.get(request);

    if (!pending) {
      return;
    }

    clearTimeout(pending.timer);
    this.pending.delete(request);

    pending.resolve({
      status,
      reason,
      command: pending.command,
      request: String(request),
      lifetime: this.lifetime,
    });
  }

  private pump() {
    if (!this.live || this.running) {
      return;
    }

    this.running = true;

    try {
      for (let turn = 0; turn < 32; turn++) {
        const effects = this.engine.drain();

        if (!effects.length) {
          break;
        }

        for (const effect of effects) {
          if (this.engine.issue(effect.id).status !== 15) {
            continue;
          }

          if (effect.kind === 2) {
            this.retireReveal(effect.cancels);
            this.engine.complete(effect.id, 3);

            continue;
          }

          if (effect.kind === 0) {
            const owner = [...this.collections.values()].find(value =>
              value.nodes.some(node => node.key === effect.key),
            );

            if (owner?.reveal(effect.key)) {
              this.reveals.set(effect.id, {
                ...effect,
                release: () => owner.release?.(effect.key),
              });

              this.schedule();
            } else {
              this.engine.complete(effect.id, 1);
              this.finish(effect.request, 'unavailable', 'unrealized');
            }

            continue;
          }

          const target = this.records.get(effect.key);

          if (
            !target?.element?.isConnected ||
            target.mount !== effect.mount ||
            !target.enabled ||
            !target.active
          ) {
            this.engine.complete(effect.id, 1);
            this.finish(effect.request, 'unavailable', 'stale-target');

            continue;
          }

          this.dispatching = effect.id;

          try {
            target.element.focus({ preventScroll: true });
          } finally {
            this.dispatching = 0;
          }

          this.observe(this.activeElement(), effect.id);

          const confirmed = this.activeElement() === target.element;

          if (confirmed) {
            target.element.scrollIntoView({
              block: 'nearest',
              inline: 'nearest',
              behavior: 'auto',
            });
          }

          this.engine.complete(effect.id, confirmed ? 2 : 1);

          if (!confirmed) {
            this.finish(effect.request, 'unavailable', 'host-rejected');
          }
        }
      }

      this.publish();
    } finally {
      this.running = false;
    }
  }

  private publish() {
    const current = this.engine.snapshot();

    const state = (channel: 'input' | 'a11y'): FocusState => {
      const node = this.records.get(current[`${channel}Key`]);

      return {
        kind: kinds[current[`${channel}Kind`]] ?? 'unknown',
        occurrenceKey: node?.publicKey ?? null,
        lifetime: this.lifetime,
        mount: node?.mount ? String(node.mount) : null,
      };
    };

    const input = state('input'),
      accessibility = state('a11y');

    if (
      JSON.stringify(input) !== JSON.stringify(this.input) ||
      JSON.stringify(accessibility) !== JSON.stringify(this.accessibility)
    ) {
      this.input = input;
      this.accessibility = accessibility;
      this.listeners.forEach(listener => listener());
    }
  }

  dispose() {
    if (!this.live) {
      return;
    }

    this.live = false;
    clearTimeout(this.directionalTimer);
    ownershipListeners.delete(this.relinquish);

    for (const id of this.pending.keys()) {
      this.finish(id, 'cancelled', 'disposed');
    }

    this.reveals.clear();
    this.visibilityChecks.clear();
    this.engine.delete();
    this.listeners.clear();
  }
}

export function createNode(
  key: string,
  parent: string,
  scope = false,
): Registration {
  return {
    key,
    parent,
    scope,
    active: true,
    enabled: true,
    mounted: false,
    mount: 0,
    order: 0,
    layout: 0,
    boundary: 2,
    trap: false,
    entryReady: true,
    restoreOnEntry: false,
    preferredKey: '',
    x: 0,
    y: 0,
    width: 0,
    height: 0,
  };
}
