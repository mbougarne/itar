const assert = require('node:assert/strict');
const {test} = require('node:test');
const {CollectionStore} = require('../packages/itar/lib/api/collections');
const nodes = [
  {key: 'list', parent: '', order: 0, scope: true, enabled: true, layout: 1, extent: 100},
  ...Array.from({length: 10}, (_, order) => ({key: `item-${order}`, parent: 'list', order,
    scope: false, enabled: true, layout: 0, extent: 0})),
];
function fixture() {
  const calls = [];
  const store = new CollectionStore('provider', payload => calls.push(JSON.parse(payload)));
  const owner = {};
  const common = {provider: 'provider', lifetime: '10'};
  store.surface({...common, sequence: '1', state: 'ready'});
  const dataset = store.publish(owner, nodes);
  let sequence = 1;
  const record = (value, extra = {}) => store.record({...common, sequence: String(++sequence), payload: JSON.stringify(value), ...extra});
  const prepare = {state: 'prepare', dataset, request: '90', effect: '91', step: 0, key: 'item-9',
    path: [{collection: 'list', key: 'item-9', index: 9}], source: [{collection: 'list', key: 'item-1', index: 1}]};
  return {store, owner, dataset, common, calls, record, prepare};
}
test('preparation requires accepted dataset and exact committed identity', () => {
  const f = fixture();
  f.record(f.prepare);
  assert.equal(f.store.snapshot().preparation, null);
  f.record({state: 'catalog', dataset: f.dataset});
  f.record(f.prepare);
  const preparation = f.store.snapshot().preparation;
  assert.ok(preparation);
  assert.deepEqual(f.store.regions('list'), [{first: 1, last: 1}, {first: 9, last: 9}]);
  f.store.committed(preparation, 'item-8');
  assert.equal(f.calls.length, 0);
  f.store.committed(preparation, 'item-9');
  assert.equal(f.calls.length, 1);
  assert.equal(f.calls[0].lifetime, '10');
  f.record({state: 'release', request: '90', effect: '91'});
  assert.deepEqual(f.store.regions('list'), []);
  f.store.committed(preparation, 'item-9');
  assert.equal(f.calls.length, 1);
});
test('old revision, lifetime, order and release cannot authorize a replacement', () => {
  const f = fixture();
  f.record({state: 'catalog', dataset: f.dataset});
  f.record(f.prepare);
  const old = f.store.snapshot().preparation;
  const next = f.store.publish(f.owner, [...nodes]);
  f.record(f.prepare);
  f.store.committed(old, 'item-9');
  assert.equal(f.calls.length, 0);
  f.record({state: 'catalog', dataset: next});
  f.record({...f.prepare, dataset: next, effect: '92', path: [{collection: 'list', key: 'item-9', index: 0}]});
  assert.equal(f.store.snapshot().preparation, null);
  f.record({...f.prepare, dataset: next, effect: '92'}, {lifetime: '9'});
  assert.equal(f.store.snapshot().preparation, null);
  f.record({...f.prepare, dataset: next, effect: '92'});
  f.record({state: 'release', request: '90', effect: '91'});
  assert.equal(f.store.snapshot().preparation.effect, '92');
  f.store.surface({...f.common, sequence: '100', state: 'disposed'});
  assert.deepEqual(f.store.regions('list'), []);
});
test('catalog publication rejects duplicate identities and competing owners', () => {
  const f = fixture();
  assert.throws(() => f.store.publish({}, nodes), /one virtualized/);
  assert.throws(() => f.store.publish(f.owner, [...nodes, nodes[1]]), /unique/);
  assert.equal(f.store.snapshot().dataset, f.dataset);
  f.store.remove({});
  assert.equal(f.store.snapshot().dataset, f.dataset);
  f.store.remove(f.owner);
  assert.deepEqual(JSON.parse(f.store.snapshot().data).nodes, []);
});

test('row-entry wire validation is atomic and a policy revision revokes preparation', () => {
  const f = fixture();
  f.record({state: 'catalog', dataset: f.dataset}); f.record(f.prepare);
  const before = f.store.snapshot();
  const column = {...nodes[0], layout: 2, rowEntry: 1};
  for (const invalid of [2, -1, 0.5, 'first', null]) {
    assert.throws(() => f.store.publish(f.owner, [{...column, rowEntry: invalid}, ...nodes.slice(1)]), /row entry/);
    assert.equal(f.store.snapshot(), before);
  }
  for (const invalid of [{...column, layout: 1}, {...column, scope: false}, {...column, parent: 'nested'}]) {
    const parents = invalid.parent === 'nested' ? [{...nodes[0], key: 'nested', layout: 2}] : [];
    assert.throws(() => f.store.publish(f.owner, [...parents, invalid]), /row entry/);
    assert.equal(f.store.snapshot(), before);
  }
  const next = f.store.publish(f.owner, [column, ...nodes.slice(1)]);
  assert.notEqual(next, f.dataset);
  assert.equal(f.store.snapshot().preparation, null);
  assert.equal(JSON.parse(f.store.snapshot().data).nodes[0].rowEntry, 1);
  f.store.committed(before.preparation, 'item-9');
  assert.equal(f.calls.length, 0);
});
test('nested preparation retains two indices per list and acknowledges only the current step', () => {
  const f = fixture();
  const nested = [
    {key: 'outer', parent: '', order: 0, scope: true, enabled: true, layout: 2, extent: 120},
    {key: 'row-a', parent: 'outer', order: 0, scope: true, enabled: true, layout: 1, extent: 100},
    {key: 'row-b', parent: 'outer', order: 1, scope: true, enabled: true, layout: 1, extent: 100},
    {key: 'a', parent: 'row-a', order: 0, scope: false, enabled: true, layout: 0, extent: 0},
    {key: 'b', parent: 'row-b', order: 0, scope: false, enabled: true, layout: 0, extent: 0},
  ];
  const dataset = f.store.publish(f.owner, nested);
  f.record({state: 'catalog', dataset});
  const prepare = {...f.prepare, dataset, key: 'row-b',
    path: [{collection: 'outer', key: 'row-b', index: 1}, {collection: 'row-b', key: 'b', index: 0}],
    source: [{collection: 'outer', key: 'row-a', index: 0}, {collection: 'row-a', key: 'a', index: 0}]};
  f.record(prepare);
  const outer = f.store.snapshot().preparation;
  f.store.committed(outer, 'b');
  assert.equal(f.calls.length, 0);
  f.record({...prepare, step: 1, key: 'b'});
  f.store.committed(outer, 'row-b');
  assert.equal(f.calls.length, 0);
  f.store.committed(f.store.snapshot().preparation, 'b');
  assert.equal(f.calls.length, 1);
  assert.deepEqual(f.store.regions('outer'), [{first: 0, last: 0}, {first: 1, last: 1}]);
  assert.equal(f.store.regions('row-a').length, 1);
  assert.equal(f.store.regions('row-b').length, 1);
});

test('collection ownership handoff rejects stale preparation from the prior screen', () => {
  const f = fixture();
  f.record({state: 'catalog', dataset: f.dataset});
  f.record(f.prepare);
  const stale = f.store.snapshot().preparation;
  f.store.remove(f.owner);
  const detailsOwner = {};
  const dataset = f.store.publish(detailsOwner, nodes);
  f.record({state: 'catalog', dataset});
  f.store.committed(stale, 'item-9');
  f.record(f.prepare);
  assert.equal(f.calls.length, 0);
  assert.equal(f.store.snapshot().preparation, null);
  f.store.remove(f.owner);
  assert.equal(f.store.snapshot().dataset, dataset);
  f.store.remove(detailsOwner);
  assert.deepEqual(JSON.parse(f.store.snapshot().data).nodes, []);
});
