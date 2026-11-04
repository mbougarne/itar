# ITAR-0086 — Samsung Tizen feasibility

Research completed 2026-11-04. Outcome: investigate a packaged React Native Web
route; no current accessible native RN renderer/toolchain combination was established.

## Runtime evidence

Samsung's historical [JuvoPlayer RN sample](https://github.com/SamsungDForum/juvo-player-UI.ReactNative)
uses Tizen .NET; its instructions show Node 12.10 and RN 0.42.3. Its linked
Samsung RN Tizen repository returned 404. The [You.i 6.15 Tizen guide](https://developer.youi.tv/6.15/rn/platform-tizen/tizen-platform-guide/)
search extract describes a proprietary native route, but full retrieval returned
502 and current access, maintenance and licensing were not established. Neither
is evidence that this repository's RN TV 0.83 native bindings can deploy to Tizen.

[React Native Web 0.21.4](https://necolas.github.io/react-native-web/docs/) renders
through React DOM. It is a candidate UI compatibility layer, separate from React
Native Windows and from the C++ engine. A web route needs a DOM adapter and a
selected engine binding; no existing Android/UIKit component can be reused as-is.

Samsung documents [Wasm from Tizen 5.5 / 2020](https://developer.samsung.com/smarttv/develop/extension-libraries/webassembly/overview.html).
The official [engine table](https://developer.samsung.com/smarttv/develop/specifications/web-engine-specifications.html)
search extract lists 2022 / Tizen 6.5 / Chromium M85; full retrieval repeatedly timed
out. Independently, pinned [Emscripten 6.0.13 settings](https://raw.githubusercontent.com/emscripten-core/emscripten/6.0.13/src/settings.js)
set the minimum supported and default Chrome target to 85. Thus 2022 is a candidate
for artifact investigation, not an advertised support floor. Wasm availability on
2020 TVs alone does not establish compatibility with this compiler's output.

## Required adapter behavior and gaps

- [Remote input](https://developer.samsung.com/smarttv/develop/guides/user-interaction/remote-control.html): map keydown/up and Back with repeat/release behavior; confirm which keys are reserved or require registration. Do not intercept reader-owned actions.
- DOM focus and geometry: batch committed layout measurements, observe actual focused elements, invalidate recycled mounts and bound reveal work. Native-feedback equivalent is CSS driven by actual focus; browser scheduling still applies.
- [Voice Guide](https://developer.samsung.com/smarttv/develop/guides/fundamentals/text-to-speech.html): Samsung documents focused HTML content and WAI-ARIA roles/descriptions. Verify actual semantics, activation, inactive routes and loading/removal on each tested model. Avoid duplicating automatic speech.
- Packaging/distribution: a signed Tizen web application and TV Seller Office process must be checked against the chosen SDK/model. Wasm loading under packaged URLs, MIME handling, CSP, generated JS syntax and module loading are untested.
- RN Web/React dependency versions, CSS features and list behavior need a separately pinned bundle compatibility check. A compiler's browser floor says nothing by itself about that bundle.

## Proposed probe: packaged DOM/Wasm focus artifact

Inputs: RN Web 0.21.4 candidate, pinned compatible React/bundler, Emscripten 6.0.13,
Tizen SDK version and a named Tizen 6.5/M85 TV plus a newer comparison device.
Compile C++20 single-threaded; explicitly inspect the emitted Wasm features and JS
loader. Do not opt into SIMD, shared-memory threads or browser-native exceptions
without an independent capability check. Verify exception behavior for the engine's
existing allocation handling rather than disabling it to make a build pass.

Later pass criteria: packaged module loads; identical logical fixtures reproduce
core decisions; DOM focus/blur and CSS feedback match real focus; delayed reveal,
recycling, Back and Voice Guide activation pass. Measure browser-main-thread stalls.
No adapter, fallback implementation or older-model promise is selected here.
