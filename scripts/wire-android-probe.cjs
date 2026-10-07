const {appendFileSync, readFileSync, writeFileSync} = require('node:fs');
const path = require('node:path');

module.exports = root => {
  const android = path.join(root, 'apps/probe/android');
  appendFileSync(path.join(android, 'settings.gradle'), `
include ':itar-host-probe'
project(':itar-host-probe').projectDir = file('../../../probes/android')
`);
  appendFileSync(path.join(android, 'app/build.gradle'), `
dependencies { implementation project(':itar-host-probe') }
android {
    useLibrary 'android.test.runner'
    useLibrary 'android.test.base'
    defaultConfig { testInstrumentationRunner 'android.test.InstrumentationTestRunner' }
    sourceSets.androidTest.java.srcDirs += file('../../../../probes/android/tests')
}
`);
  const application = path.join(android, 'app/src/main/java/com/itarprobe/MainApplication.kt');
  const source = readFileSync(application, 'utf8');
  const marker = 'PackageList(this).packages.apply {';
  if (source.split(marker).length !== 2) {
    throw new Error('Unexpected Android application template; review package registration.');
  }
  writeFileSync(application, source.replace(marker, `${marker}\n              add(com.itar.probe.ProbePackage())`));
};
