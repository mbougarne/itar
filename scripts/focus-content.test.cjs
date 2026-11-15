const {test} = require('node:test');
const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const vm = require('node:vm');
const React = require('react');
const {renderToStaticMarkup} = require('react-dom/server');
const ts = require('typescript');

// Real React SSR checks the public composition/prop contract; native mounting is
// exercised separately by the public RN emulator and UIKit host fixtures.
function fixture() {
  const targets = [], views = [];
  const module = {exports: {}};
  const output = ts.transpileModule(readFileSync('packages/itar/src/react.tsx','utf8'), {
    compilerOptions: {module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true},
  }).outputText;
  const host = props => React.createElement('div', null, props.children);
  vm.runInNewContext(output, {module, exports: module.exports, require(name) {
    if (name === 'react') { return React; }
    if (name === 'react-native') { return {Platform: {isTV: true, OS: 'android'}, StyleSheet: {flatten: value => value, absoluteFill: {position: 'absolute'}},
      View: props => { views.push(props); return host(props); }}; }
    if (name.includes('specs/')) { return {__esModule: true, default: name.includes('Target') ? props => { targets.push(props); return host(props); } : host, Commands: {}}; }
    if (name === './virtualized') { return {}; }
    if (name.startsWith('./api/')) { return require('../packages/itar/lib/'+name.slice(2)); }
    throw new Error(name);
  }});
  const {FocusProvider, Focusable, FocusScope} = module.exports;
  const render = (children, props = {}) => renderToStaticMarkup(React.createElement(FocusProvider, null,
    React.createElement(Focusable, {occurrenceKey: 'card', accessibilityLabel: 'A custom title', style: {width: 240, height: 140}, ...props}, children)));
  return {targets, views, render, Focusable, FocusScope};
}
test('custom content keeps outer identity, semantics, dimensions and activation forwarding', () => {
  const f = fixture(), press = () => {};
  const html = f.render(React.createElement('span', null, 'Custom card'), {onPress: press, testID: 'card', enabled: false});
  assert.match(html, /Custom card/);
  const target = f.targets[0], content = f.views[0];
  assert.equal(target.occurrenceKey, '["target","card"]');
  assert.equal(target.label, 'A custom title');
  assert.equal(target.enabled, false);
  assert.equal(target.style.width, 240);
  assert.equal(target.testID, 'card');
  assert.equal(typeof target.onActivate, 'function');
  assert.equal(content.pointerEvents, 'none');
  assert.equal(content.importantForAccessibility, 'no-hide-descendants');
  assert.equal(content.collapsable, false);
  assert.equal(f.targets.length, 1);
});
test('label-only mode remains available and nested focus declarations reject', () => {
  const f = fixture();
  f.render(null);
  assert.equal(f.targets[0].displayLabel, 'A custom title');
  assert.equal(f.views.length, 0);
  assert.throws(() => f.render(React.createElement(f.Focusable, {occurrenceKey: 'nested', accessibilityLabel: 'Nested'})), /another focus host/);
  assert.throws(() => f.render(React.createElement(f.FocusScope, {id: 'nested'})), /focus scope/);
});
