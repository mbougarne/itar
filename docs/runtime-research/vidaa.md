# ITAR-0088 — VIDAA feasibility

Research completed 2026-11-04 from public vendor pages. Outcome: unresolved runtime
and access contracts; no implementation probe is justified yet.

[Hisense's platform catalogue](https://www.hisense-usa.com/televisions/smart-tv-platforms)
separately names Android TV, Google TV, Fire TV, VIDAA and Roku families. A Hisense
brand label supplies no engine, renderer, ABI or screen-reader contract. Roku
remains excluded; an Android-based Hisense result is not a VIDAA result.

The [VIDAA partner support page](https://www.vidaa.com/partner-support/) requires
partner login. It also points to a new V-branded site; branding is not SDK evidence.
No authenticated partner material was supplied or accessed for this research.
Public searches of vendor documentation did not establish a versioned RN/native
extension or browser/Wasm contract. Third-party integration claims and old generic
Smart TV Alliance manuals are not substituted for current VIDAA contracts.

| Required evidence | Result / evidence needed before implementation |
| --- | --- |
| React Native deployment | Unresolved: maintained renderer, exact RN version, supported model/OS list and application model. |
| C++20 delivery | Unresolved: allowed native extensions, compiler/standard library, ABI, ownership/thread callbacks and package loader. |
| Web/Wasm alternative | Unresolved independently of native RN: actual browser version, Wasm features, JS/module/CSP rules and approved packaged/hosted app route. |
| Input/geometry/focus/style | Unresolved: remote events, committed bounds, actual focus observations, focus-request semantics and feedback independent of application rerenders. |
| Accessibility | Unresolved: reader availability/modes, committed labels/roles/actions, input ownership and semantic activation without forced focus. |
| Lifecycle/distribution | Unresolved: suspend/dispose behavior, signing, developer access and permitted submission mechanism for the selected runtime. |

The next step is to review already-authorized, versioned SDK documents covering
those rows and identify a named device/firmware. Only then define a bounded
binding/focus probe with source-removal, loading, reader and teardown acceptance.
No partner registration, credential request, SDK download or universal Hisense
adapter is part of this result. Missing public evidence does not prove the
platform technically cannot support an integration.
