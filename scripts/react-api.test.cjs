const assert = require('node:assert/strict');
const {test} = require('node:test');
const {FocusStore} = require('../packages/itar/lib/api/store');
const {nativeTargetKey, occurrenceKey} = require('../packages/itar/lib/api/types');

function fixture(supported = true) {
  const calls = [];
  const store = new FocusStore({
    focus: (key, command) => calls.push({kind: 'focus', key, command}),
    restore: (key, command) => calls.push({kind: 'restore', key, command}),
    cancel: command => calls.push({kind: 'cancel', command}),
    showDialog: () => calls.push({kind: 'show'}), dismissDialog: () => calls.push({kind: 'dismiss'}),
  }, supported);
  store.activate();
  const common = {provider: store.provider, lifetime: '10'};
  store.surface({...common, sequence: '1', state: 'ready'});
  return {store, calls, common,
    focus: (key, sequence, extra = {}) => store.focus({...common, sequence, occurrenceKey: nativeTargetKey(key),
      mount: '1', kind: 'managed', channel: 'input', ...extra}),
    receipt: (request, native, status, sequence = '2', extra = {}) => store.receipt({...common,
      sequence, command: request.command, request: native, status, ...extra}),
  };
}

test('occurrence keys preserve repeated content and component boundaries', () => {
  assert.notEqual(occurrenceKey('home', 'rail-a', 'entry-1'), occurrenceKey('home', 'rail-b', 'entry-1'));
  assert.notEqual(occurrenceKey('a:b', 'c'), occurrenceKey('a', 'b:c'));
  assert.throws(() => occurrenceKey('home', ''), /nonempty/);
});

test('readiness subscribers read the committed lifecycle state', () => {
  const f = fixture();
  const observed = [];
  const unsubscribe = f.store.subscribeStatus(() => observed.push(f.store.ready()));
  f.store.surface({...f.common, sequence: '2', state: 'disposed'});
  f.store.surface({...f.common, lifetime: '11', sequence: '1', state: 'ready'});
  assert.deepEqual(observed, [false, true]);
  unsubscribe();
});

test('scope restoration is a native request with exact caller cancellation', async () => {
  const f = fixture();
  const request = f.store.restore(['home', 'rail']);
  assert.deepEqual(f.calls[0], {kind: 'restore', key: JSON.stringify(['scope', 'home', 'rail']), command: request.command});
  f.receipt(request, '19', 'started');
  request.cancel();
  assert.deepEqual(f.calls[1], {kind: 'cancel', command: request.command});
  f.receipt(request, '19', 'cancelled', '3');
  assert.equal((await request.result).status, 'cancelled');
});

test('only affected focus subscribers receive new observed transitions', () => {
  const f = fixture();
  const counts = {a: 0, b: 0, unrelated: 0};
  for (const key of Object.keys(counts)) { f.store.subscribe('input', () => counts[key]++, key); }
  f.focus('a', '9007199254740992');
  f.focus('b', '9007199254740993');
  f.focus('a', '9007199254740992'); // Old evidence cannot overwrite B, even beyond JS number precision.
  f.focus('b', '9007199254740994'); // Same state is deduplicated.
  assert.deepEqual(counts, {a: 2, b: 1, unrelated: 0});
  assert.equal(f.store.snapshot('input').occurrenceKey, 'b');
  assert.equal(f.store.snapshot('accessibility').kind, 'unknown');
});

test('native acceptance is pending until matching actual confirmation', async () => {
  const f = fixture();
  const request = f.store.request('a');
  let settled = false;
  request.result.then(() => { settled = true; });
  f.receipt(request, '51', 'started');
  f.receipt(request, '51', 'waiting', '3');
  f.receipt(request, '52', 'confirmed', '4'); // Wrong native request identity.
  await Promise.resolve();
  assert.equal(settled, false);
  assert.equal(f.store.snapshot('input').kind, 'unknown');
  f.receipt(request, '51', 'confirmed', '5');
  const outcome = await request.result;
  assert.equal(outcome.status, 'applied');
  assert.equal(outcome.request, '51');
  assert.equal(f.calls[0].key, nativeTargetKey('a'));
});

test('cancelling the old caller cannot cancel its replacement', async () => {
  const f = fixture();
  const old = f.store.request('a');
  f.receipt(old, '1', 'started');
  const current = f.store.request('b');
  old.cancel();
  assert.deepEqual(f.calls.at(-1), {kind: 'cancel', command: old.command});
  f.receipt(old, '1', 'cancelled', '3');
  f.receipt(current, '2', 'started', '4');
  assert.equal((await old.result).status, 'cancelled');
  const count = f.calls.length;
  old.cancel();
  assert.equal(f.calls.length, count);
  f.receipt(old, '1', 'confirmed', '5');
  f.receipt(current, '2', 'confirmed', '6');
  assert.equal((await current.result).status, 'applied');
});

test('disposal revokes the store and delayed ready cannot revive a retired lifetime', async () => {
  const f = fixture();
  const pending = f.store.request('a');
  f.store.surface({...f.common, sequence: '8', state: 'disposed'});
  assert.equal((await pending.result).reason, 'disposed');
  f.store.surface({...f.common, sequence: '9', state: 'ready'});
  f.focus('a', '10');
  assert.equal(f.store.ready(), false);
  f.store.surface({...f.common, lifetime: '11', sequence: '1', state: 'ready'});
  f.focus('new', '2', {lifetime: '11'});
  f.focus('old', '100');
  assert.equal(f.store.snapshot('input').occurrenceKey, 'new');
  f.store.surface({...f.common, lifetime: '12', sequence: '5', state: 'disposed'});
  f.store.surface({...f.common, lifetime: '12', sequence: '4', state: 'ready'});
  assert.equal(f.store.ready(), false);
});

test('store setup and cleanup replay does not retain duplicate listeners or pending intent', async () => {
  const f = fixture();
  let changes = 0;
  const listener = () => changes++;
  const cleanup = f.store.subscribe('input', listener, 'a');
  const pending = f.store.request('a');
  f.store.deactivate();
  cleanup();
  assert.equal((await pending.result).reason, 'disposed');
  f.store.activate();
  const unsubscribe = f.store.subscribe('input', listener, 'a');
  f.focus('a', '2');
  assert.equal(changes, 1);
  unsubscribe();
  f.focus('b', '3');
  assert.equal(changes, 1);
});

test('semantic activation is separate from input focus and deduplicates exact native identity', () => {
  const f = fixture();
  const token = {};
  const registration = f.store.registrationId();
  const cleanup = f.store.register('b', token, registration, true, true);
  f.focus('a', '2');
  const record = {...f.common, occurrenceKey: nativeTargetKey('b'), mount: '7', sequence: '1', source: 'accessibility', registration};
  assert.equal(f.store.activation(record, 'b', token).occurrenceKey, 'b');
  assert.equal(f.store.activation(record, 'b', token), null);
  f.store.updateTarget('b', token, true, true);
  assert.equal(f.store.activation(record, 'b', token), null); // Ordinary prop updates retain deduplication.
  assert.equal(f.store.snapshot('input').occurrenceKey, 'a');
  f.store.updateTarget('b', token, true, false);
  assert.equal(f.store.activation({...record, sequence: '2'}, 'b', token), null);
  cleanup();
  const replacement = {};
  const replacementId = f.store.registrationId();
  f.store.register('b', replacement, replacementId, true, true);
  cleanup(); // An old cleanup cannot erase the new lease.
  assert.equal(f.store.activation({...record, sequence: '3'}, 'b', replacement), null);
  assert.notEqual(f.store.activation({...record, registration: replacementId, mount: '8'}, 'b', replacement), null);
});

test('inactive, disabled, unknown, unmounted and unsupported command states are explicit', async () => {
  const f = fixture();
  f.store.register('inactive', {}, 'x', true, false);
  f.store.register('disabled', {}, 'y', false, true);
  assert.equal((await f.store.request('inactive').result).reason, 'inactive');
  assert.equal((await f.store.request('disabled').result).reason, 'disabled');
  assert.equal(f.calls.length, 0);
  const unknown = f.store.request('unknown');
  f.receipt(unknown, '0', 'unavailable');
  assert.equal((await unknown.result).status, 'unavailable');
  const unmounted = f.store.request('known-unmounted');
  f.receipt(unmounted, '2', 'started', '3');
  f.receipt(unmounted, '2', 'reconciled', '4');
  assert.equal((await unmounted.result).status, 'unavailable');
  const other = fixture(false);
  assert.equal((await other.store.request('a').result).status, 'unsupported');
  assert.equal(other.calls.length, 0);
});

test('pending work is bounded and teardown settles every caller once', async () => {
  const f = fixture();
  const pending = Array.from({length: 32}, (_, index) => f.store.request(`item-${index}`));
  assert.equal((await f.store.request('overflow').result).reason, 'capacity');
  f.store.deactivate();
  const outcomes = await Promise.all(pending.map(request => request.result));
  assert.equal(outcomes.length, 32);
  assert.ok(outcomes.every(outcome => outcome.status === 'unavailable'));
  f.focus('stale', '99');
  assert.equal(f.store.snapshot('input').kind, 'unknown');
});

test('malformed or foreign host evidence cannot become confirmed state', () => {
  const f = fixture();
  f.focus('a', '-1');
  f.focus('a', '2', {provider: 'another-provider'});
  f.focus('a', '3', {kind: 'speculative'});
  f.focus('a', '4', {occurrenceKey: 'not-an-owned-key'});
  f.focus('a', '99999999999999999999');
  assert.equal(f.store.snapshot('input').kind, 'unknown');
});
