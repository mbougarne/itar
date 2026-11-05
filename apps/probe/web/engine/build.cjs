/* eslint-env node, es2022 */
const { existsSync, readFileSync } = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '../../../..');
const sdk = process.env.EMSDK || path.join(root, 'build/emsdk');
const emcmake = path.join(sdk, 'upstream/emscripten/emcmake');

if (!existsSync(emcmake)) {
  throw new Error(
    'Install Emscripten 6.0.13 first; see docs/probe-web-engine.md. Set EMSDK for a different install path.',
  );
}

const env = { ...process.env, EM_CONFIG: path.join(sdk, '.emscripten') };

// Respect activation's SDK-local Python without changing the caller's shell.
if (!env.EMSDK_PYTHON && existsSync(env.EM_CONFIG)) {
  const python = /^PYTHON = '([^']+)'$/m.exec(
    readFileSync(env.EM_CONFIG, 'utf8'),
  )?.[1];

  if (python) {
    env.EMSDK_PYTHON = python.replace('$CFGDIR', sdk);
  }
}

const source = path.join(root, 'apps/probe/web/engine');
const out = path.join(root, 'build/web-engine');

const run = (cmd, args) =>
  execFileSync(cmd, args, { cwd: root, env, stdio: 'inherit' });

const version = execFileSync(
  path.join(sdk, 'upstream/emscripten/emcc'),
  ['--version'],
  { env, encoding: 'utf8' },
);

if (!/\b6\.0\.13\b/.test(version)) {
  throw new Error(
    'This probe pins Emscripten 6.0.13; compiler version differs.',
  );
}

run(emcmake, [
  'cmake',
  '-S',
  source,
  '-B',
  out,
  '-G',
  'Unix Makefiles',
  '-DCMAKE_BUILD_TYPE=Release',
]);

run('cmake', ['--build', out, '--target', 'itar_web', '--parallel', '1']);
