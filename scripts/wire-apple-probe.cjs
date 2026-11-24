// Apply the same development-only wiring to new and previously generated Cinema shells.
const {readFileSync, writeFileSync} = require('node:fs');
const path = require('node:path');

function wireAppleProbe(root) {
  const project = path.join(root, 'build/native-consumer/ios');
  const podfile = path.join(project, 'Podfile');
  const delegate = path.join(project, 'ItarProbe/AppDelegate.swift');
  const edits = [
    [podfile, '  post_install do |installer|',
      "  post_install do |installer|\n    require_relative '../apple-pods'\n    configure_cinema_pods(installer)"],
    [delegate, '    window = UIWindow(windowScene: windowScene)',
      '#if DEBUG\n    window = ItarOccoWindow(windowScene: windowScene)\n#else\n    window = UIWindow(windowScene: windowScene)\n#endif'],
  ];
  const files = new Map();
  for (const [file, before, after] of edits) {
    const source = files.get(file) ?? readFileSync(file, 'utf8');
    if (source.includes(after)) continue;
    if (source.split(before).length !== 2) throw new Error('Unexpected Cinema template in ' + file);
    files.set(file, source.replace(before, after));
  }
  const source = files.get(delegate) ?? readFileSync(delegate, 'utf8');
  const debugImport = '#if DEBUG\nimport ItarEngineNative\n#endif\n';
  if (!source.includes(debugImport)) files.set(delegate, debugImport + source);
  for (const [file, contents] of files) writeFileSync(file, contents);
}

module.exports = wireAppleProbe;
if (require.main === module) wireAppleProbe(path.resolve(__dirname, '..'));
