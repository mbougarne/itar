import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import createItarEngine from '../../../../build/web-engine/itar-web.js';

const wasm = readFileSync(
  fileURLToPath(
    new URL('../../../../build/web-engine/itar-web.wasm', import.meta.url),
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
