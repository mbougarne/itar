// Also usable on an existing generated shell: node scripts/wire-occo.cjs
const {appendFileSync, readFileSync, writeFileSync} = require('node:fs');
const path = require('node:path');

function wireOcco(root) {
  const project = path.join(root, 'apps/probe/android');
  const rootBuild = path.join(project, 'build.gradle');
  if (!readFileSync(rootBuild, 'utf8').includes('ext.itarOccoCaptureDir')) {
    appendFileSync(rootBuild, "\next.itarOccoCaptureDir = file('../occo/android/capture').absolutePath\n");
  }

  const appBuild = path.join(project, 'app/build.gradle');
  if (!readFileSync(appBuild, 'utf8').includes('occo/android/AndroidManifest.xml')) {
    appendFileSync(appBuild, `
android {
    sourceSets.debug.manifest.srcFile file('../../occo/android/AndroidManifest.xml')
    sourceSets.androidTest.java.srcDir file('../../occo/android/instrumentation')
}
`);
  }

  const app = path.join(project, 'app/src/main/java/com/itarprobe/MainApplication.kt');
  const source = readFileSync(app, 'utf8');
  if (source.includes('com.itar.adapter.OccoPackage')) return;
  const packages = 'PackageList(this).packages.apply {';
  if (source.split(packages).length !== 2) throw new Error('Unexpected React package registration in MainApplication');
  // Class is present only in the debug variant. The compile-time false release branch is erased.
  writeFileSync(app, source.replace(packages, `${packages}
              if (BuildConfig.DEBUG) {
                val type = Class.forName("com.itar.adapter.OccoPackage").asSubclass(com.facebook.react.ReactPackage::class.java)
                add(type.getDeclaredConstructor().newInstance())
              }`));
}

module.exports = wireOcco;
if (require.main === module) wireOcco(path.resolve(__dirname, '..'));
