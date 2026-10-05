# Initial native probe toolchains (ITAR-0002)

Recorded 2026-10-05. These are **candidate pins**, not a support matrix or a
resolution of the architecture's native compatibility question. Native builds
and device behavior remain unverified until ITAR-0007 and ITAR-0014 and their
host probes pass. The portable core can be built independently today.

## Selected combination

Use the published TV template and its matching RN/React pair, rather than mix
the newer RN TV 0.87 line with a 0.83 template. Registry metadata and the
template tarball were inspected; package existence is not build evidence.
Hermes and Fabric are the intended probe configuration. Do not opt out of the
new architecture to hide a failed binding build.

| Component | Exact candidate | Primary source / rationale |
| --- | --- | --- |
| RN TV | `react-native: npm:react-native-tvos@0.83.0-0` | [Registry metadata](https://registry.npmjs.org/react-native-tvos/0.83.0-0); use the TV fork under the RN alias, not both packages |
| React | `19.2.0` | Matches the [TV template package](https://github.com/react-native-tvos/template-tv/blob/0275201865d76aaf549e174d6e961b1a83cbb7f3/template/package.json) and RN TV peer range |
| Generator | Community CLI `20.0.0`; `@react-native-tvos/template-tv@0.83.0-0` | [CLI metadata](https://registry.npmjs.org/@react-native-community/cli/20.0.0), [template metadata](https://registry.npmjs.org/@react-native-tvos/template-tv/0.83.0-0) |
| Node / package manager | Node `22.14.0`, npm `10.9.2` | [Node release](https://nodejs.org/en/blog/release/v22.14.0); observed locally, meets RN TV's Node `>=20.19.4`; npm enables a committed package-lock and `npm ci` |
| Portable CMake | `3.31.6` | [Release](https://github.com/Kitware/CMake/releases/tag/v3.31.6); observed locally; core minimum remains 3.20 |
| Android CMake | `3.30.5` | [RN TV build](https://github.com/react-native-tvos/react-native-tvos/blob/v0.83.0-0/packages/react-native/ReactAndroid/build.gradle.kts); separate SDK-managed native build tool |
| NDK / Kotlin / AGP | `27.1.12297006` / `2.1.20` / `8.12.0` | [RN version catalog](https://github.com/react-native-tvos/react-native-tvos/blob/v0.83.0-0/packages/react-native/gradle/libs.versions.toml), [Gradle plugin catalog](https://github.com/react-native-tvos/react-native-tvos/blob/v0.83.0-0/packages/gradle-plugin/gradle/libs.versions.toml) |
| Android SDK / Gradle | compile/target `36`, minimum `24`, build tools `36.0.0`; Gradle `9.0.0` | [Template Android configuration](https://github.com/react-native-tvos/template-tv/blob/0275201865d76aaf549e174d6e961b1a83cbb7f3/template/android/build.gradle), [wrapper](https://github.com/react-native-tvos/template-tv/blob/0275201865d76aaf549e174d6e961b1a83cbb7f3/template/android/gradle/wrapper/gradle-wrapper.properties) |
| JDK | Zulu `17.56.15` / OpenJDK `17.0.14` | Observed installed; [Azul archive](https://www.azul.com/downloads/?version=java-17-lts&package=jdk); select explicitly instead of this Mac's default JDK 26 |
| Apple | Xcode `27.0` build `27A266a`, tvOS SDK `27.0`, Swift `6.4` (`swiftlang-6.4.0.34.1`) | Observed using `xcodebuild -version`, `xcrun --sdk appletvos --show-sdk-version`, `swift --version`; [Apple toolchain table](https://developer.apple.com/xcode/system-requirements) |
| Ruby / Bundler / CocoaPods | `3.3.6` / `2.6.9` / `1.16.2` | [Ruby release](https://www.ruby-lang.org/en/news/2024/11/05/ruby-3-3-6-released/), [Bundler](https://rubygems.org/gems/bundler/versions/2.6.9), [CocoaPods](https://rubygems.org/gems/cocoapods/versions/1.16.2); candidate project-local tools, not the system Ruby 2.6.10 |

The template's Gemfile limits `xcodeproj <1.26.0`, while CocoaPods 1.16.2
requires `xcodeproj >=1.27.0`. ITAR-0004 must explicitly replace that constraint
with candidate `xcodeproj =1.27.0` and pin CocoaPods/Bundler, then generate and
commit `Gemfile.lock`. This is an identified handwritten adaptation, not a
claim that the unmodified template resolves. Xcode 27 project-format support
and RN prebuilt framework compatibility need the Apple consumer build.
See [CocoaPods gem dependencies](https://rubygems.org/gems/cocoapods/versions/1.16.2)
and the [source Gemfile](https://github.com/react-native-tvos/template-tv/blob/0275201865d76aaf549e174d6e961b1a83cbb7f3/template/Gemfile).

## Reproduce the starting setup

Install the exact Node/npm and CMake above through the local version manager.
Verify `node --version`, `npm --version`, `cmake --version` before proceeding.
The following prepares the future ITAR-0004 shell in an empty scratch directory;
it is not an existing repository script and does not install native adapters:

```sh
npx --yes @react-native-community/cli@20.0.0 init ItarProbe \
  --template @react-native-tvos/template-tv@0.83.0-0 --pm npm --skip-install
cd ItarProbe
npm install --package-lock-only --ignore-scripts
# ITAR-0004 reviews/commits the lockfile; subsequent clean installs use npm ci.
```

The template tarball's registry SHA-512 integrity is:
`sha512-u6gtuBiXAZA/gyAyMv3FA84SaRZ8lQ8lRZJotAu1qLrAXPiScGtNcNcsTgXzKkbifqZ99qOF4fqbsyC6X0pXYg==`.
Record the generator command and retain the initial generated tree separately
from authored edits. npm's first resolution includes upstream ranges; exact
transitive reproduction starts with the reviewed lockfile, not this command
alone. Do not claim a lockfile or native shell has landed in ITAR-0002.

Verification on 2026-10-05: the generator and npm lockfile-only command above
completed in isolated scratch storage. Generated `package.json` retained RN TV
0.83.0-0, React 19.2.0 and CLI 20.0.0; the template archive matched its integrity.
All source links resolved. No dependency lifecycle scripts or native builds ran.

For Android, install SDK command-line tools, select the named JDK via
`JAVA_HOME`, and point `ANDROID_HOME` at the chosen SDK. Then:

```sh
sdkmanager 'platforms;android-36' 'build-tools;36.0.0' \
  'ndk;27.1.12297006' 'cmake;3.30.5'
# From the generated app, once its dependencies are installed:
cd android
./gradlew --version
./gradlew assembleDebug --no-daemon --max-workers=2
```

For Apple, select the recorded Xcode via per-command `DEVELOPER_DIR`, install
the tvOS simulator runtime, and use Ruby 3.3.6. After the explicit Gemfile
adaptation above, run `gem install bundler -v 2.6.9 --no-document`,
`bundle _2.6.9_ lock`, `bundle _2.6.9_ install`, and from `ios/` run
`bundle _2.6.9_ exec pod install`. Commit the reviewed Gemfile/Pod lockfiles.
The Apple probe must record its real workspace, scheme, simulator destination,
and `xcodebuild` command; none exists yet in this repository.

## Required follow-up evidence

- ITAR-0004: separate generated CLI/native files and lockfiles from handwritten
  workspace manifests, the TV screen, pins, and packaging changes. Regeneration
  is reviewable provenance, not permission to skip diffs or commit build output.
- ITAR-0007: prove the template's Gradle 9 / AGP 8.12 / Kotlin combination,
  C++20/libc++, JNI ABI, and Fabric registration in a real Android TV consumer.
  Record Android TV and Fire OS separately; SDK installation proves neither.
- ITAR-0014: prove Swift host code through a C facade and minimal RN glue,
  CocoaPods resolution, tvOS simulator and device linking, and no required
  application-wide C++ interop setting. A portable macOS core build is insufficient.
- Later native probes: run [shared scenarios](native-probe-scenarios.md) with
  native feedback and each named screen reader. No native build, simulator,
  device, focus, style, reader, performance, or deployment compatibility is
  established by this version record. Keep adjustments in ticket evidence;
  do not edit the accepted architecture.
