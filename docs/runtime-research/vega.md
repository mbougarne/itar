# ITAR-0085 — Vega feasibility

Research completed 2026-11-04 from public sources; outcome: a bounded native probe
is justified, but Itar support and native behavior remain unverified.

## Version and access basis

Amazon's [SDK 2.0 release notes](https://developer.amazon.com/docs/vega/2.0/vega-release-notes)
describe OS/SDK 2.0 and RN 0.83 general availability, while native tooling remains
open beta. C++ views/modules can integrate with RN; the described native UI sample
covers D-pad focus and VoiceView. This supersedes relying on the old 0.23/RN 0.72
snapshot. An exact installed SDK patch, OS build and sample revision are not known.

The [RN migration build requirements](https://developer.amazon.com/docs/vega/2.0/rn-migration-vega-config)
name CMake 3.22+, a C++20 compiler and `keplerui::keplerscript-4` for RN 0.83.
Those are documented prerequisites, not a successful build of Itar's standard-library
usage or confirmation of a specific SDK compiler/ABI. Do not use the host compiler
version as the target compiler version.

The [Vega overview](https://developer.amazon.com/docs/vega/2.0/vega-rn-overview)
documents Fabric, TurboModules, Node-API over JSI and an OS-delivered RN runtime.
This is separate from Android-based Fire OS: Kotlin/JNI and Android Views are not
reusable host bindings. The portable C++ engine is the candidate shared layer.

## Contract mapping

| Itar contract | Evidence and remaining gap |
| --- | --- |
| Native binding | C++ TurboModules and system IDL interfaces are documented in the [native overview](https://developer.amazon.com/docs/vega-native/2.0/vega-overview). Package the engine behind a narrow owned boundary; ABI, allocation failures and teardown still need a compile/probe. |
| Serialized ownership | The [native view API index](https://developer.amazon.com/docs/vega-native-api/2.0/README.com_amazon_kepler_uitoolkit_view) search extract says view methods run on the UI thread. Full page retrieval failed. Exact callback ordering, reentrancy and cross-thread marshalling remain gaps; Node-API does not imply UI-thread ownership. |
| Input and focus | TV focus guides/events are documented. [0.24 focus documentation](https://www.developer.amazon.com/docs/vega/0.24/focus-management) describes FocusManager and warns synchronous JS focus callbacks block the UI thread. The 2.0 focus page could not be retrieved; verify current equivalents before relying on this older API. |
| Geometry and native feedback | Native UI views are a plausible integration point. Committed bounds, mount identity, observed-focus styling without JS and reduced-motion handling need direct API/sample verification. JS onFocus styling does not satisfy the contract. |
| Accessibility | VoiceView appears in the native UI sample description. Reader-owned input, separate focus channels, committed roles/actions, hidden routes and exactly-once semantic activation remain device gates. |
| Lifecycle and distribution | [Developer tools](https://www.developer.amazon.com/docs/vega/latest/install-vega-sdk) document SDK selection and `.vpkg` workflows; the native overview links package/lifecycle management. Appstore eligibility, signing and permissions for the chosen native APIs must be checked for the actual package. No account or SDK access was acquired. |

## Proposed probe: Vega native binding and focus ownership

Inputs: pinned SDK 2.0.x, RN 0.83 sample commit, target compiler/ABI, Itar revision,
one named Vega device/OS and its VoiceView settings. First compile the engine and
one native view binding with no Android dependencies; exercise lifetime, invalid
handles and cancellation through host-free tests. Split the UI portion before
exceeding 500 authored lines.

Later device acceptance: two mounted controls plus one unrealized target; report
input-to-native-focus order, geometry commits, source removal versus recovery,
reader-owned directions, semantic activation, native feedback during a JS stall,
and disposal with late callbacks. Require no per-candidate JS round trip. Failures
remain explicit; a compiler pass or native sample is not Itar acceptance.
