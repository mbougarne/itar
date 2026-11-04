# ITAR-0089 — Xbox feasibility

Research completed 2026-11-04. Outcome: no established current native RN Xbox route;
a UWP/WebView2 web route is a candidate for a bounded deployment probe.

## Native route

Microsoft's [architecture guide](https://microsoft.github.io/react-native-windows/docs/new-architecture/)
maps historical Paper to UWP and Fabric to Windows App SDK. Its general discussion
of old templates is stale relative to the explicit [RNW 0.82 release](https://github.com/microsoft/react-native-windows/releases/tag/react-native-windows_v0.82.0),
which removes Paper. The [support table](https://microsoft.github.io/react-native-windows/support/)
currently lists 0.85 active and 0.81 unsupported, with 0.81 ending support on
2026-06-30. Use the version-specific release when these pages differ.

Microsoft's [Windows FAQ](https://learn.microsoft.com/en-us/windows/apps/get-started/windows-developer-faq)
directs Xbox applications to UWP and games to GDK. A successful desktop RNW/Fabric
build therefore cannot establish native Xbox eligibility. Historical RNW/UWP would
require an unsupported-version or maintained-fork decision, plus exact Xbox SDK,
C++20 ABI, controller, native-focus/style, Narrator and deployment evidence. No
such fork or device-family support is selected here.

## Web route

Microsoft's [2023-11-01 announcement](https://blogs.windows.com/msedgedev/2023/11/01/webview2-for-xbox-announcement/)
establishes WebView2 availability for Xbox applications. It does not establish
which runtime build is on a selected console today or prove an Itar integration.
A UWP host with [RN Web](https://necolas.github.io/react-native-web/docs/) and a
DOM adapter is a candidate. Wasm is an engine-binding option, not a requirement
implied by WebView2. A native engine bridge would need its own allowed-API and
threading assessment.

| Area | Required proof |
| --- | --- |
| Runtime/build | Pin Xbox OS, WebView2 SDK/runtime and supported UWP packaging; establish native extension or Wasm loading with exact artifacts. |
| Input/focus | Controller D-pad, repeat/release, Back and shell-reserved inputs; reconcile DOM and host focus when entering/leaving WebView2. |
| Feedback/accessibility | Focus-driven CSS, committed semantic tree/actions and Narrator ownership; no duplicate automatic speech or speculative focus. |
| Lifecycle/scheduling | Background/resume, teardown with pending reveal and browser-main-thread stalls. Desktop responsiveness is not console evidence. |
| Distribution/access | Confirm the chosen application's Xbox developer/deployment and Store path before installation; none was activated here. |

## Proposed probe: Xbox UWP WebView2 host contract

Inputs: authorized Xbox deployment environment, named OS/device, SDK/runtime,
pinned RN Web/React bundle, selected engine binding and exact artifact hashes.
First establish a packaged minimal page with two controls and a delayed third.
Later device acceptance must prove loading, controller navigation, focus boundary
entry/exit, Narrator activation and cancellation/disposal. Stop before an Itar
adapter if the host/package route fails. No existing Xbox app, migration or
production console support is assumed.
