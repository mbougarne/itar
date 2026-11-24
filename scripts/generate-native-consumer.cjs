// Generate a disposable React Native test host for the library instrumentation.
const {execFileSync} = require('node:child_process');
const {cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync} = require('node:fs');
const {tmpdir} = require('node:os');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const app = path.join(root, 'build/native-consumer');
for (const platform of ['android', 'ios']) {
  if (existsSync(path.join(app, platform))) {
    throw new Error(`The generated native test host already contains ${platform}.`);
  }
}
const scratch = mkdtempSync(path.join(tmpdir(), 'itar-template-'));
try {
  const output = path.join(scratch, 'ItarProbe');
  execFileSync('npx', ['--yes', '@react-native-community/cli@20.2.0', 'init',
    'ItarProbe', '--template', '@react-native-tvos/template-tv@0.83.0-0',
    '--pm', 'npm', '--skip-install', '--skip-git-init', '--directory', output],
  {stdio: 'inherit', cwd: scratch});
  mkdirSync(app, {recursive: true});
  for (const platform of ['android', 'ios']) {
    cpSync(path.join(output, platform), path.join(app, platform), {recursive: true});
  }
  cpSync(path.join(root, 'probes/consumer'), app, {recursive: true});
  cpSync(path.join(root, 'tools/occo'), path.join(app, 'occo'), {recursive: true});
  const podfile = path.join(app, 'ios/Podfile');
  const pods = readFileSync(podfile, 'utf8');
  if (!pods.includes('  use_react_native!(')) { throw new Error('Unexpected Podfile'); }
  writeFileSync(podfile, pods.replace('  use_react_native!(',
    "  pod 'ItarProbeHost', :path => '../../..'\n  pod 'ItarEngineCore', :path => '../../..'\n  use_react_native!("));
  // Same-major fmt fix for Apple Clang 21; keep compile-time format checking.
  for (const [name, count] of [['fmt', 2], ['RCT-Folly', 1]]) {
    const spec = path.join(root, 'node_modules/react-native/third-party-podspecs', `${name}.podspec`);
    const source = readFileSync(spec, 'utf8');
    if (source.split('"11.2.0"').length === count + 1) {
      continue;
    }
    if (source.split('"11.0.2"').length !== count + 1) {
      throw new Error(`Unexpected ${name} fmt pin; review the RN dependency before adapting it.`);
    }
    writeFileSync(spec, source.replaceAll('"11.0.2"', '"11.2.0"'));
  }
  // Hermes' absolute compiler path makes Podfile.lock depend on the checkout path.
  const hermes = path.join(root, 'node_modules/react-native/sdks/hermes-engine/hermes-engine.podspec');
  const compiler = '#{hermes_compiler_path}/hermesc/osx-bin/hermesc';
  const portableCompiler = '${PODS_ROOT}/../../../../node_modules/hermes-compiler/hermesc/osx-bin/hermesc';
  const hermesSource = readFileSync(hermes, 'utf8');
  if (!hermesSource.includes(compiler) && !hermesSource.includes(portableCompiler)) {
    throw new Error('Unexpected Hermes compiler path; review the RN podspec before adapting it.');
  }
  writeFileSync(hermes, hermesSource.replace(compiler, portableCompiler));
  // SDK 27 requires a scene-owned window; keep this adaptation in the shell.
  const delegateFile = path.join(app, 'ios/ItarProbe/AppDelegate.swift');
  let delegateSource = readFileSync(delegateFile, 'utf8');
  const sceneEdits = [
    ['class AppDelegate: UIResponder, UIApplicationDelegate {', `class AppDelegate: UIResponder, UIApplicationDelegate {
  func application(_ application: UIApplication, configurationForConnecting session: UISceneSession,
                   options: UIScene.ConnectionOptions) -> UISceneConfiguration {
    let configuration = UISceneConfiguration(name: "ItarProbe", sessionRole: session.role)
    configuration.delegateClass = SceneDelegate.self
    return configuration
  }
}

class SceneDelegate: UIResponder, UIWindowSceneDelegate {`],
    [`  func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {`, `  func scene(_ scene: UIScene, willConnectTo session: UISceneSession,
             options: UIScene.ConnectionOptions) {
    guard let windowScene = scene as? UIWindowScene else { return }`],
    ['UIWindow(frame: UIScreen.main.bounds)', 'UIWindow(windowScene: windowScene)'],
    ['launchOptions: launchOptions', 'launchOptions: nil'],
    ['    return true\n', ''],
  ];
  for (const [before, after] of sceneEdits) {
    if (delegateSource.split(before).length !== 2) {
      throw new Error('Unexpected AppDelegate template; review its scene lifecycle.');
    }
    delegateSource = delegateSource.replace(before, after);
  }
  writeFileSync(delegateFile, delegateSource);
  require('./wire-apple-probe.cjs')(root);
  // The published template assumes app-local dependencies; npm workspaces hoist them.
  require('./wire-android-probe.cjs')(root);
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
