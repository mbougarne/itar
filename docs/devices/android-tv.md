# Android TV and Google TV

[العربية](../ar/devices/android-tv.md)

The showcase uses React Native TV with the New Architecture. Kotlin observes Android focus and drives Views, JNI carries batches and requests into C++, and the engine selects eligible targets for managed D-pad moves. Android still owns native editors, system dialogs and accessibility focus. The [adapter](../../packages/itar/android/) and [device tests](../../packages/itar/android/tests/com/) show where those boundaries meet.

## Build and run

Complete [native example setup](README.md#prepare-the-native-example). Use JDK 17, set `JAVA_HOME` and `ANDROID_HOME` to your local installations, and put Android's `platform-tools` and command-line tools on your path. The following SDK components match the checked-in [CI build](../../.github/workflows/ci.yml).

```sh
sdkmanager 'platform-tools' 'platforms;android-36' 'build-tools;36.0.0' \
  'ndk;27.1.12297006' 'cmake;3.22.1'
```

Start Metro from the repository root in one terminal. Its default port in this project is 8096.

```sh
npm run start -w itar-probe
```

Use an Android TV/Google TV emulator or a TV with ADB debugging enabled. In a second terminal, list devices, replace the placeholder with the selected serial and launch the app.

```sh
adb devices -l
npm run android -w itar-probe -- --device YOUR_ADB_SERIAL --active-arch-only --no-packager
```

For a build without a TV, run the following inside `apps/probe/android`. It compiles the arm64 app and instrumented-test APKs and runs lint. Executing the instrumentation needs a connected target.

```sh
./gradlew assembleDebug assembleAndroidTest lintDebug \
  -PreactNativeArchitectures=arm64-v8a --max-workers=2
```

## Try it with the remote

1. Use the demo sign-in and pick a profile. Native Cinema defaults to a metadata proxy. For a repeatable local catalogue, choose **Settings → Catalogue → Offline fixtures**. For tests that exercise network loading, see the [proxy setup](../tmdb-proxy.md).
2. Enter Movies from the sidebar. Select a card other than the first, open Details and press Back. Check the card's outline and press Select to confirm the same title opens. Repeat through the player before returning.
3. Move below the last visible row, hold a direction and release. Check which axis scrolls, which card gains focus and whether navigation continues after release. Use **Settings** in a development build to open the focused probe screens for controlled list and removal cases.
4. Repeat with TalkBack. Record the input outline, accessibility focus, speech and activation separately. A reader may visit a heading while input focus stays on a card.

## What has been observed

A physical Chromecast HD on Android 14 was tested with TalkBack off and on. With TalkBack, a downward move could jump to the menu, and loading an unavailable target could send focus to a nearby node. These reports still need a physical retest and an ordered trace to identify the responsible layer.

On an Android 16/API 36 Google TV emulator, later Cinema checks covered sidebar traversal, passing the first offscreen row and returning to a nonfirst movie or series card, with TalkBack on and off. Separate reader-off Fabric tests exercised custom card content, activation, distant item reveal and dataset changes. Spoken output, physical remote behavior and long-session stability remain open. A previously reported app-not-responding event lacked a causal stack and did not recur on the bounded replay.

## Record a focus incident with Occo

Occo v0.1 records the Android TV **development build** of Itar Cinema. Freshly generated shells include it. If your checkout already has an older `apps/probe/android`, run `node scripts/wire-occo.cjs` from the repository root before rebuilding. For the Chromecast HD investigation, connect ADB to the TV and launch the development app with Metro as described above. Use `--active-arch-only` so the build matches the TV's ABI.

1. Enable TalkBack, open Cinema **Settings** and select **Start Occo recording**. Return to the catalogue and press Down on the physical remote. Note the starting card and what TalkBack said.
2. As soon as focus jumps, freeze the trace from a second terminal. This preserves the last events before you navigate away. To add a marker and keep recording instead, use the same command with `MARK` in place of `FREEZE`. The same controls are available from Cinema Settings.

   ```sh
   adb -s YOUR_ADB_SERIAL shell am broadcast -n com.itarprobe/com.itar.adapter.OccoControl -a com.itarprobe.occo.FREEZE
   ```

3. In Settings select **Inspect Occo recording** (or **Freeze and inspect Occo recording**). Use the D-pad to choose an event. Compare the requested occurrence and mount with the subsequent **input focus** and **accessibility focus**. A host can accept a request before the observation arrives. An unlinked observation after a cancellation is still evidence of where focus went.

   If focus leaves a card, select the unmanaged observation on the channel you are investigating. When Android identifies the new view, Occo shows its native role and, when available, its screen bounds in pixels. A horizontal scroll container spanning a row is distinguishable from an individual button. Earlier recordings can still be opened, but these details are only available in captures that recorded them.

4. Select **Export recording**. Copy the private file to your computer. Choose a new local filename for each incident.

   ```sh
   adb -s YOUR_ADB_SERIAL exec-out run-as com.itarprobe cat files/occo/latest.json > chromecast-down.json
   ```

5. On either computer, open [the local viewer](../../apps/probe/occo/viewer.html) from a checkout and choose the JSON file. A [synthetic example](../../apps/probe/occo/synthetic-example.json) is included. The viewer works offline. Stepping reads recorded events and never sends a command to a TV.

**Reading gaps.** “Not observed” means the trace contains no matching input at that boundary. Android or the reader can act before Cinema receives a key. A dropped-event count means some evidence is missing. The recording captures occurrence keys, native mount identities and adapter events. Keep the actual remote sequence and spoken output with the file when sharing it.

## Fire TV running Fire OS

Identify the exact **operating system and ABI** before trying the Android build; Amazon also ships a separate Vega OS runtime. The Android adapter declares API 24 as its minimum and the arm64 build above targets `arm64-v8a`. Those settings describe the binary. Compatibility with a particular Fire TV requires installation and testing on that device.

For a compatible Android-based Fire OS device with ADB enabled, use the selected-device procedure above. Test D-pad, Select and Back with VoiceView off, then enable VoiceView and repeat navigation, activation, loading and return to the opener. Check the reported label and action for each card, including across recycled rows. There is no recorded physical Fire OS or VoiceView acceptance.
