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
function fixture(focus = {kind: 'unknown', occurrenceKey: null}) {
  let published;
  const effects = [];
  const snapshot = {dataset: '1', accepted: '1', preparation: null};
  const store = {
    subscribe: () => () => {}, snapshot: () => snapshot,
    publish: (_owner, nodes) => { published = nodes; return '1'; },
    remove: () => {}, regions: () => [],
  };
  const contexts = {ScopeContext: {path: ['home'], key: nativeScopeKey(['home']), active: true},
    CollectionContext: store, CollectionDatasetContext: {Provider: 'Dataset'}};
  const react = {
    createElement: (type, props, ...children) => ({type, props: {...props, children}}),
    memo: value => value, useContext: context => context, useMemo: callback => callback(),
    useRef: value => ({current: value}), useState: value => [typeof value === 'function' ? value() : value, () => {}],
    useSyncExternalStore: (_subscribe, read) => read(), useLayoutEffect: callback => callback(), useEffect: callback => effects.push(callback),
  };
  const output = ts.transpileModule(readFileSync(path.join(__dirname, '../packages/itar/src/virtualized.tsx'), 'utf8'), {
    compilerOptions: {module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true},
  }).outputText;
  const module = {exports: {}};
  vm.runInNewContext(output, {module, exports: module.exports, require: name => {
    if (name === 'react') { return react; }
    if (name === 'react-native') { return {FlatList: 'FlatList', View: 'View', Platform: {OS: 'web'}, StyleSheet: {create: value => value}}; }
    if (name === './api/contexts') { return contexts; }
    if (name === './api/types') { return {nativeScopeKey, nativeTargetKey}; }
    if (name === './api/viewport') { return {headerScrollOffset}; }
    if (name === './react') { return {Focusable: 'Focusable', FocusScope: 'FocusScope', useFocusState: () => focus}; }
    throw new Error(`Unexpected import ${name}`);
  }});
  return {render: props => module.exports.FocusVirtualizedRails(props), nodes: () => published,
    flush: () => effects.forEach(callback => callback()), prepare: value => { snapshot.preparation = value; }};
}
const options = {
  id: 'catalogue', rowExtent: 420, itemExtent: 300, viewportExtent: 1200,
  rails: [{id: 'popular', items: [{occurrenceKey: 'film', accessibilityLabel: 'Film'}]}],
};
const list = tree => tree.props.children[0].props.children[0];
const plain = value => JSON.parse(JSON.stringify(value));

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
  const props = list(f.render({...options, listHeader: {}, listHeaderExtent: 624, listHeaderScope: 'hero-actions',
    listHeaderItems: [{occurrenceKey: 'explore', accessibilityLabel: 'Explore'}]})).props;
  const calls = [];
  props.ref.current = {scrollToOffset: command => calls.push(command)};
  props.onScroll({nativeEvent: {contentOffset: {y: 200}}});
  f.prepare({request: 'pending'});
  f.flush();
  assert.equal(calls.length, 0, 'must wait for native reveal preparation to release');
  f.prepare(null);
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
