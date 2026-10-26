const path = require('node:path');
const {realpathSync} = require('node:fs');
const {getDefaultConfig, mergeConfig} = require('@react-native/metro-config');
const root = path.resolve(__dirname, '../..');
const dependencies = realpathSync(path.join(root, 'node_modules'));
module.exports = mergeConfig(getDefaultConfig(__dirname), {
  watchFolders: [root, dependencies],
  resolver: {nodeModulesPaths: [dependencies]},
});
