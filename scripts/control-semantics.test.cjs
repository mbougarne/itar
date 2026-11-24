const {test} = require('node:test');
const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const {renderToStaticMarkup} = require('react-dom/server');
const web = require('react-native-web');

function load(file, imports) {
  const {outputText} = ts.transpileModule(readFileSync(path.join(__dirname, '..', file), 'utf8'), {
    compilerOptions: {module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true},
  });
  const module = {exports: {}};
  vm.runInNewContext(outputText, {module, exports: module.exports, require: imports, __DEV__: false});
  return module.exports;
}
const types = load('packages/itar/src/api/types.ts');
const {FocusStore} = load('packages/itar/src/api/store.ts', () => types);

function fixture(platform) {
  const native = platform !== 'web';
  const store = native ? new FocusStore({focus() {}, restore() {}, cancel() {}, showDialog() {}, dismissDialog() {}}, true) :
    {mountId: (() => { let id = 0; return () => ++id; })(), register: () => () => {}, update() {}, lifetime: 'web'};
  const common = native ? {provider: store.provider, lifetime: '1'} : {};
  if (native) { store.activate(); store.surface({...common, state: 'ready', sequence: '1'}); }
  const memos = [], refs = [], effects = [];
  let memoIndex = 0, refIndex = 0, effectIndex = 0;
  const changed = (previous, deps) => !previous || deps.some((value, index) => !Object.is(value, previous.deps[index]));
  const react = {...React, createContext: value => ({value}), memo: value => value,
    useContext: context => context.value === null ? store : context.value,
    useMemo: (callback, deps) => {
      const i = memoIndex++;
      if (changed(memos[i], deps)) { memos[i] = {deps, value: callback()}; }
      return memos[i].value;
    },
    useRef: value => { const i = refIndex++; refs[i] ||= {current: value}; return refs[i]; },
    useLayoutEffect: (callback, deps) => {
      const i = effectIndex++;
      if (changed(effects[i], deps)) { effects[i]?.cleanup?.(); effects[i] = {deps, cleanup: callback()}; }
    },
  };
  const contexts = load('packages/itar/src/api/contexts.ts', () => react);
  const component = load(native ? 'packages/itar/src/react.tsx' : 'packages/itar/web-runtime/Focusable.tsx', name => {
    if (name === 'react') { return react; }
    if (name === 'react-native') { return {...web, Platform: {OS: platform, isTV: true}}; }
    if (name.endsWith('/types')) { return types; }
    if (name === './api/store') { return {FocusStore}; }
    if (name.endsWith('/api/contexts')) { return contexts; }
    if (name === './specs/ItarTargetNativeComponent') { return {__esModule: true, default: 'NativeTarget'}; }
    if (name === './focus-context') { return {useWebStore: () => store, WebScopeContext: {value: {key: '', active: true}}}; }
    if (name === './focus-store') { return {createNode: key => ({key})}; }
    return {};
  }).Focusable;
  return {render: props => { memoIndex = refIndex = effectIndex = 0; return component(props); }, common};
}

test('Android forwards checked updates, explicitly clears reused semantics and deduplicates activation', () => {
  const f = fixture('android');
  let clicks = 0;
  const props = {occurrenceKey: 'toggle', accessibilityLabel: 'White focus accent', onPress: () => clicks++};
  let node = f.render({...props, accessibilityRole: 'switch', accessibilityState: {checked: false}});
  assert.equal(node.props.accessibilityRole, 'switch');
  assert.equal(node.props.accessibilityState.checked, false);
  const record = {...f.common, occurrenceKey: types.nativeTargetKey('toggle'), registration: node.props.registrationId,
    mount: '1', sequence: '1', source: 'accessibility'};
  node.props.onActivate({nativeEvent: record}); node.props.onActivate({nativeEvent: record});
  assert.equal(clicks, 1);
  node = f.render({...props, accessibilityRole: 'switch', accessibilityState: {checked: true}});
  assert.equal(node.props.accessibilityState.checked, true);
  node = f.render({...props, accessibilityRole: 'button'});
  assert.equal(JSON.stringify(node.props.accessibilityState), '{}');
  node = f.render({...props, onAdjust() {}});
  assert.equal(node.props.accessibilityRole, undefined, 'default props must not replace the native adjustable role');
  assert.equal(node.props.adjustable, true);
  node = f.render({...props, enabled: false});
  node.props.onActivate({nativeEvent: {...record, sequence: '2'}});
  assert.equal(clicks, 1);
});

test('web renders real DOM switch state, clears it for a button and activates once', () => {
  const f = fixture('web');
  let clicks = 0;
  const props = {occurrenceKey: 'toggle', accessibilityLabel: 'White focus accent', onPress: () => clicks++};
  for (const checked of [false, true]) {
    const node = f.render({...props, accessibilityRole: 'switch', accessibilityState: {checked}});
    const markup = renderToStaticMarkup(node);
    assert.match(markup, /role="switch"/);
    assert.match(markup, new RegExp(`aria-checked="${checked}"`));
  }
  const button = f.render({...props, displayLabel: '▶  Play demo'});
  const markup = renderToStaticMarkup(button);
  assert.match(markup, /role="button"/); assert.doesNotMatch(markup, /aria-checked/);
  button.props.onPress(); assert.equal(clicks, 1);
  f.render({...props, enabled: false}).props.onPress(); assert.equal(clicks, 1);
});

test('Apple keeps its existing host semantics and incomplete switches are rejected', () => {
  const props = {occurrenceKey: 'toggle', accessibilityLabel: 'Toggle', accessibilityRole: 'switch'};
  const node = fixture('ios').render({...props, accessibilityState: {checked: true}});
  assert.equal(node.props.accessibilityRole, undefined);
  assert.equal(node.props.accessibilityState, undefined);
  for (const platform of ['android', 'web']) {
    assert.throws(() => fixture(platform).render(props), /Boolean checked state/);
    for (const accessibilityRole of ['button', 'switch']) {
      assert.throws(() => fixture(platform).render({...props, accessibilityRole,
        accessibilityState: {checked: true}, onAdjust() {}}), /retain their native role/);
    }
  }
});
