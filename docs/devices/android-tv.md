# Android TV and Google TV

[العربية](../ar/devices/android-tv.md)

The showcase uses React Native TV with the New Architecture. Kotlin observes Android focus and drives Views, JNI carries batches and requests into C++, and the engine selects eligible targets for managed D-pad moves. Android still owns native editors, system dialogs and accessibility focus. The [adapter](../../packages/itar/android/) and [device tests](../../packages/itar/android/tests/com/) show where those boundaries meet.

## Build and run

Follow the native setup in the [standalone Itar Cinema repository](https://github.com/mbougarne/itar-cinema). For library instrumentation, generate the test host with `npm run native:fixture` in Itar and use `build/native-consumer/android`.

## Try it with the remote

1. Use the demo sign-in and pick a profile. Native Cinema defaults to a metadata proxy. For a repeatable local catalogue, choose **Settings → Catalogue → Offline fixtures**. For tests that exercise network loading, see the [proxy setup](../tmdb-proxy.md).
2. Enter Movies from the sidebar. Select a card other than the first, open Details and press Back. Check the card's outline and press Select to confirm the same title opens. Repeat through the player before returning.
3. Move below the last visible row, hold a direction and release. Check which axis scrolls, which card gains focus and whether navigation continues after release. Use **Settings** in a development build to open the focused probe screens for controlled list and removal cases.
4. Repeat with TalkBack. Record the input outline, accessibility focus, speech and activation separately. A reader may visit a heading while input focus stays on a card.

## What has been observed

A physical Chromecast HD on Android 14 was tested with TalkBack off and on. With TalkBack, a downward move could jump to the menu, and loading an unavailable target could send focus to a nearby node. These reports still need a physical retest and an ordered trace to identify the responsible layer.

On an Android 16/API 36 Google TV emulator, later Cinema checks covered sidebar traversal, passing the first offscreen row and returning to a nonfirst movie or series card, with TalkBack on and off. Separate reader-off Fabric tests exercised custom card content, activation, distant item reveal and dataset changes. Spoken output, physical remote behavior and long-session stability remain open. A previously reported app-not-responding event lacked a causal stack and did not recur on the bounded replay.

## Review Occo recordings

Use the [offline viewer](../../tools/occo/viewer.html) to open recorded traces from library development builds. The standalone app currently uses the published package’s public APIs.

## Fire TV running Fire OS

On an Android-based Fire TV, enable ADB and use `adb -s YOUR_ADB_SERIAL shell getprop ro.product.cpu.abi` to check the device ABI. Follow the [Android build steps](#build-and-run) with `--active-arch-only` to select it. Fire TV devices running Vega OS require a separate runtime.

Cinema passed testing on a physical Fire TV (model AFTKA, Android API 28) with VoiceView off and on. The device ran the `armeabi-v7a` build. With VoiceView off, returning from nested Details restored the opening card even when playback added a Continue Watching row. The D-pad could also reach and activate **Export recording** in Occo.

With VoiceView on, a single Up or Down press moved between Home rows. Moving Right twice and Left twice in More Like This changed the selected title each time and kept it at the leading edge. On the player timeline, Right, Right, Left moved playback from 0:53 to 1:03, then 1:13 and back to 1:03. A virtual directional keypad registered with Fire OS reproduced these checks on the TV. Android input focus and the VoiceView cursor agreed on the selected controls. The maintainer also confirmed the device pass.
