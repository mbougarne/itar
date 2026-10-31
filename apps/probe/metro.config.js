const path = require('node:path');
const { realpathSync } = require('node:fs');
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');
const defaults = getDefaultConfig(__dirname);
const root = path.resolve(__dirname, '../..');
const dependencies = realpathSync(path.join(root, 'node_modules'));

module.exports = mergeConfig(defaults, {
  watchFolders: [root, dependencies],
  resolver: {
    nodeModulesPaths: [dependencies],
    // Environment files belong to a server/proxy, never the mobile dependency graph.
    blockList: [].concat(
      defaults.resolver.blockList ?? [],
      /[/\\]\.env(?:\.[^/\\]*)?$/,
    ),
  },
});
