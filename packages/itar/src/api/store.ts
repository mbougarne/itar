import {decimal, nativeScopeKey, nativeTargetKey, newer, publicTargetKey} from './types';
import type {Activation, ActivationRecord, FocusChannel, FocusKind, FocusOutcome, FocusRecord,
  FocusRequest, FocusState, RequestRecord, SurfaceRecord} from './types';

type Listener = () => void;
type Transport = {
  focus(key: string, command: string): void;
  restore(scope: string, command: string): void;
  cancel(command: string): void;
  showDialog(): void;
  dismissDialog(): void;
};
type Pending = {resolve(value: FocusOutcome): void; request: string | null};
const unknown: FocusState = Object.freeze({kind: 'unknown', occurrenceKey: null, lifetime: null, mount: null});
let providerSequence = 0;

// One store per committed provider, containing observations and promise routing.
// Navigation policy and native registration never run here.
export class FocusStore {
  readonly provider: string;
  private active = false;
  private connected = false;
  private enabled = true;
  private lifetime: string | null = null;
  private lifecycleSequence = '0';
  private retiredLifetime = false;
  private registrationSequence = 0;
  private commandSequence = 0;
  private pending = new Map<string, Pending>();
  private states: Record<FocusChannel, FocusState> = {input: unknown, accessibility: unknown};
  private sequences: Record<FocusChannel, string> = {input: '0', accessibility: '0'};
  private listeners: Record<FocusChannel, Set<Listener>> = {input: new Set(), accessibility: new Set()};
  private keyed: Record<FocusChannel, Map<string, Set<Listener>>> = {input: new Map(), accessibility: new Map()};
  private targets = new Map<string, {token: object; registration: string; enabled: boolean; active: boolean}>();
  private activations = new Map<string, {mount: string; sequence: string}>();
  private statusListeners = new Set<Listener>();
  constructor(private transport: Transport, private supported = true) {
    if (!Number.isSafeInteger(++providerSequence)) { throw new Error('Provider identity exhausted'); }
    this.provider = `itar:${providerSequence}`;
  }
  activate(): void { this.active = true; this.statusListeners.forEach(listener => listener()); }
  setEnabled(value: boolean): void { this.enabled = value; this.statusListeners.forEach(listener => listener()); }
  deactivate(): void {
    this.active = false;
    for (const command of this.pending.keys()) {
      try { this.transport.cancel(command); } catch { this.finish(command, 'unavailable', 'native_unavailable'); }
    }
    this.finishAll('disposed');
    this.statusListeners.forEach(listener => listener());
  }
  private finish(command: string, status: FocusOutcome['status'], reason: string): void {
    const pending = this.pending.get(command);
    if (!pending) { return; }
    this.pending.delete(command);
    pending.resolve({status, reason, command, request: pending.request, lifetime: this.lifetime});
  }
  private finishAll(reason: string): void {
    for (const command of this.pending.keys()) { this.finish(command, 'unavailable', reason); }
  }
  private accepts(record: {provider: string; lifetime: string}): boolean {
    return this.active && record.provider === this.provider && decimal(record.lifetime) && record.lifetime === this.lifetime;
  }
  surface(record: SurfaceRecord): void {
    if (!this.active || record.provider !== this.provider || !decimal(record.lifetime) || !decimal(record.sequence)) { return; }
    if (this.lifetime !== null && record.lifetime !== this.lifetime && !newer(record.lifetime, this.lifetime)) { return; }
    if (record.lifetime === this.lifetime && !newer(record.sequence, this.lifecycleSequence)) { return; }
    if (record.state !== 'ready' && record.state !== 'disposed') { return; }
    if (record.lifetime === this.lifetime && this.retiredLifetime && record.state === 'ready') { return; }
    if (record.lifetime !== this.lifetime) {
      this.finishAll('replaced');
      this.lifetime = record.lifetime;
      this.retiredLifetime = false;
      this.sequences = {input: '0', accessibility: '0'};
      this.activations.clear();
      this.publish('input', unknown);
      this.publish('accessibility', unknown);
    }
    this.lifecycleSequence = record.sequence;
    if (record.state === 'ready') {
      this.connected = true;
    } else if (record.state === 'disposed' && record.lifetime === this.lifetime) {
      this.retiredLifetime = true;
      this.connected = false;
      this.finishAll('disposed');
      this.publish('input', unknown);
      this.publish('accessibility', unknown);
    }
    this.statusListeners.forEach(listener => listener());
  }
  focus(record: FocusRecord): void {
    if (!this.accepts(record) || !this.connected || !decimal(record.sequence)) { return; }
    if (record.channel !== 'input' && record.channel !== 'accessibility') { return; }
    const channel = record.channel;
    if (!newer(record.sequence, this.sequences[channel])) { return; }
    if (!['managed', 'unmanaged', 'absent', 'unknown'].includes(record.kind)) { return; }
    const key = record.kind === 'managed' ? publicTargetKey(record.occurrenceKey) : null;
    if (record.kind === 'managed' && (key === null || !decimal(record.mount))) { return; }
    this.sequences[channel] = record.sequence;
    this.publish(channel, {kind: record.kind as FocusKind, occurrenceKey: key,
      lifetime: record.lifetime, mount: key === null ? null : record.mount});
  }
  receipt(record: RequestRecord): void {
    if (!this.accepts(record) || !decimal(record.sequence) || !decimal(record.request, true)) { return; }
    const pending = this.pending.get(record.command);
    if (!pending) { return; }
    if (pending.request !== null && record.request !== '0' && pending.request !== record.request) { return; }
    if (record.request !== '0') { pending.request = record.request; }
    if (record.status === 'confirmed' && record.request !== '0') { this.finish(record.command, 'applied', 'confirmed'); }
    else if (record.status === 'cancelled') { this.finish(record.command, 'cancelled', 'cancelled'); }
    else if (['unavailable', 'stale', 'invalid', 'reconciled', 'expired', 'exhausted', 'resync', 'disposed'].includes(record.status)) {
      this.finish(record.command, 'unavailable', record.status);
    }
  }
  request(key: string): FocusRequest {
    return this.start(key, false);
  }
  restore(path: readonly string[]): FocusRequest { return this.start(nativeScopeKey(path), true); }
  private start(key: string, scope: boolean): FocusRequest {
    const command = String(++this.commandSequence);
    let resolve: (value: FocusOutcome) => void = () => {};
    const result = new Promise<FocusOutcome>(done => { resolve = done; });
    const request = {command, result, cancel: () => {
      if (this.pending.has(command)) {
        try { this.transport.cancel(command); } catch { this.finish(command, 'unsupported', 'native_unavailable'); }
      }
    }};
    const target = scope ? undefined : this.targets.get(key);
    const reason = !this.supported ? 'runtime' : !this.active || !this.connected ? 'not_ready' :
      !this.enabled || target?.active === false ? 'inactive' : target?.enabled === false ? 'disabled' :
      this.pending.size >= 32 || !Number.isSafeInteger(this.commandSequence) ? 'capacity' : null;
    if (reason !== null) {
      resolve({status: this.supported ? 'unavailable' : 'unsupported', reason, command, request: null, lifetime: this.lifetime});
      return request;
    }
    this.pending.set(command, {resolve, request: null});
    try {
      if (scope) { this.transport.restore(key, command); }
      else { this.transport.focus(nativeTargetKey(key), command); }
    }
    catch { this.finish(command, 'unsupported', 'native_unavailable'); }
    return request;
  }
  showDialog(): void { if (this.active && this.connected && this.enabled) { this.transport.showDialog(); } }
  dismissDialog(): void { if (this.active && this.connected) { this.transport.dismissDialog(); } }
  registrationId(): string {
    if (!Number.isSafeInteger(++this.registrationSequence)) { throw new Error('Registration identity exhausted'); }
    return `${this.provider}:${this.registrationSequence}`;
  }
  register(key: string, token: object, registration: string, enabled: boolean, active: boolean): () => void {
    const old = this.targets.get(key);
    if (old && old.token !== token) { throw new Error('Duplicate focus occurrence key'); }
    this.targets.set(key, {token, registration, enabled, active});
    return () => {
      if (this.targets.get(key)?.token === token) { this.targets.delete(key); this.activations.delete(key); }
    };
  }
  updateTarget(key: string, token: object, enabled: boolean, active: boolean): void {
    const target = this.targets.get(key);
    if (target?.token === token) { this.targets.set(key, {...target, enabled, active}); }
  }
  activation(record: ActivationRecord, key: string, token: object): Activation | null {
    const target = this.targets.get(key);
    if (!this.accepts(record) || !this.connected || !this.enabled || !target || target.token !== token || !target.enabled || !target.active ||
      record.registration !== target.registration || publicTargetKey(record.occurrenceKey) !== key || !decimal(record.mount) || !decimal(record.sequence) ||
      !['input', 'accessibility', 'semantic'].includes(record.source)) { return null; }
    const previous = this.activations.get(key);
    if (previous && (record.mount === previous.mount ? !newer(record.sequence, previous.sequence) : !newer(record.mount, previous.mount))) { return null; }
    this.activations.set(key, {mount: record.mount, sequence: record.sequence});
    return {occurrenceKey: key, lifetime: record.lifetime, mount: record.mount, sequence: record.sequence,
      source: record.source as Activation['source']};
  }
  snapshot(channel: FocusChannel): FocusState { return this.states[channel]; }
  ready(): boolean { return this.active && this.connected && this.enabled && this.supported; }
  subscribeStatus(listener: Listener): () => void {
    this.statusListeners.add(listener);
    return () => { this.statusListeners.delete(listener); };
  }
  isFocused(key: string, channel: FocusChannel): boolean { return this.states[channel].kind === 'managed' && this.states[channel].occurrenceKey === key; }
  subscribe(channel: FocusChannel, listener: Listener, key?: string): () => void {
    if (key === undefined) { this.listeners[channel].add(listener); return () => { this.listeners[channel].delete(listener); }; }
    let listeners = this.keyed[channel].get(key);
    if (!listeners) { listeners = new Set(); this.keyed[channel].set(key, listeners); }
    listeners.add(listener);
    return () => {
      listeners?.delete(listener);
      if (listeners?.size === 0) { this.keyed[channel].delete(key); }
    };
  }
  private publish(channel: FocusChannel, state: FocusState): void {
    const previous = this.states[channel];
    if (previous.kind === state.kind && previous.occurrenceKey === state.occurrenceKey &&
      previous.mount === state.mount && previous.lifetime === state.lifetime) { return; }
    this.states[channel] = state;
    this.listeners[channel].forEach(listener => listener());
    for (const key of new Set([previous.occurrenceKey, state.occurrenceKey])) {
      if (key !== null) { this.keyed[channel].get(key)?.forEach(listener => listener()); }
    }
  }
}
