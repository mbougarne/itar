# Testing Itar on TVs

[العربية](../ar/devices/README.md)

Choose the runtime on your device. The same TV brand can ship Android TV, Fire OS, VIDAA or Roku, each with different input events, focus behavior and screen readers.

| Runtime | What you can try from this checkout | Observed behavior and open checks |
| --- | --- | --- |
| [Android TV / Google TV](android-tv.md) | React Native TV app, Kotlin/JNI adapter, D-pad and TalkBack scenarios | A Chromecast HD was exercised with TalkBack off and on. Focus jumps were reported during downward navigation and loading. Later fixes have bounded emulator coverage. |
| [Fire TV running Fire OS](android-tv.md#fire-tv-running-fire-os) | React Native TV app with the Android Kotlin/JNI adapter, built for the device ABI | Passed on AFTKA (API 28, `armeabi-v7a`) with VoiceView off and on. With VoiceView on, checks covered row changes, pinned recommendations and ten-second seeks. |
| [Apple TV / tvOS](apple-tv.md) | React Native TV app with the Swift/UIKit adapter | Cinema passed physical Apple TV HD testing with VoiceOver on and off. |
| [Desktop browser](web-tv.md#desktop-browser) | Itar Cinema, DOM host and the C++ engine compiled to Wasm | Chromium keyboard, pointer and accessibility-tree checks cover selected flows. Spoken-reader testing remains open. |
| [Samsung Tizen](web-tv.md#samsung-tizen) | Unsigned web app staging directory with Samsung manifest | Cinema remote navigation passed on a physical TV with Voice Guide enabled. |
| [LG webOS TV](web-tv.md#lg-webos-tv) | Web app staging directory with LG manifest | Cinema remote navigation passed on a physical TV with Audio Guidance enabled. |

### Prepare the native example

Start in a fresh checkout with Node 22.23.4 and npm 10.9.9. Both native guides use the same React 19.2.0 and React Native TV 0.83.0-0 example. Run these commands once from the repository root.

```sh
npm ci --ignore-scripts --no-audit
npm run build
npm run native:generate
```

The generator creates both native projects under `apps/probe/` and wires the host packages. It refuses to overwrite an existing project. Keep hand-written changes in the package or generator so fresh checkouts pick them up. Select a platform above for the build and launch steps.

### Report a device result

Start with a specific target. For example, open Movies, select the **second** card, press Back from Details, and check which card now has the outline. With a reader on, separately record the focused semantic element, the spoken label and what Select activates. Choosing the second card distinguishes restoration from a default jump to the first.

Include the Git revision, app/build mode, model, OS version, reader and mode, remote/input method, fixture or proxy catalogue, starting screen and exact keys. Describe the expected target and every observed focus change. Say whether the target was already mounted, became visible after scrolling, or disappeared while loading. Include intermediate highlights or speech when observed. A correct final target can follow a visible jump. For a loading test, hold a direction on the last visible card while the next row mounts. For a cancellation test, reverse direction before the destination appears. Record any intermediate jumps, then press Select and identify the item that activates. Repeat with the reader off and on.

### Other devices

These platforms have no runnable Itar adapter in this checkout.

| Device family | Current scope |
| --- | --- |
| Fire TV running Vega OS | A native React Native/C++ integration needs its own Vega host and VoiceView testing. Kotlin/JNI targets Android-based Fire OS. |
| VIDAA | The renderer, extension or packaged-web contract and device testing route are unresolved. |
| Xbox | A console-compatible web host is a research candidate. Controller input and Narrator require a console build. |
| PlayStation | An authorized app runtime and integration path have yet to be established. |
| Roku | Outside the scope of the project. |
