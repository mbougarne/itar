# ITAR-0087 — LG webOS feasibility

Research completed 2026-11-04. Outcome: a web artifact is a candidate; this review
establishes no currently accessible native React Native renderer for retail webOS TV.
LG webOS TV and webOS Open Source Edition must not be treated as identical targets.

## Versioned evidence

LG's [web-engine table](https://webostv.developer.lge.com/develop/specifications/web-api-and-web-engine)
lists 5.x/2020 as Chromium 68, 6.x/2021 as 79, 22/2022 as 87, 23 as 94, 24 as 108,
25 as 120 and 26 as 132. LG explicitly warns that TV-specific compatibility can
differ from Chrome. The table describes HTML/CSS/JavaScript web apps, not native RN.

Candidate UI layer: [React Native Web 0.21.4](https://necolas.github.io/react-native-web/docs/),
which uses React DOM. Candidate compiler for investigation: [Emscripten 6.0.13](https://raw.githubusercontent.com/emscripten-core/emscripten/6.0.13/src/settings.js),
whose Chrome minimum/default is 85. webOS TV 22/Chromium 87 clears that numerical
screen, while 5.x and 6.x do not. This is an inference for choosing a probe, not
LG's Wasm guarantee or an Itar compatibility claim. No compiler was installed.

## Contract mapping

| Area | Candidate contract / unresolved proof |
| --- | --- |
| Engine and loader | Single-threaded C++20/Wasm with a JS host boundary. Inspect emitted instructions, JS syntax, exception support, imports, packaged URLs and module instantiation; no automatic SIMD/threads/GC assumption. |
| Remote and reveal | [Magic Remote](https://webostv.developer.lge.com/develop/guides/magic-remote) requires pointer and 5-way support, includes wheel input, and describes mode transitions. Reconcile hover, real DOM focus and wheel-induced geometry changes rather than treating every pointer move as a directional command. |
| Focus and feedback | DOM focus observations and CSS focus feedback are the candidate equivalents. Scope isolation, stable identity during recycling and source-loss prevention need proof on a TV. |
| Accessibility | [appinfo.json](https://webostv.developer.lge.com/develop/references/appinfo-json) provides `accessibility.supportsAudioGuidance` (default false) and documents ARIA requirements. Enabling it is not proof of labels/actions, reader ownership, focus restoration or correct speech. |
| Scheduling | JS, DOM and a single-threaded Wasm engine share browser scheduling. Core speed does not prove JS-independent visible feedback. |
| Packaging/lifecycle | Pin the webOS CLI/package recipe and appinfo configuration before a probe. Packaged versus hosted resource loading, activation/suspension and cleanup remain untested; distribution requires the LG approval process linked from the engine documentation. |

## Proposed probe: webOS version floor and mixed input

Inputs: named webOS TV 22 device/firmware, Chromium identity, Emscripten 6.0.13,
RN Web 0.21.4 with compatible pinned React/bundler, CLI version and artifact hashes.
First compile and inspect a bounded engine/DOM artifact without claiming support.
Later run it on the selected TV and one newer model: verify module loading,
5-way/pointer transitions, wheel scrolling, input versus accessibility focus,
activation without a forced focus move, inactive-route exclusion and late loading.

A pass requires native-device evidence with Audio Guidance both off and on, source
removal/recycling traces and cleanup after route disposal. Transpiling JS alone
cannot prove Wasm, CSS or reader compatibility. No support floor, web adapter or
fallback is committed by this research.
