module.exports = {
  root: true,
  extends: '@react-native',
  parserOptions: {babelOptions: {configFile: require.resolve('./apps/probe/babel.config.js')}},
  ignorePatterns: ['**/android/**', '**/ios/**', '**/lib/**'],
};
