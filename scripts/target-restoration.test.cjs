const {test} = require('node:test');
const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function load(file, imports) {
  const {outputText} = ts.transpileModule(readFileSync(path.join(__dirname, '..', file), 'utf8'), {
    compilerOptions: {module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true},
  });
  const module = {exports: {}};
  vm.runInNewContext(outputText, {module, exports: module.exports, require: imports});
  return module.exports;
}
const types = load('packages/itar/src/api/types.ts');
const {FocusStore} = load('packages/itar/src/api/store.ts', () => types);
function fixture() {
  const calls = [];
  const store = new FocusStore({focus: () => assert.fail('restoration used generic focus'),
    restore: (key, command) => calls.push({key, command}), cancel: command => calls.push({cancel: command})});
  store.activate();
  const common = {provider: store.provider, lifetime: '1'};
  store.surface({...common, sequence: '1', state: 'ready'});
  return {store, calls, receipt: (request, id, status) => store.receipt({...common, sequence: '2',
    command: request.command, request: id, status})};
}
function commands(file, store) {
  return load(file, name => {
    if (name === 'react') { return {createContext: value => value, memo: value => value,
      useContext: value => value === null ? store : value, useMemo: callback => callback()}; }
    if (name === 'react-native') { return {Platform: {OS: 'android', isTV: true}, StyleSheet: {create: value => value}}; }
    if (name.endsWith('/types')) { return types; }
    if (name === './focus-context') { return {useWebStore: () => store, WebScopeContext: {path: []}}; }
    if (name === './api/contexts') { return {ScopeContext: {path: []}}; }
    if (name === './api/store') { return {FocusStore}; }
    return {};
  }).useFocusCommands();
}

test('keyed restoration uses target transport and requires exact native confirmation', async () => {
  const f = fixture();
  const api = commands('packages/itar/src/react.tsx', f.store);
  const key = types.occurrenceKey('search', 'rail', 'movie');
  const request = api.restoreFocusByKey(key);
  assert.deepEqual(f.calls, [{key: types.nativeTargetKey(key), command: request.command}]);
  let settled = false;
  request.result.then(() => { settled = true; });
  f.receipt(request, '41', 'started'); f.receipt(request, '42', 'confirmed');
  await Promise.resolve(); assert.equal(settled, false);
  f.receipt(request, '41', 'confirmed');
  assert.equal((await request.result).status, 'applied');
  assert.equal(f.store.snapshot('input').kind, 'unknown', 'a request result does not invent observed focus');
  const cancelled = api.restoreFocusByKey(key);
  f.receipt(cancelled, '43', 'started'); cancelled.cancel();
  assert.deepEqual(f.calls.at(-1), {cancel: cancelled.command});
  f.receipt(cancelled, '43', 'cancelled');
  assert.equal((await cancelled.result).status, 'cancelled');
});

test('keyed restoration preserves target eligibility and native unavailability', async () => {
  const f = fixture();
  const api = commands('packages/itar/src/react.tsx', f.store);
  f.store.register('inactive', {}, 'i', true, false);
  f.store.register('disabled', {}, 'd', false, true);
  assert.equal((await api.restoreFocusByKey('inactive').result).reason, 'inactive');
  assert.equal((await api.restoreFocusByKey('disabled').result).reason, 'disabled');
  f.store.setEnabled(false);
  assert.equal((await api.restoreFocusByKey('other').result).reason, 'inactive');
  assert.equal(f.calls.length, 0);
  f.store.setEnabled(true);
  const unknown = api.restoreFocusByKey('unknown');
  f.receipt(unknown, '0', 'unavailable');
  assert.equal((await unknown.result).status, 'unavailable');
});

test('web exposes keyed restoration without substituting generic focus for rejection', async () => {
  const calls = [];
  const unavailable = {command: 'web', result: Promise.resolve({status: 'unavailable'}), cancel() {}};
  const api = commands('apps/probe/web/focus-hooks.ts', {request: (key, restore) => {
    calls.push({key, restore}); return unavailable;
  }});
  const request = api.restoreFocusByKey('opener');
  assert.equal(request, unavailable);
  assert.equal((await request.result).status, 'unavailable');
  assert.deepEqual(calls, [{key: types.nativeTargetKey('opener'), restore: true}]);
});
