/* eslint-env node, es2022 */
const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const Module = require('node:module');
const ts = require('typescript');
const root = path.resolve(__dirname, '../../../..');

function load(name) {
  const filename = path.join(root, 'apps/probe/web', name + '.ts');

  const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  });

  const loaded = new Module(filename);

  loaded.filename = filename;
  loaded.paths = Module._nodeModulePaths(path.dirname(filename));
  loaded._compile(compiled.outputText, filename);

  return loaded.exports;
}

const { WebFocusStore, createNode, setDirectionalNavigationEnabled } =
  load('focus-store');

const { visibleIndices } = load('window');
let wasm;

before(async () => {
  const factory = (
    await import(pathToFileURL(path.join(root, 'build/web-engine/itar-web.js')))
  ).default;

  wasm = await factory({
    wasmBinary: fs.readFileSync(
      path.join(root, 'build/web-engine/itar-web.wasm'),
    ),
  });
});

function fixture(t) {
  const body = {};

  global.document = { body };

  let active = body;
  const store = new WebFocusStore(new wasm.WebEngine(128), () => active);
  const scope = { ...createNode('row', '', true), layout: 1 };

  store.register(scope);

  function target(key, order, parent = 'row') {
    const element = {
      isConnected: true,
      getBoundingClientRect: () => ({
        x: order * 100,
        y: 0,
        width: 80,
        height: 50,
      }),
      focus() {
        active = element;
        store.flush();
        store.observe(active);
      },
      scrollIntoView() {},
    };

    const record = {
      ...createNode(key, parent),
      mount: store.mountId(),
      publicKey: key,
      order,
      element,
    };

    store.register(record);

    return record;
  }

  t.after(() => {
    store.dispose();
    setDirectionalNavigationEnabled(true);
    delete global.document;
  });

  return { store, target, active: () => active, body };
}

test('real Wasm host confirms DOM effects once and keeps a11y unknown', async t => {
  const f = fixture(t);

  const a = f.target('a', 0),
    b = f.target('b', 1);

  assert.equal((await f.store.request('a').result).status, 'applied');
  assert.equal(f.active(), a.element);
  f.store.direction(1);
  assert.equal(f.active(), b.element);
  assert.equal(f.store.snapshot().occurrenceKey, 'b');
  assert.equal(f.store.accessibilitySnapshot().kind, 'unknown');
});

test('logical collection row order survives mounted scope overlay', async t => {
  const f = fixture(t);

  f.store.update(f.store.get('row'), { layout: 2 });

  f.store.collection(
    {},
    {
      nodes: [
        createNode('row', '', true),
        { ...createNode('last', 'row', true), order: 1 },
        { ...createNode('first', 'row', true), order: 0 },
      ],
      reveal: () => false,
    },
  );

  f.store.register(createNode('last', 'row', true));
  f.store.register(createNode('first', 'row', true));
  f.target('a', 0, 'first');

  const b = f.target('b', 0, 'last');

  await f.store.request('a').result;
  f.store.direction(3);
  assert.equal(f.active(), b.element);
});

test('cancelled delayed reveal cannot later steal DOM focus', async t => {
  const f = fixture(t);
  const a = f.target('a', 0);
  const token = {};

  f.store.collection(token, {
    nodes: [{ ...createNode('b', 'row'), order: 1 }],
    reveal: () => true,
  });

  await f.store.request('a').result;

  const pending = f.store.request('b');

  await Promise.resolve();
  pending.cancel();
  assert.equal((await pending.result).status, 'cancelled');
  f.target('b', 1);
  f.store.flush();
  await Promise.resolve();
  assert.equal(f.active(), a.element);
});

test('expired directional reveal does not confirm after delayed mount', async t => {
  let now = 100;

  t.mock.method(performance, 'now', () => now);

  const f = fixture(t);
  const a = f.target('a', 0);

  f.store.collection(
    {},
    { nodes: [{ ...createNode('b', 'row'), order: 1 }], reveal: () => true },
  );

  await f.store.request('a').result;
  f.store.direction(1);
  assert.notEqual(f.store.engine.snapshot().activeRequest, 0);
  now += 1100;
  f.target('b', 1);
  f.store.flush();
  await Promise.resolve();
  assert.equal(f.active(), a.element);
  assert.equal(f.store.engine.snapshot().activeRequest, 0);
});

test('reader/browser mode cancels pending directional realization', async t => {
  const f = fixture(t);
  const a = f.target('a', 0);

  f.store.collection(
    {},
    { nodes: [{ ...createNode('b', 'row'), order: 1 }], reveal: () => true },
  );

  await f.store.request('a').result;
  f.store.direction(1);
  setDirectionalNavigationEnabled(false);
  f.target('b', 1);
  f.store.flush();
  await Promise.resolve();
  assert.equal(f.active(), a.element);
  assert.equal(f.store.engine.snapshot().activeRequest, 0);
});

test('virtual window retains source and distant destination with bounded overscan', () => {
  const range = visibleIndices(1000, 400, 4, 0, 900);

  assert.ok(range.includes(0) && range.includes(900));
  assert.equal(range.length, 9);
  assert.deepEqual(visibleIndices(0, 0, 4, -1), []);
});
