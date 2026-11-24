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
  const filename = path.join(__dirname, '..', name + '.ts');

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

const {
  WebFocusStore,
  createNode,
  setDirectionalNavigationEnabled,
  setWebTrace,
} = load('focus-store');

const { visibleIndices } = load('window');
let wasm;

before(async () => {
  const factory = (
    await import(pathToFileURL(path.join(root, 'build/itar-web-engine/itar-web.js')))
  ).default;

  wasm = await factory({
    wasmBinary: fs.readFileSync(
      path.join(root, 'build/itar-web-engine/itar-web.wasm'),
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

test('collection metadata survives DOM overlay and policy changes cancel delayed realization', async t => {
  const f = fixture(t),
    token = {};

  f.store.update(f.store.get('row'), { layout: 2 });

  const catalogue = {
    ...createNode('row', '', true),
    layout: 2,
    collection: true,
    extent: 120,
  };

  const logical = ['header', 'rail'].flatMap((key, order) => [
    {
      ...createNode(key, 'row', true),
      order,
      layout: 1,
      collection: true,
      extent: 100,
    },
    ...[0, 1, 2].map(index => ({
      ...createNode(`${key}-${index}`, key),
      order: index,
      collection: true,
      enabled: key !== 'rail' || index !== 0,
    })),
  ]);

  let requested;
  const released = [];

  const publish = rowEntry =>
    f.store.collection(token, {
      nodes: [{ ...catalogue, rowEntry }, ...logical],
      release: key => released.push(key),
      reveal: key => {
        requested = key;

        return true;
      },
    });

  publish(1);
  f.store.register({ ...createNode('header', 'row', true), layout: 1 });
  f.store.register({ ...createNode('rail', 'row', true), layout: 1 });

  const source = f.target('header-2', 2, 'header');

  f.target('rail-2', 2, 'rail');
  await f.store.request('header-2').result;
  f.store.direction(3);
  assert.equal(requested, 'rail-1');
  assert.equal(f.active(), source.element);
  publish(0);
  f.store.flush();
  await Promise.resolve();
  f.target('rail-1', 1, 'rail');
  f.store.flush();
  await Promise.resolve();

  assert.equal(
    f.active(),
    source.element,
    'a late mount must not fulfill the old policy',
  );

  assert.deepEqual(released, ['rail-1']);

  f.store.direction(3);
  assert.equal(f.store.snapshot().occurrenceKey, 'rail-2');
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

test('collection commits reveal retained focus without issuing a new focus move', async t => {
  const f = fixture(t);
  const a = f.target('a', 0);
  const token = {};

  let y = 0,
    reveals = 0;

  a.element.getBoundingClientRect = () => ({ x: 0, y, width: 80, height: 50 });

  a.element.scrollIntoView = () => {
    reveals++;
  };

  const dataset = () => ({
    nodes: [createNode('a', 'row')],
    reveal: () => false,
  });

  f.store.collection(token, dataset());
  await f.store.request('a').result;
  reveals = 0;
  y = 1200;
  // React replaces the collection effect with cleanup followed by setup.
  f.store.removeCollection(token);
  f.store.collection(token, dataset());
  await Promise.resolve();
  assert.equal(reveals, 1);
  assert.equal(f.active(), a.element);
  assert.equal(f.store.engine.snapshot().activeRequest, 0);

  for (const interrupt of [
    () => f.store.removeCollection(token),
    () => f.store.update(a, { active: false }),
    () => setDirectionalNavigationEnabled(false),
    () => f.store.request('missing').cancel(),
  ]) {
    f.store.update(a, { active: true });
    setDirectionalNavigationEnabled(true);
    f.store.collection(token, dataset());

    const count = reveals;

    interrupt();
    await Promise.resolve();

    assert.equal(
      reveals,
      count,
      'retired/inactive or superseded commits must not scroll',
    );
  }
});

test('Occo preserves a cancelled reveal and a later independent DOM observation', async t => {
  const events = [];

  setWebTrace({ event: e => events.push(e), move: () => undefined });
  t.after(() => setWebTrace());

  const f = fixture(t);

  f.target('a', 0);

  f.store.collection(
    {},
    { nodes: [{ ...createNode('b', 'row'), order: 1 }], reveal: () => true },
  );

  await f.store.request('a').result;

  const p = f.store.request('b');

  await Promise.resolve();
  p.cancel();

  const receipt = await p.result;
  const b = f.target('b', 1);

  f.store.flush();
  f.store.observe(b.element, 0, true);

  const steps = events.filter(e => e.request === receipt.request);

  assert.ok(
    steps.some(e => e.kind === 'host' && e.detail === 'reveal accepted'),
  );

  assert.ok(steps.some(e => e.kind === 'request' && e.detail === 'cancelled'));

  const observed = events.at(-1);

  assert.equal(observed.kind, 'observation');
  assert.equal(observed.target, 'b');
  assert.equal(observed.mount, String(b.mount));
  assert.notEqual(observed.request, receipt.request);
  assert.equal(observed.channel, 'input');
});

test('unchanged bounds reuse the Wasm snapshot; layout, mount and policy changes republish', async t => {
  const { store, target } = fixture(t);
  const a = target('a', 0);
  const b = target('b', 1);
  const sync = store.engine.sync.bind(store.engine);
  const published = [];

  store.engine.sync = nodes => {
    published.push(
      nodes.map(({ key, x, mounted, enabled }) => ({
        key,
        x,
        mounted,
        enabled,
      })),
    );

    return sync(nodes);
  };

  await Promise.resolve();

  const previous = published.length;

  store.flush();
  store.update(a, { enabled: true });
  store.flush();
  assert.equal(published.length, previous);

  b.element.getBoundingClientRect = () => ({
    x: 250,
    y: 0,
    width: 80,
    height: 50,
  });

  store.flush();
  assert.equal(published.length, previous + 1);
  assert.equal(published.at(-1).find(node => node.key === 'b').x, 250);
  b.element.isConnected = false;
  store.flush();
  assert.equal(published.at(-1).find(node => node.key === 'b').mounted, false);
  store.update(a, { enabled: false });
  store.flush();
  assert.equal(published.at(-1).find(node => node.key === 'a').enabled, false);
});

test('Right crosses ordered regions and restores the card even when overscan extends behind the menu', async t => {
  const { store, target, active } = fixture(t);

  store.register({ ...createNode('menu', 'row', true), layout: 2, order: 0 });

  store.register({
    ...createNode('content', 'row', true),
    order: 1,
    restoreOnEntry: true,
  });

  const menu = target('menu-item', 0, 'menu');
  const overscan = target('offscreen', 0, 'content');

  overscan.element.getBoundingClientRect = () => ({
    x: -310,
    y: -146,
    width: 422,
    height: 237,
  });

  const card = target('last-card', 1, 'content');

  assert.equal((await store.request('last-card').result).status, 'applied');
  assert.equal((await store.request('menu-item').result).status, 'applied');
  assert.equal(active(), menu.element);
  store.direction(1);
  assert.equal(active(), card.element);
});
