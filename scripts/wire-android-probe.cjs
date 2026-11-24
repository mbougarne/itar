const {appendFileSync, readFileSync, writeFileSync} = require('node:fs');
const path = require('node:path');

module.exports = root => {
  const android = path.join(root, 'build/native-consumer/android');
  appendFileSync(path.join(android, 'settings.gradle'), `
include ':itar-host-probe'
project(':itar-host-probe').projectDir = file('../../../probes/android')
`);
  appendFileSync(path.join(android, 'app/build.gradle'), `
apply from: '../../../../scripts/offline-android.gradle'
dependencies {
    implementation project(':itar-host-probe')
}
android {
    useLibrary 'android.test.runner'
    useLibrary 'android.test.base'
    defaultConfig { testInstrumentationRunner 'android.test.InstrumentationTestRunner' }
    sourceSets.androidTest.java.srcDirs += file('../../../../probes/android/tests')
    sourceSets.androidTest.java.srcDirs += file('../../../../packages/itar/android/tests/com')
}
`);
  const application = path.join(android, 'app/src/main/java/com/itarprobe/MainApplication.kt');
  const source = readFileSync(application, 'utf8');
  const marker = 'PackageList(this).packages.apply {';
  if (source.split(marker).length !== 2) {
    throw new Error('Unexpected Android application template; review package registration.');
  }
  const context = 'context = applicationContext,';
  if (source.split(context).length !== 2) {
    throw new Error('Unexpected Android host template; review offline bundle selection.');
  }
  writeFileSync(application, source.replace(marker, `${marker}\n              add(com.itar.probe.ProbePackage())`)
    .replace(context, `${context}\n      useDevSupport = com.facebook.react.common.build.ReactBuildConfig.DEBUG && !BuildConfig.ITAR_OFFLINE,`));
  require('./wire-occo.cjs')(root);
};
