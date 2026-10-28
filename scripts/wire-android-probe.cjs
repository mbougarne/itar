const {appendFileSync, readFileSync, writeFileSync} = require('node:fs');
const path = require('node:path');

module.exports = root => {
  const android = path.join(root, 'apps/probe/android');
  // v6.19.3's wrapper is called only inside its worker executor, but lacks the
  // annotation on the overload it calls (upstream issue #4885). Preserve lint.
  const video = path.join(root, 'node_modules/react-native-video');
  const version = JSON.parse(readFileSync(path.join(video, 'package.json'), 'utf8')).version;
  if (version !== '6.19.3') { throw new Error('Review the video worker annotation patch for the selected version'); }
  const player = path.join(video, 'android/src/main/java/com/brentvatne/exoplayer/ReactExoplayerView.java');
  const sourceVideo = readFileSync(player, 'utf8');
  const wrapper = '    private ArrayList<VideoTrack> getVideoTrackInfoFromManifest() {';
  if (sourceVideo.split(wrapper).length !== 2) { throw new Error('Unexpected video manifest-track wrapper'); }
  if (!sourceVideo.includes(`    @WorkerThread\n${wrapper}`)) {
    writeFileSync(player, sourceVideo.replace(wrapper, `    @WorkerThread\n${wrapper}`));
  }

  // react-native-video includes notification-capable service code. Declare its
  // permission for lint; this showcase never requests it or enables controls.
  const manifest = path.join(android, 'app/src/main/AndroidManifest.xml');
  const xml = readFileSync(manifest, 'utf8');
  const internet = '<uses-permission android:name="android.permission.INTERNET" />';
  if (!xml.includes(internet)) { throw new Error('Unexpected Android permission template'); }
  if (!xml.includes('android.permission.POST_NOTIFICATIONS')) {
    writeFileSync(manifest, xml.replace(internet, `${internet}\n    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />`));
  }
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
};
