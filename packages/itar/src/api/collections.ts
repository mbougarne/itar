import {decimal, newer} from './types';
import type {SurfaceRecord} from './types';

export type CollectionNode = Readonly<{key: string; parent: string; order: number; scope: boolean;
  // A host-only offset rule for one leading row; the core still owns ordering.
  enabled: boolean; layout: number; extent: number; leadingExtent?: number; rowEntry?: 0 | 1 | 2; horizontalAlignment?: 'nearest' | 'leading' | 'pinned'}>;
export type CollectionStep = Readonly<{collection: string; key: string; index: number}>;
export type Preparation = Readonly<{lifetime: string; request: string; effect: string; dataset: string;
  step: number; key: string; path: readonly CollectionStep[]; source: readonly CollectionStep[]}>;
type Snapshot = Readonly<{data: string; dataset: string; accepted: string; preparation: Preparation | null; rejected: boolean}>;
type Record = Readonly<{provider: string; lifetime: string; sequence: string; payload: string}>;
const object = (value: unknown): value is {[key: string]: unknown} => typeof value === 'object' && value !== null && !Array.isArray(value);
const identity = (value: unknown): value is string => typeof value === 'string' && decimal(value) && value !== '0';

// One declared collection tree per surface. JS publishes data and bounded render
// regions; navigation, deadlines, scrolling and confirmation remain native.
export class CollectionStore {
  private listeners = new Set<() => void>();
  private value: Snapshot = Object.freeze({data: '', dataset: '0', accepted: '0', preparation: null, rejected: false});
  private revision = 0;
  private owner: object | null = null;
  private nodes: readonly CollectionNode[] = [];
  private lifetime = '';
  private sequence = '0';
  private connected = false;
  constructor(private provider: string, private acknowledge: (payload: string) => void) {}
  subscribe = (listener: () => void): (() => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  snapshot = (): Snapshot => this.value;
  private update(value: Snapshot) { this.value = Object.freeze(value); this.listeners.forEach(listener => listener()); }
  publish(owner: object, nodes: readonly CollectionNode[]): string {
    if (this.owner && this.owner !== owner) { throw new Error('Use one virtualized collection tree per FocusProvider'); }
    if (nodes.length > 256) { throw new Error('A virtualized collection supports at most 256 logical nodes'); }
    const keys = new Set<string>();
    for (const node of nodes) {
      if (!node.key || keys.has(node.key)) { throw new Error('Collection occurrence keys must be unique across the surface'); }
      if ((node.rowEntry !== undefined && node.rowEntry !== 0 && node.rowEntry !== 1 && node.rowEntry !== 2) ||
          ((node.rowEntry === 1 || node.rowEntry === 2) && (!node.scope || node.layout !== 2 || nodes.some(parent => parent.key === node.parent)))) {
        throw new Error('Collection row entry requires nearest (0), first (1) or remembered (2) on an outer column');
      }
      if (node.horizontalAlignment !== undefined && (!node.scope || node.layout !== 1 ||
          (node.horizontalAlignment !== 'nearest' && node.horizontalAlignment !== 'leading' && node.horizontalAlignment !== 'pinned'))) {
        throw new Error('Horizontal alignment requires nearest, leading or pinned on a row');
      }
      if (node.leadingExtent !== undefined && (!node.scope || !Number.isFinite(node.leadingExtent) ||
          node.leadingExtent < 0 || node.leadingExtent > 1000000)) {
        throw new Error('A collection leading extent must be finite and within 0–1000000');
      }
      keys.add(node.key);
    }
    if (!Number.isSafeInteger(this.revision + 1)) { throw new Error('Collection dataset revision exhausted'); }
    this.owner = owner; this.nodes = nodes;
    const dataset = String(++this.revision);
    this.update({...this.value, data: JSON.stringify({dataset, nodes}), dataset, preparation: null, rejected: false});
    return dataset;
  }
  remove(owner: object) {
    if (this.owner !== owner) { return; }
    this.publish(owner, []); this.owner = null;
  }
  surface(record: SurfaceRecord) {
    if (record.provider !== this.provider || !identity(record.lifetime) || !decimal(record.sequence) ||
        (record.state !== 'ready' && record.state !== 'disposed')) { return; }
    if (record.lifetime === this.lifetime && !newer(record.sequence, this.sequence)) { return; }
    if (this.lifetime && record.lifetime !== this.lifetime && !newer(record.lifetime, this.lifetime)) { return; }
    this.lifetime = record.lifetime; this.sequence = record.sequence;
    this.connected = record.state === 'ready';
    this.update({...this.value, accepted: '0', preparation: null});
  }
  record(record: Record) {
    if (!this.connected || record.provider !== this.provider || record.lifetime !== this.lifetime || !decimal(record.sequence) ||
        !newer(record.sequence, this.sequence) || record.payload.length > 16384) { return; }
    this.sequence = record.sequence;
    let value: unknown;
    try { value = JSON.parse(record.payload); } catch { return; }
    if (!object(value)) { return; }
    if (value.state === 'catalog' && value.dataset === this.value.dataset) {
      this.update({...this.value, accepted: value.dataset, rejected: false}); return;
    }
    if (value.state === 'rejected' && (value.dataset === undefined || value.dataset === this.value.dataset)) {
      this.update({...this.value, preparation: null, rejected: true}); return;
    }
    if (value.state === 'release') {
      const preparation = this.value.preparation;
      if (preparation && value.request === preparation.request && value.effect === preparation.effect) {
        this.update({...this.value, preparation: null});
      }
      return;
    }
    const steps = (list: unknown): list is CollectionStep[] => Array.isArray(list) && list.length <= 2 &&
      list.every(item => object(item) && typeof item.collection === 'string' && typeof item.key === 'string' &&
        typeof item.index === 'number' && Number.isInteger(item.index) && item.index >= 0 &&
        this.nodes.some(node => node.parent === item.collection && node.key === item.key && node.order === item.index));
    if (value.state !== 'prepare' || value.dataset !== this.value.accepted || value.dataset !== this.value.dataset ||
        !identity(value.request) || !identity(value.effect) || !steps(value.path) || !steps(value.source) ||
        typeof value.step !== 'number' || !Number.isInteger(value.step) || value.step < 0 || value.step >= value.path.length ||
        value.key !== value.path[value.step].key) { return; }
    const preparation: Preparation = {lifetime: record.lifetime, request: value.request, effect: value.effect,
      dataset: value.dataset, step: value.step, key: value.path[value.step].key, path: value.path, source: value.source};
    this.update({...this.value, preparation});
  }
  regions(collection: string): {first: number; last: number}[] {
    const preparation = this.value.preparation;
    if (!preparation) { return []; }
    const indices = new Set([...preparation.path, ...preparation.source].filter(item => item.collection === collection).map(item => item.index));
    return [...indices].sort((a, b) => a - b).map(index => ({first: index, last: index}));
  }
  committed(preparation: Preparation, key: string) {
    if (this.value.preparation !== preparation || key !== preparation.key || this.value.accepted !== preparation.dataset) { return; }
    const {lifetime, request, effect, dataset, step} = preparation;
    this.acknowledge(JSON.stringify({lifetime, request, effect, dataset, step, key}));
  }
}
