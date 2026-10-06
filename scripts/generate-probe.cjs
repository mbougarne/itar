// Generated native shells are disposable; authored bridge work belongs to later tickets.
const {execFileSync} = require('node:child_process');
const {cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync} = require('node:fs');
const {tmpdir} = require('node:os');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const app = path.join(root, 'apps/probe');
for (const platform of ['android', 'ios']) {
  if (existsSync(path.join(app, platform))) {
    throw new Error(`Refusing to overwrite apps/probe/${platform}; preserve any native edits first.`);
  }
}
const scratch = mkdtempSync(path.join(tmpdir(), 'itar-template-'));
try {
  const output = path.join(scratch, 'ItarProbe');
  execFileSync('npx', ['--yes', '@react-native-community/cli@20.0.0', 'init',
    'ItarProbe', '--template', '@react-native-tvos/template-tv@0.83.0-0',
    '--pm', 'npm', '--skip-install', '--skip-git-init', '--directory', output],
  {stdio: 'inherit', cwd: scratch});
  for (const platform of ['android', 'ios']) {
    cpSync(path.join(output, platform), path.join(app, platform), {recursive: true});
  }
  cpSync(path.join(app, 'Podfile.lock'), path.join(app, 'ios/Podfile.lock'));
  // The published template assumes app-local dependencies; npm workspaces hoist them.
  const settings = path.join(app, 'android/settings.gradle');
  writeFileSync(settings, readFileSync(settings, 'utf8').replaceAll('../node_modules/', '../../../node_modules/'));
  const gradle = path.join(app, 'android/app/build.gradle');
  writeFileSync(gradle, readFileSync(gradle, 'utf8').replace('react {', `react {
    reactNativeDir = file("../../../../node_modules/react-native")
    codegenDir = file("../../../../node_modules/@react-native/codegen")
    cliFile = file("../../../../node_modules/react-native/cli.js")`));
} finally {
  rmSync(scratch, {recursive: true, force: true});
}
