const assert = require('node:assert/strict');
const {realpathSync} = require('node:fs');
const path = require('node:path');
const {test} = require('node:test');
const root = path.resolve(__dirname, '..');
test('the library workspace resolves its own built package', () => {
  const entry = require.resolve('@bougarnem/itar', {paths: [root]});
  assert.equal(realpathSync(entry), path.join(realpathSync(root), 'packages/itar/lib/index.js'));
  assert.deepEqual(require(entry), {packageStage: 'foundation-shell'});
});
test('the native test host uses the pinned TV fork and matching React', () => {
  const from = {paths: [root]};
  const rn = require(require.resolve('react-native/package.json', from));
  assert.equal(rn.name, 'react-native-tvos');
  assert.equal(rn.version, '0.83.0-0');
  assert.equal(require(require.resolve('react/package.json', from)).version, '19.2.0');
});
