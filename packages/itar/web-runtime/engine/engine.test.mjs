import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import createItarEngine from '../../../../build/itar-web-engine/itar-web.js';

const wasm = readFileSync(
  fileURLToPath(
    new URL('../../../../build/itar-web-engine/itar-web.wasm', import.meta.url),
  ),
);
const originalFetch = globalThis.fetch;
globalThis.fetch = () => { throw new Error('The embedded Wasm must not fetch a resource'); };
let module;
try {
  module = await createItarEngine({wasmBinary: wasm, locateFile: () => 'https://invalid.invalid/never-fetch.wasm'});
} finally { globalThis.fetch = originalFetch; }
const scope = { key: 'row', parent: '', scope: true, layout: 1, boundary: 0 };
const target = (key, order, mounted = true, mount = 1) => ({
  key,
  parent: 'row',
  scope: false,
  order,
  mounted,
  mount,
  x: order * 100,
  y: 0,
  width: 80,
  height: 50,
});
const data = () => [scope, target('a', 0), target('b', 1)];
function withEngine(run) {
  const engine = new module.WebEngine(64);
  try {
    assert.equal(engine.sync(data()), 0);
    engine.observe('', 0, 0, 0);
    run(engine);
  } finally {
    engine.delete();
  }
}
function confirm(engine, key, mount = 1) {
  const [effect] = engine.drain();
  assert.equal(effect.kind, 1);
  assert.equal(effect.key, key);
  assert.equal(engine.issue(effect.id).status, 15);
  assert.equal(engine.observe(key, mount, 0, effect.id).status, 8);
  engine.complete(effect.id, 2);
  assert.equal(engine.snapshot().activeRequest, 0);
  assert.equal(engine.snapshot().inputKey, key);
  return effect;
}

const rows = (rowEntry = 0, realized = false) => [
  {key: 'outer', parent: '', scope: true, layout: 2, collection: true, extent: 120, rowEntry},
  ...['header', 'rail'].flatMap((key, order) => [
    {key, parent: 'outer', order, scope: true, layout: 1, collection: true, extent: 100},
    ...[0, 1, 2].map(index => ({...target(`${key}-${index}`, index, key === 'header' || index !== 1 || realized,
      key === 'rail' && index === 1 && realized ? 2 : 1), parent: key, collection: true,
      enabled: key !== 'rail' || index !== 0, y: order * 120})),
  ]),
];
function withRows(policy, run) {
  const engine = new module.WebEngine(64);
  try { assert.equal(engine.sync(rows(policy)), 0); engine.observe('', 0, 0, 0);
    engine.focus('header-2', 0); confirm(engine, 'header-2'); run(engine);
  } finally { engine.delete(); }
}
test('shared collection policy selects logical first before a later mounted column', () => {
  for (const policy of [0, 1, 2]) withRows(policy, engine => {
    assert.equal(engine.direction(3, 3).status, 3);
    assert.deepEqual(engine.drain(), []);
    assert.equal(engine.direction(3, 0).status, 0);
    if (policy !== 0) {
      const [reveal] = engine.drain();
      assert.equal(reveal.key, 'rail-1'); assert.equal(reveal.kind, 0);
      assert.equal(engine.issue(reveal.id).status, 15);
      assert.equal(engine.sync(rows(policy, true).reverse()), 0); // Mount/transport order is not a new logical dataset.
      assert.equal(engine.realize(reveal.id, 'rail-1', 2).status, 0);
      confirm(engine, 'rail-1', 2);
    } else confirm(engine, 'rail-2');
    engine.release(); engine.direction(2, 0);
    confirm(engine, policy === 1 ? 'header-0' : 'header-2');
    engine.focus('header-1', 0); confirm(engine, 'header-1');
    engine.direction(1, 0); confirm(engine, 'header-2');
    engine.focus('header-1', 0); confirm(engine, 'header-1'); engine.unmanaged(0);
    engine.restore('header'); confirm(engine, 'header-1');
  });
});
test('policy publication cancels old realization and invalid snapshots reject atomically', () => withRows(1, engine => {
  engine.direction(3, 0); const [reveal] = engine.drain();
  assert.equal(reveal.key, 'rail-1'); assert.equal(engine.issue(reveal.id).status, 15);
  const pending = engine.snapshot().activeRequest;
  for (const rowEntry of [-1, 3, 0.5, 'first', null, Number.NaN]) {
    assert.notEqual(engine.sync(rows(rowEntry)), 0);
    assert.equal(engine.snapshot().activeRequest, pending);
  }
  const misplaced = rows(0); misplaced[1].rowEntry = 1;
  assert.notEqual(engine.sync(misplaced), 0);
  assert.equal(engine.sync(rows(0)), 0);
  assert.equal(engine.snapshot().inputKey, 'header-2');
  assert.equal(engine.realize(reveal.id, 'rail-1', 2).status, 4);
  const [cancel] = engine.drain(); assert.equal(cancel.cancels, reveal.id);
  engine.issue(cancel.id); engine.complete(cancel.id, 3);
  assert.equal(engine.snapshot().activeRequest, 0);
}));

test('compiled C++ selects directions and preserves reader ownership/focus channels', () =>
  withEngine(engine => {
    assert.equal(engine.focus('a', 0).status, 0);
    confirm(engine, 'a');
    engine.observe('b', 1, 1, 0);
    assert.equal(engine.direction(1, 3).status, 3);
    assert.deepEqual(engine.drain(), []);
    assert.equal(engine.snapshot().inputKey, 'a');
    assert.equal(engine.snapshot().a11yKey, 'b');
    assert.equal(engine.direction(1, 0).status, 0);
    confirm(engine, 'b');
    engine.release();
    assert.equal(engine.direction(1, 0).status, 3);
  }));

test('duplicate, missing-parent and invalid geometry snapshots reject atomically', () =>
  withEngine(engine => {
    engine.focus('a', 0);
    confirm(engine, 'a');
    assert.equal(engine.sync([...data(), target('a', 2)]), 4);
    assert.notEqual(engine.sync([target('a', 0)]), 0);
    assert.equal(
      engine.sync([scope, { ...target('a', 0), width: Number.NaN }]),
      9,
    );
    assert.equal(engine.snapshot().inputKey, 'a');
    assert.equal(engine.focus('b', 0).status, 0);
    confirm(engine, 'b');
  }));

test('reveal waits for the exact newly mounted target before emitting focus', () =>
  withEngine(engine => {
    engine.focus('a', 0);
    confirm(engine, 'a');
    assert.equal(
      engine.sync([scope, target('a', 0), target('b', 1, false, 1)]),
      0,
    );
    assert.equal(engine.direction(1, 0).status, 0);
    const [reveal] = engine.drain();
    assert.equal(reveal.kind, 0);
    assert.equal(engine.issue(reveal.id).status, 15);
    assert.equal(engine.realize(reveal.id, 'b', 1).status, 4);
    assert.equal(
      engine.sync([scope, target('a', 0), target('b', 1, true, 2)]),
      0,
    );
    assert.equal(engine.realize(reveal.id, 'b', 2).status, 0);
    confirm(engine, 'b', 2);
  }));

test('cancellation, stale mounts and disposal cannot revive pending focus', () =>
  withEngine(engine => {
    engine.focus('a', 0);
    confirm(engine, 'a');
    const request = engine.focus('b', 0);
    const [effect] = engine.drain();
    assert.equal(engine.issue(effect.id).status, 15);
    assert.equal(engine.cancel(request.request).status, 6);
    const [cancel] = engine.drain();
    assert.equal(cancel.cancels, effect.id);
    assert.equal(engine.issue(cancel.id).status, 15);
    engine.complete(cancel.id, 3);
    assert.equal(
      engine.sync([scope, target('a', 0), target('b', 1, true, 2)]),
      0,
    );
    assert.equal(engine.observe('b', 1, 0, effect.id).status, 4);
    assert.equal(engine.snapshot().inputKey, 'a');
    engine.dispose();
    assert.equal(engine.focus('b', 0).status, 14);
    assert.deepEqual(engine.drain(), []);
  }));

test('inactive scope and closed entry gate exclude automatic entry', () =>
  withEngine(engine => {
    engine.focus('a', 0);
    confirm(engine, 'a');
    assert.equal(
      engine.sync([
        { ...scope, active: false },
        target('a', 0),
        target('b', 1),
      ]),
      0,
    );
    assert.equal(engine.focus('b', 0).status, 3);
    engine.observe('', 0, 0, 0);
    assert.equal(
      engine.sync([
        { ...scope, entryReady: false },
        target('a', 0),
        target('b', 1),
      ]),
      0,
    );
    assert.equal(engine.restore('row').status, 3);
    assert.equal(engine.sync(data()), 0);
    assert.equal(engine.restore('row').status, 0);
    confirm(engine, 'a');
  }));

test('repeated create/destroy and completed commands keep effect storage bounded', () => {
  for (let i = 0; i < 50; ++i) {
    withEngine(engine => {
      for (let move = 0; move < 70; ++move) {
        const key = move % 2 ? 'b' : 'a';
        assert.equal(engine.focus(key, 0).status, 0);
        confirm(engine, key);
      }
      assert.equal(engine.snapshot().resync, false);
    });
  }
});

test('explicit scope restoration uses observed history from unmanaged host focus', () =>
  withEngine(engine => {
    engine.focus('b', 0);
    confirm(engine, 'b');
    engine.unmanaged(0);
    assert.equal(engine.restore('row').status, 0);
    confirm(engine, 'b');
  }));

test('full snapshots preserve observed source and order across geometry and input-array changes', () => withEngine(engine => {
  engine.focus('a', 0); confirm(engine, 'a');
  assert.equal(engine.sync([target('b', 1), {...target('a', 0), y: 10}, scope]), 0);
  assert.equal(engine.snapshot().inputKey, 'a');
  assert.equal(engine.direction(1, 0).status, 0);
  confirm(engine, 'b');
}));

test('cycles, overlong keys and fractional protocol integers reject without changing focus', () => withEngine(engine => {
  engine.focus('a', 0); confirm(engine, 'a');
  assert.equal(engine.sync([{...scope, parent: 'cycle'}, {key: 'cycle', parent: 'row', scope: true}, target('a', 0)]), 8);
  assert.equal(engine.sync([...data(), target('x'.repeat(513), 2)]), 3);
  assert.equal(engine.sync([scope, target('a', 0), target('b', 1.5)]), 3);
  assert.equal(engine.sync([{...scope, layout: 0.5}, target('a', 0)]), 3);
  assert.equal(engine.snapshot().inputKey, 'a');
  assert.equal(engine.direction(1, 0).status, 0);
  confirm(engine, 'b');
}));

test('visual alignment publication cancels old reveal without changing the selected key', () => withRows(1, engine => {
  engine.direction(3, 0); const [reveal] = engine.drain();
  assert.equal(engine.issue(reveal.id).status, 15);
  for (const horizontalAlignment of [-1,3,0.5,null,'leading']) {
    assert.notEqual(engine.sync(rows(1).map(node => node.key === 'rail' ? {...node, horizontalAlignment} : node)),0);
    assert.equal(engine.snapshot().activeRequest,reveal.request);
  }
  const aligned = rows(1).map(node => node.key === 'rail' ? {...node, horizontalAlignment: 1} : node);
  assert.equal(engine.sync(aligned), 0);
  assert.equal(engine.snapshot().activeRequest, 0);
  assert.equal(engine.realize(reveal.id, 'rail-1', 2).status, 4);
  assert.equal(engine.snapshot().inputKey, 'header-2');
}));
