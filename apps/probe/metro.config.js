const path = require('node:path');
const {getDefaultConfig, mergeConfig} = require('@react-native/metro-config');
const defaults = getDefaultConfig(__dirname);
module.exports = mergeConfig(defaults, {
  watchFolders: [path.resolve(__dirname, '../..')],
  resolver: {
    // Environment files belong to a server/proxy, never the mobile dependency graph.
    blockList: [].concat(defaults.resolver.blockList ?? [], /[/\\]\.env(?:\.[^/\\]*)?$/),
  },
});
