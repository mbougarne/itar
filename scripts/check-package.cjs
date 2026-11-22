// Bounded, local-only tarball/consumer check. Output stays below caller's directory.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {execFileSync} = require('node:child_process');
const root = path.resolve(__dirname, '..');
const out = path.resolve(process.argv[2] || path.join(path.dirname(root), `${path.basename(root)}-artifacts`, 'package-check'));
fs.mkdirSync(out, {recursive: true});
const run = (command, args, cwd = root) => execFileSync(command, args,
  {cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env: {...process.env, npm_config_cache: path.join(out, 'npm-cache')}});
const [packed] = JSON.parse(run('npm', ['pack', '--workspace', 'itar', '--json', '--pack-destination', out]));
const files = new Set(packed.files.map(file => file.path));
for (const file of ['LICENSE', 'lib/index.js', 'lib/react.d.ts', 'src/specs/ItarTargetNativeComponent.ts',
  'cpp/CMakeLists.txt', 'cpp/src/registry.cpp', 'cpp/include/itar/transaction.hpp',
  'apple/ItarEngine.h', 'apple/ItarEngine.cpp', 'ItarEngineCore.podspec', 'ItarEngineNative.podspec', 'itar.podspec',
  'android/CMakeLists.txt', 'android/build.gradle']) { assert(files.has(file), `missing ${file}`); }
assert(![...files].some(file => /(?:node_modules|\.cxx|\.gradle|build)\//.test(file)));
const consumer = fs.mkdtempSync(path.join(out, 'consumer-'));
fs.writeFileSync(path.join(consumer, 'package.json'), '{"name":"itar-local-consumer","version":"0.0.0","private":true}');
run('npm', ['install', '--ignore-scripts', '--omit=peer', '--legacy-peer-deps', '--no-audit', '--no-fund', path.join(out, packed.filename)], consumer);
const installed = path.join(consumer, 'node_modules/itar');
assert(!fs.lstatSync(installed).isSymbolicLink());
const manifest = JSON.parse(fs.readFileSync(path.join(installed, 'package.json'), 'utf8'));
for (const [entry, conditions] of Object.entries(manifest.exports)) {
  const targets = typeof conditions === 'string' ? [conditions] : Object.values(conditions);
  for (const target of targets) {
    assert(target.startsWith('./'), `nonlocal export ${entry}: ${target}`);
    assert(fs.statSync(path.join(installed, target)).isFile(), `missing export ${entry}: ${target}`);
  }
  const specifier = entry === '.' ? 'itar' : `itar/${entry.slice(2)}`;
  const resolved = run(process.execPath, ['-p', `require.resolve(${JSON.stringify(specifier)})`], consumer).trim();
  assert(resolved.startsWith(installed + path.sep), `export escaped installed package: ${entry}`);
}
assert.deepEqual(require(path.join(installed, 'lib/index.js')), {packageStage: 'foundation-shell'});
for (const entry of ['react', 'android', 'apple']) {
  assert(fs.existsSync(path.join(installed, `lib/${entry}.js`)));
  assert(fs.existsSync(path.join(installed, `lib/${entry}.d.ts`)));
}
// Resolve Itar exclusively from the installed archive. Supply the browser peers
// from this checkout so the check also works offline.
fs.copyFileSync(path.join(__dirname, 'package-web-smoke.tsx'), path.join(consumer, 'web.tsx'));
const typeRoot = path.join(consumer, 'node_modules/@types');
fs.mkdirSync(typeRoot, {recursive: true});
for (const peer of ['react', 'react-dom']) {
  fs.symlinkSync(path.dirname(require.resolve(`@types/${peer}/package.json`)), path.join(typeRoot, peer), 'dir');
}
run(process.execPath, [require.resolve('typescript/bin/tsc'), '--strict', '--noEmit',
  '--lib', 'es2022,dom', '--jsx', 'react-jsx', '--module', 'esnext', '--moduleResolution', 'bundler',
  '--types', 'react,react-dom', 'web.tsx'], consumer);
const bundle = require('esbuild').buildSync({
  absWorkingDir: consumer,
  entryPoints: ['web.tsx'],
  outfile: 'web.js',
  nodePaths: [path.join(root, 'node_modules')],
  bundle: true,
  metafile: true,
  define: {'process.env.NODE_ENV': '"development"'},
});
const inputs = Object.keys(bundle.metafile.inputs);
assert(inputs.includes('node_modules/itar/lib/web.mjs'));
assert(inputs.includes('node_modules/itar/web/focus.css'));
assert(!inputs.some(input => /node_modules\/react-native\//.test(input)));
fs.writeFileSync(path.join(consumer, 'index.html'),
  '<!doctype html><link rel="stylesheet" href="./web.css"><div id="root"></div><script src="./web.js"></script>');
if (process.env.ITAR_CHROME) {
  const page = require('node:url').pathToFileURL(path.join(consumer, 'index.html'));
  const dom = run(process.env.ITAR_CHROME, ['--headless', '--disable-gpu', '--disable-dev-shm-usage',
    '--no-first-run', '--user-data-dir=' + path.join(consumer, 'chrome-profile'),
    '--virtual-time-budget=10000', '--dump-dom', page.href + '#smoke'], consumer);
  assert(dom.includes('<title>Second applied</title>'), 'packed Chrome consumer failed to move, activate and restore focus');
}
fs.writeFileSync(path.join(consumer, 'main.cpp'), `#include <itar/transaction.hpp>
#include "ItarEngine.h"
int main() {
  itar::State state{itar::SurfaceId{1}};
  itar::Transactions tx{state, itar::SurfaceLifetime{1}};
  tx.dispose();
  ItarCallStatus status = ITAR_INVALID;
  auto* engine = itar_engine_create(1, 1, 8, &status);
  if (!engine || status != ITAR_OK) { return 1; }
  if (itar_engine_dispose(engine, 1) != ITAR_OK) { return 2; }
  return itar_engine_destroy(engine) == ITAR_OK && !tx.active() ? 0 : 3;
}
`);
fs.writeFileSync(path.join(consumer, 'CMakeLists.txt'), `cmake_minimum_required(VERSION 3.20)
project(consumer LANGUAGES CXX)
find_package(Threads REQUIRED)
add_subdirectory(node_modules/itar/cpp core)
add_executable(smoke main.cpp node_modules/itar/apple/ItarEngine.cpp)
target_include_directories(smoke PRIVATE node_modules/itar/apple)
target_link_libraries(smoke PRIVATE itar::core Threads::Threads)
`);
run('cmake', ['-S', consumer, '-B', path.join(consumer, 'build'), '-DCMAKE_BUILD_TYPE=Release'], consumer);
run('cmake', ['--build', path.join(consumer, 'build'), '--parallel', '1'], consumer);
run(path.join(consumer, 'build/smoke'), [], consumer);
const report = {artifact: packed.filename, integrity: packed.integrity, shasum: packed.shasum,
  files: [...files].sort(), consumer, result: 'tarball install, web consumer bundle, JS exports and portable C++/Apple facade compile pass',
  chrome: process.env.ITAR_CHROME ? 'Strict Mode direction, activation and keyed focus passed' : 'not run',
  nativeHostBuilds: 'NOT RUN: Android TV/tvOS consumer focus/style execution remains required'};
fs.writeFileSync(path.join(out, 'package-evidence.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
