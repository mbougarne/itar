const assert = require('node:assert/strict');
const {test} = require('node:test');
const {readFileSync} = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const {nativeScopeKey, nativeTargetKey} = require('../packages/itar/lib/api/types');
const {CollectionStore} = require('../packages/itar/lib/api/collections');
const {headerScrollOffset} = require('../packages/itar/lib/api/viewport');

// Evaluate the component's real collection/layout calculations with a host-free
// hook harness. No native view, application, browser, or renderer is started.
function fixture(focus = {kind: 'unknown', occurrenceKey: null}, native = false, os = native ? 'ios' : 'web', reader = null) {
  let published;
  const effects = [];
  const commits = [];
  let snapshot = {dataset: native ? '0' : '1', accepted: native ? '0' : '1', preparation: null};
  let revision = 0, stateIndex = 0, refIndex = 0;
  const states = [], refs = [];
  const store = {
    subscribe: () => () => {}, snapshot: () => snapshot,
    publish: (_owner, nodes) => {
      published = nodes;
      if (native) { snapshot = {...snapshot, dataset: String(++revision)}; }
      return snapshot.dataset;
    },
    remove: () => {}, regions: () => [],
    committed: (preparation, key) => commits.push({preparation, key}),
  };
  const contexts = {ScopeContext: {path: ['home'], key: nativeScopeKey(['home']), active: true},
    CollectionContext: store, CollectionDatasetContext: {Provider: 'Dataset'}};
  const react = {
    createElement: (type, props, ...children) => ({type, props: {...props, children}}),
    memo: value => value, useContext: context => context, useMemo: callback => callback(),
    useRef: value => { const index = refIndex++; refs[index] ||= {current: value}; return refs[index]; },
    useState: value => {
      const index = stateIndex++;
      if (!(index in states)) { states[index] = typeof value === 'function' ? value() : value; }
      return [states[index], next => { states[index] = next; }];
    },
    useSyncExternalStore: (_subscribe, read) => read(), useLayoutEffect: callback => callback(), useEffect: callback => effects.push(callback),
  };
  const output = ts.transpileModule(readFileSync(path.join(__dirname, '../packages/itar/src/virtualized.tsx'), 'utf8'), {
    compilerOptions: {module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true},
  }).outputText;
  const module = {exports: {}};
  vm.runInNewContext(output, {module, exports: module.exports, require: name => {
    if (name === 'react') { return react; }
    if (name === 'react-native') { return {FlatList: 'FlatList', View: 'View', Platform: {OS: os, isTV: native},
      PixelRatio: {getPixelSizeForLayoutSize: size => Math.round(size * 2)}, StyleSheet: {create: value => value}}; }
    if (name === './api/contexts') { return contexts; }
    if (name === './api/types') { return {nativeScopeKey, nativeTargetKey}; }
    if (name === './api/viewport') { return {headerScrollOffset}; }
    if (name === './react') { return {Focusable: 'Focusable', FocusScope: 'FocusScope', useFocusState: () => focus, useScreenReaderEnabled: () => reader}; }
    throw new Error(`Unexpected import ${name}`);
  }});
  return {renderList: props => { stateIndex = refIndex = 0; effects.length = 0; return module.exports.FocusVirtualizedList(props); }, render: props => {
    stateIndex = refIndex = 0; effects.length = 0;
    const tree = module.exports.FocusVirtualizedRails(props);
    const headerAlignment = tree.props.children[0]?.props.children[1];
    if (headerAlignment) { headerAlignment.type(headerAlignment.props); }
    return tree;
  }, nodes: () => published,
    commits: () => commits,
    accept: () => { snapshot = {...snapshot, accepted: snapshot.dataset}; },
    flush: () => effects.forEach(callback => callback()), prepare: value => { snapshot.preparation = value; }};
}
const options = {
  id: 'catalogue', rowExtent: 420, itemExtent: 300, viewportExtent: 1200,
  rails: [{id: 'popular', items: [{occurrenceKey: 'film', accessibilityLabel: 'Film'}]}],
};
const list = tree => tree.props.children[0].props.children[0];
const plain = value => JSON.parse(JSON.stringify(value));

test('row entry is published on the outer collection and changes the dataset before acceptance', () => {
  const f = fixture(undefined, true, 'android');
  const initial = {...options, listHeader: {}, listHeaderExtent: 624,
    listHeaderScope: 'hero', listHeaderItems: [{occurrenceKey: 'action', accessibilityLabel: 'Action'}]};
  f.render(initial); f.accept(); f.render(initial); f.render(initial);
  assert.equal(f.nodes()[0].rowEntry, 0);
  const first = {...initial, rowEntry: 'first'};
  const old = f.render(first);
  assert.equal(f.nodes()[0].rowEntry, 1);
  assert.ok(f.nodes().slice(1).every(node => node.rowEntry === undefined));
  assert.equal(old.props.value, '1', 'retain the accepted cells until the new policy is accepted');
  f.accept(); f.render(first);
  assert.equal(f.render(first).props.value, '2');
  f.render({...initial, rowEntry: 'remembered'});
  assert.equal(f.nodes()[0].rowEntry, 2);
  assert.throws(() => f.render({...options, rowEntry: 'typo'}), /rowEntry/);
  const apple = fixture(undefined, true, 'ios');
  apple.render(first);
  assert.equal(apple.nodes()[0].rowEntry, 1);
  assert.throws(() => fixture().render(first), /rowEntry.*adapter/);
});

test('readiness does not authorize a replacement from a stale render snapshot', () => {
  const f = fixture(undefined, true);
  const ready = [];
  const initial = {...options, onReady: () => ready.push('initial')};
  f.render(initial); f.accept(); f.render(initial); f.render(initial); f.flush();
  assert.deepEqual(ready, ['initial']);
  const replacement = {...options, rails: [{id: 'new', items: [{occurrenceKey: 'new-film', accessibilityLabel: 'New film'}]}],
    onReady: () => ready.push('replacement')};
  // The layout effect publishes revision 2 after render captured accepted 1.
  f.render(replacement); f.flush();
  assert.deepEqual(ready, ['initial'], 'old acceptance must not announce the new content');
  f.accept(); f.render(replacement); f.render(replacement); f.flush();
  assert.deepEqual(ready, ['initial', 'replacement']);
});

test('Hero is the first real collection row with independent extent and matching reveal indices', () => {
  const f = fixture();
  const header = {type: 'Hero'};
  const tree = f.render({...options, listHeader: header, listHeaderExtent: 624, listHeaderScope: 'hero-actions',
    listHeaderItems: [{occurrenceKey: 'explore', accessibilityLabel: 'Explore'}, {occurrenceKey: 'guide', accessibilityLabel: 'Guide'}]});
  const props = list(tree).props;
  assert.deepEqual(Array.from(props.data, row => row.id), ['hero-actions', 'popular']);
  assert.deepEqual(plain(props.getItemLayout(null, 0)), {length: 624, offset: 0, index: 0});
  assert.deepEqual(plain(props.getItemLayout(null, 1)), {length: 420, offset: 624, index: 1});
  assert.deepEqual(plain(props.getItemLayout(null, 2)), {length: 420, offset: 1044, index: 2});
  const nodes = f.nodes();
  assert.equal(nodes[0].leadingExtent, 624);
  const heroScope = nativeScopeKey(['home', 'catalogue', 'hero-actions']);
  assert.equal(nodes.find(node => node.key === heroScope).order, 0);
  assert.equal(nodes.find(node => node.key === nativeTargetKey('explore')).parent, heroScope);
  assert.equal(nodes.find(node => node.key === nativeScopeKey(['home', 'catalogue', 'popular'])).order, 1);
  const rendered = props.renderItem({item: props.data[0]});
  assert.equal(rendered.props.children[0], header);
  assert.equal(rendered.props.style.height, 624);
  // Native reveal retains the same bounded source/target render-region mechanism.
  assert.equal(props.windowSize, 3);
  assert.equal(props.maxToRenderPerBatch, 1);
});

test('a mounted Hero acknowledges its target step only after layout', () => {
  const f = fixture();
  const props = {...options, listHeader: {}, listHeaderExtent: 624, listHeaderScope: 'hero-actions',
    listHeaderItems: [{occurrenceKey: 'explore', accessibilityLabel: 'Explore'}]};
  const preparation = {request: '1', effect: '2', step: 1, key: nativeTargetKey('explore'),
    path: [{collection: nativeScopeKey(['home', 'catalogue']), key: nativeScopeKey(['home', 'catalogue', 'hero-actions']), index: 0},
      {collection: nativeScopeKey(['home', 'catalogue', 'hero-actions']), key: nativeTargetKey('explore'), index: 0}]};
  f.prepare(preparation);
  const outer = list(f.render(props)).props;
  const row = outer.renderItem({item: outer.data[0]});
  const marker = row.props.children[1];
  assert.ok(marker, 'the static header needs the same commit handshake as virtualized cells');
  assert.equal(f.commits().length, 0);
  marker.props.onLayout();
  assert.deepEqual(f.commits(), [{preparation, key: preparation.key}]);
  f.prepare({...preparation, key: nativeTargetKey('missing')});
  const other = list(f.render(props)).props;
  assert.equal(other.renderItem({item: other.data[0]}).props.children[1], null);
});

test('ordinary rails retain fixed offsets and invalid header declarations fail before publication', () => {
  const f = fixture();
  const props = list(f.render(options)).props;
  assert.deepEqual(plain(props.getItemLayout(null, 2)), {length: 420, offset: 840, index: 2});
  for (const extra of [
    {listHeader: {}, listHeaderExtent: 624},
    {listHeaderExtent: 624},
    {listHeader: {}, listHeaderExtent: NaN, listHeaderScope: 'hero', listHeaderItems: [{occurrenceKey: 'x', accessibilityLabel: 'X'}]},
    {listHeader: {}, listHeaderExtent: 624, listHeaderScope: 'popular', listHeaderItems: [{occurrenceKey: 'x', accessibilityLabel: 'X'}]},
  ]) { assert.throws(() => fixture().render({...options, ...extra})); }
});

test('Android fixed rows expose their cards while overflow rails and the vertical list stay scrollable', () => {
  const cards = (row, count) => Array.from({length: count}, (_, i) => ({occurrenceKey: `${row}-${i}`, accessibilityLabel: `Card ${i}`}));
  const props = {...options, viewportExtent: 500, itemExtent: 100,
    rails: [{id: 'short', items: cards('short', 2)}, {id: 'fits', items: cards('fits', 4), itemExtent: 125.00001},
      {id: 'overflow', items: cards('overflow', 6)}]};
  for (const os of ['android', 'ios']) {
    const f = fixture(undefined, true, os);
    f.render(props); f.accept(); f.render(props);
    const outer = list(f.render(props)).props;
    assert.notEqual(outer.scrollEnabled, false);
    assert.equal(outer.importantForAccessibility, undefined);
    for (const row of outer.data) {
      const inner = outer.renderItem({item: row}).props.children.find(child => typeof child?.type === 'function');
      const flat = inner.type(inner.props);
      const fixed = os === 'android' && row.id !== 'overflow';
      assert.equal(flat.type, 'FlatList', 'the native collection reveal step still needs its scroll host');
      assert.equal(flat.props.scrollEnabled, fixed ? false : undefined);
      assert.equal(flat.props.importantForAccessibility, fixed ? 'no' : undefined);
      const target = flat.props.renderItem({item: row.items[0], index: 0});
      assert.equal(target.props.accessibilityLabel, row.items[0].accessibilityLabel);
    }
  }
});

test('only Android reader-off keeps the outer render window attached for adjacent row entry', () => {
  for (const [os, reader, expected] of [['android', false, false], ['android', true, undefined],
    ['android', null, undefined], ['ios', false, undefined]]) {
    const f = fixture(undefined, true, os, reader);
    f.render(options); f.accept(); f.render(options);
    const outer = list(f.render(options)).props;
    assert.equal(outer.removeClippedSubviews, expected);
    assert.equal(outer.windowSize, 3);
    const inner = outer.renderItem({item: outer.data[0]}).props.children.find(child => typeof child?.type === 'function');
    assert.equal(inner.type(inner.props).props.removeClippedSubviews, undefined);
  }
});

test('pinned two-card rows reserve a trailing viewport slot without adding a focus target', () => {
  for (const os of ['android', 'ios']) {
    const f = fixture(undefined, true, os);
    const items = ['a', 'b'].map(occurrenceKey => ({occurrenceKey, accessibilityLabel: occurrenceKey}));
    const props = {...options, horizontalAlignment: 'pinned', viewportExtent: 500, itemExtent: 120,
      rails: [{id: 'short', items}]};
    f.render(props); f.accept(); f.render(props);
    const outer = list(f.render(props)).props;
    const inner = outer.renderItem({item: outer.data[0]}).props.children.find(child => typeof child?.type === 'function');
    const flat = inner.type(inner.props).props;
    assert.equal(flat.contentContainerStyle.paddingEnd, 380);
    assert.equal(flat.scrollEnabled, os === 'ios' ? false : undefined);
    assert.notEqual(outer.scrollEnabled, false);
    assert.equal(flat.data.length, 2);
    assert.equal(f.nodes()[1].horizontalAlignment, 'pinned');
    assert.equal(f.nodes().filter(node => !node.scope).length, 2);
  }
});

test('only Android pinned horizontal windows keep the previous native card attached while the reader is off', () => {
  for (const [os, reader, alignment, horizontal, expected] of [
    ['android', false, 'pinned', true, false], ['android', true, 'pinned', true, undefined],
    ['android', null, 'pinned', true, undefined], ['android', false, 'leading', true, undefined],
    ['android', false, 'nearest', true, undefined], ['android', false, 'pinned', false, undefined],
    ['ios', false, 'pinned', true, undefined],
  ]) {
    const f = fixture(undefined, true, os, reader);
    const linear = {id: 'items', data: options.rails[0].items, itemExtent: 120, viewportExtent: 500,
      horizontal, horizontalAlignment: alignment};
    f.renderList(linear); f.accept(); f.renderList(linear);
    const itemList = list(f.renderList(linear));
    const flat = itemList.type(itemList.props).props;
    assert.equal(flat.removeClippedSubviews, expected);
    assert.equal(flat.windowSize, 3);
    if (horizontal) {
      const g = fixture(undefined, true, os, reader);
      const rails = {...options, horizontalAlignment: alignment};
      g.render(rails); g.accept(); g.render(rails);
      const outer = list(g.render(rails)).props;
      const inner = outer.renderItem({item: outer.data[0]}).props.children.find(child => typeof child?.type === 'function');
      const row = inner.type(inner.props).props;
      assert.equal(row.removeClippedSubviews, expected);
      assert.equal(row.windowSize, 3);
    }
  }
});

test('invalid host offset metadata cannot publish a replacement collection', () => {
  const store = new CollectionStore('test', () => {});
  const owner = {};
  const node = {key: 'list', parent: '', order: 0, scope: true, enabled: true, layout: 2, extent: 420, leadingExtent: 624};
  store.publish(owner, [node]);
  const accepted = store.snapshot();
  for (const leadingExtent of [-1, NaN, Infinity, 1000001]) {
    assert.throws(() => store.publish(owner, [{...node, leadingExtent}]), /leading extent/);
    assert.equal(store.snapshot(), accepted);
  }
  assert.throws(() => store.publish(owner, [{...node, scope: false}]), /leading extent/);
});

test('entering content scrolls Hero fully away while preserving deeper offsets', () => {
  assert.equal(headerScrollOffset(624, 0, false), 624);
  assert.equal(headerScrollOffset(624, 1044, false), 1044);
  assert.equal(headerScrollOffset(624, 1044, true), 0);
  const f = fixture({kind: 'managed', occurrenceKey: 'film'});
  const rails = {...options, listHeader: {}, listHeaderExtent: 624, listHeaderScope: 'hero-actions',
    listHeaderItems: [{occurrenceKey: 'explore', accessibilityLabel: 'Explore'}]};
  const props = list(f.render(rails)).props;
  const calls = [];
  props.ref.current = {scrollToOffset: command => calls.push(command)};
  props.onScroll({nativeEvent: {contentOffset: {y: 200}}});
  f.prepare({request: 'pending'});
  f.render(rails);
  f.flush();
  assert.equal(calls.length, 0, 'must wait for native reveal preparation to release');
  f.prepare(null);
  f.render(rails);
  f.flush();
  assert.deepEqual(plain(calls), [{offset: 624, animated: false}]);
  props.onScroll({nativeEvent: {contentOffset: {y: 1044}}});
  f.flush();
  assert.equal(calls.length, 1, 'rerenders must retain the current catalogue viewport');
});

test('confirmed Hero focus returns its scrolling row to the top', () => {
  const f = fixture({kind: 'managed', occurrenceKey: 'explore'});
  const props = list(f.render({...options, listHeader: {}, listHeaderExtent: 624, listHeaderScope: 'hero-actions',
    listHeaderItems: [{occurrenceKey: 'explore', accessibilityLabel: 'Explore'}]})).props;
  const calls = [];
  props.ref.current = {scrollToOffset: command => calls.push(command)};
  props.onScroll({nativeEvent: {contentOffset: {y: 1044}}});
  f.flush();
  assert.deepEqual(plain(calls), [{offset: 0, animated: false}]);
});

test('horizontal alignment publishes only row metadata and retains accepted cells during a policy change', () => {
  const f = fixture(undefined, true, 'android');
  f.render(options); f.accept(); f.render(options); f.render(options);
  assert.equal(f.nodes()[1].horizontalAlignment, 'nearest');
  const leading = {...options, horizontalAlignment: 'leading'};
  assert.equal(f.render(leading).props.value, '1');
  assert.equal(f.nodes()[1].horizontalAlignment, 'leading');
  assert.equal(f.nodes()[0].horizontalAlignment, undefined);
  f.accept(); f.render(leading);
  assert.equal(f.render(leading).props.value, '2');
  assert.throws(() => f.render({...options, horizontalAlignment: 'center'}), /horizontalAlignment/);
});

test('horizontal offsets clamp bounds, partial final cells and RTL without changing selection', () => {
  const {horizontalScrollOffset: offset} = require('../packages/itar/lib/api/viewport');
  assert.equal(offset(400,800,0,300,1000,'nearest'),400); // An oversized cell must not hide its leading target.
  assert.equal(offset(400,500,100,300,1000,'leading'),400);
  assert.equal(offset(400,500,100,300,1000,'nearest'),200);
  assert.equal(offset(400,500,300,300,1000,'nearest'),300);
  assert.equal(offset(900,1000,300,350,1000,'leading'),650);
  assert.equal(offset(100,200,0,300,1000,'leading',true),0);
  assert.equal(offset(500,600,700,300,1000,'leading',true),300);
  assert.equal(offset(0,100,0,300,200,'leading'),0);
  assert.equal(offset(900,1000,300,300,1500,'leading'),900); // Appended page changes the clamp, not identity.
});

test('composed rails render lazily inside the same host and retain the native commit handshake', () => {
  const calls = [], f = fixture(undefined, true, 'android');
  const renderItem = (item, index) => { calls.push([item.occurrenceKey, index]); return {type: 'MovieCard', key: item.occurrenceKey}; };
  const initial = {...options, renderItem};
  f.render(initial); f.accept(); f.render(initial);
  const accepted = f.render(initial);
  const outer = list(accepted).props;
  const row = outer.renderItem({item: outer.data[0]});
  const inner = row.props.children.find(child => typeof child?.type === 'function');
  const flat = inner.type(inner.props).props;
  assert.equal(calls.length, 0, 'logical publication must not eagerly render the catalogue');
  const item = flat.data[0], target = flat.renderItem({item, index: 0});
  assert.equal(target.type, 'Focusable');
  assert.equal(target.props.occurrenceKey, item.occurrenceKey);
  assert.deepEqual(calls, [['film', 0]]);
  assert.equal(target.props.children[0].type, 'MovieCard');
  const step = {request: '9', effect: '10', step: 0, key: nativeTargetKey('film'), path: [{collection: inner.props.collection}], source: []};
  f.prepare(step);
  const cell = flat.CellRendererComponent({children: target, item, style: {width: 300}});
  assert.equal(f.commits().length, 0);
  cell.props.children[1].props.onLayout();
  assert.equal(f.commits()[0].key, nativeTargetKey('film'));
  const changed = {...initial, renderItem: () => ({type: 'ReplacementVisual'})};
  f.render(changed); const updated = f.render(changed);
  assert.equal(updated.props.value, accepted.props.value, 'a renderer update must not publish another logical dataset');
  const content = tree => {
    const props = list(tree).props;
    const renderedRow = props.renderItem({item: props.data[0]});
    const itemList = renderedRow.props.children.find(child => typeof child?.type === 'function');
    const renderedList = itemList.type(itemList.props).props;
    return renderedList.renderItem({item: renderedList.data[0], index: 0}).props.children[0].type;
  };
  assert.equal(content(updated), 'ReplacementVisual');
  const replacement = {...changed, rails: [{id: 'new-row', items: options.rails[0].items}], renderItem: () => ({type: 'NewDatasetVisual'})};
  assert.equal(content(f.render(replacement)), 'ReplacementVisual', 'pending data must keep its accepted renderer');
  f.accept(); f.render(replacement);
  assert.equal(content(f.render(replacement)), 'NewDatasetVisual');
});

test('linear list renderer and item children remain content of the collection-owned host', () => {
  for (const horizontal of [true, false]) {
    const f = fixture(undefined, true, 'ios');
    const renderItem = (item, index) => ({type: 'Visual', key: item.occurrenceKey, index});
    const props = {id: 'items', data: options.rails[0].items, itemExtent: 160, viewportExtent: 640, horizontal, renderItem};
    f.renderList(props); f.accept(); f.renderList(props);
    const scope = f.renderList(props).props.children[0];
    const inner = scope.props.children[0];
    const flat = inner.type(inner.props).props;
    const target = flat.renderItem({item: props.data[0], index: 0});
    assert.equal(target.props.children[0].index, 0);
    assert.equal(target.props.order, 0);
    assert.equal(flat.windowSize, 3);
    assert.equal(flat.getItemLayout(null, 30).offset, 4800);
    assert.equal(inner.type({...inner.props, renderItem: () => null}).props.renderItem({item: props.data[0], index: 0}).props.children[0], null);
    const child = {type: 'DefaultVisual'};
    assert.equal(inner.type({...inner.props, renderItem: undefined}).props.renderItem({item: {...props.data[0], children: child}, index: 0}).props.children[0], child);
  }
});

test('a standalone list sizes its viewport and its items independently on either axis', () => {
  for (const horizontal of [true, false]) {
    const mainAxis = horizontal ? 'width' : 'height';
    const crossAxis = horizontal ? 'height' : 'width';
    const f = fixture(undefined, true, 'android');
    const props = {id: 'items', data: options.rails[0].items, horizontal, viewportExtent: 640,
      crossExtent: 210, itemExtent: 160, itemStyle: {[crossAxis]: 140}};
    f.renderList(props); f.accept(); f.renderList(props);
    const inner = list(f.renderList(props));
    const flat = inner.type(inner.props).props;
    assert.deepEqual(Object.assign({}, ...flat.style), {[mainAxis]: 640, [crossAxis]: 210});
    const target = flat.renderItem({item: props.data[0], index: 0});
    assert.deepEqual(Object.assign({}, ...target.props.style), {[mainAxis]: 160, [crossAxis]: 140});
  }
});

test('a standalone list rejects invalid cross extents before publishing its data', () => {
  const f = fixture();
  const props = {id: 'items', data: options.rails[0].items, itemExtent: 160, viewportExtent: 640};
  for (const crossExtent of [0, -1, NaN, Infinity, 1000001]) {
    assert.throws(() => f.renderList({...props, crossExtent}), /List extents/);
  }
  assert.equal(f.nodes(), undefined);
});
