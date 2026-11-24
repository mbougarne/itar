// Embed the engine so packaged TV apps work from local URLs without fetching a sidecar.
const path = require('node:path');
const {execFileSync} = require('node:child_process');
const esbuild = require('esbuild');

const adapter = path.resolve(__dirname, '../web-runtime');
execFileSync(process.execPath, [path.join(adapter, 'engine/build.cjs')], {stdio: ['ignore', 2, 2]});
esbuild.buildSync({
  entryPoints: [path.join(adapter, 'focus.tsx')],
  outfile: path.join(__dirname, '../lib/web.mjs'),
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: 'chrome85',
  alias: {'react-native': 'react-native-web'},
  external: ['react', 'react-native-web'],
  define: {'import.meta.url': 'document.baseURI'},
  loader: {'.wasm': 'binary'},
  minify: true,
});
