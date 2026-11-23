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
const nodes = node => !React.isValidElement(node) ? [] : [node, ...React.Children.toArray(node.props.children).flatMap(nodes)];

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
  const component = load(native ? 'packages/itar/src/react.tsx' : 'apps/probe/web/Focusable.tsx', name => {
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

test('Cinema sidebar and icon controls keep one spoken name while presenting their own artwork', () => {
  const imports = name => {
    if (name === 'react') return React;
    if (name === 'react-native') return {View: 'View', Text: 'Text', Image: 'Image'};
    if (name === 'itar/react') return {Focusable: 'Focusable'};
    if (name.endsWith('/theme')) return {useDesign: () => ({s: {}, u: 1})};
    if (name.endsWith('/tv-accessibility')) return load('apps/probe/ott/src/tv-accessibility.ts', () => ({Platform: {OS: 'android'}}));
    if (name === './Action') return {Action};
    throw new Error('Unexpected Cinema import ' + name);
  };
  const {Action} = load('apps/probe/ott/src/components/Action.tsx', imports);
  const {SidebarButton} = load('apps/probe/ott/src/components/SidebarButton.tsx', imports);
  const {IconAction} = load('apps/probe/ott/src/components/IconAction.tsx', imports);
  const props = {id: 'nav-profile', title: 'Explorer', label: 'Explorer, switch profile', icon: 1, onPress() {}};
  for (const expanded of [false, true]) {
    const host = Action(SidebarButton({...props, expanded}).props);
    assert.equal(host.props.accessibilityLabel, props.label);
    assert.equal(nodes(host).filter(node => node.type === 'Image').length, 1);
    assert.deepEqual(nodes(host).filter(node => node.type === 'Text').map(node => node.props.children),
      expanded ? ['Explorer'] : []);
  }
  const like = Action(IconAction({id: 'like', icon: 1, label: 'Like', onPress() {}}).props);
  assert.equal(like.props.accessibilityLabel, 'Like');
  assert.equal(nodes(like).filter(node => node.type === 'Image').length, 1);
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

for (const platform of ['android', 'web', 'ios']) {
  test(`${platform} settings expose truthful Boolean controls without changing commands`, () => {
    let presses = 0, toggles = 0;
    const navigation = platform === 'web' ? {enabled: true, toggle: () => toggles++} : null;
    const Settings = load('apps/probe/ott/src/Settings.tsx', name => {
      if (name === 'react') { return {...React, useEffect() {}, useContext: context => context.value, useMemo: callback => callback(), useCallback: callback => callback, useState: () => [800, () => {}]}; }
      if (name === 'react-native') { return {Platform: {OS: platform}, Text: 'Text', View: 'View', useWindowDimensions: () => ({width: 1920})}; }
      if (name === 'itar/react') { return {occurrenceKey: types.occurrenceKey, FocusVirtualizedRails: 'Rails'}; }
      if (name === './browser-navigation') { return {BrowserNavigation: {value: navigation}}; }
      if (name === './development-settings') { return {DevelopmentSettings: {value: null}}; }
      if (name === './theme') { return {useDesign: () => ({s: {}, u: 1})}; }
      return {};
    }).Settings;
    const tree = Settings({id: 'settings', contrast: true, slow: false, armed: true, mode: 'fixture',
      onContrast: () => presses++, onSlow() {}, onArm() {}, onMode() {}});
    const items = nodes(tree).find(node => node.type === 'Rails').props.rails.map(row => row.items[0]);
    assert.equal(items.length, platform === 'web' ? 5 : 4);
    if (platform === 'web') {
      const keyboard = items[4];
      assert.equal(keyboard.accessibilityLabel, 'TV arrow-key navigation');
      assert.equal(keyboard.accessibilityRole, 'switch');
      assert.equal(keyboard.accessibilityState.checked, true);
      keyboard.onPress();
      assert.equal(toggles, 1);
    }
    items[0].onPress(); assert.equal(presses, 1);
    for (let i = 0; i < 3; i++) {
      assert.equal(items[i].accessibilityRole, platform === 'ios' ? undefined : 'switch');
      if (platform !== 'ios') { assert.equal(items[i].accessibilityState.checked, [true, false, true][i]); }
    }
    assert.equal(items[3].accessibilityRole, undefined);
    assert.equal(items[3].accessibilityLabel, 'Catalogue: Offline fixtures');
  });
}
