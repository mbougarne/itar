module.exports = {
  root: true,
  extends: '@react-native',
  parserOptions: {babelOptions: {configFile: require.resolve('./probes/consumer/babel.config.js')}},
  ignorePatterns: ['**/android/**', '**/ios/**', '**/lib/**'],
  overrides: [{
    files: ['scripts/*.cjs'],
    env: {node: true, es2022: true},
    parserOptions: {ecmaVersion: 2022, sourceType: 'script'},
  }],
};
