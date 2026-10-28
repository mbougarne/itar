# itar
أطار - Itar a C++ focus library for OTT streaming TV apps

Itar is a new focus-management library for TV and set-top-box applications built with React Native. Its foundation is an independent C++20 engine designed around explicit ownership, predictable resource use, data locality, and clear platform boundaries.

Native focus styles and accessibility are core requirements: supported styles must update without a React rerender, and accessibility navigation, activation, and restoration must be designed and validated alongside every feature.

Android host code uses Kotlin/JNI; Apple TV host code uses Swift, with minimal Objective-C++ React Native glue where required. Norigin is an example of the desired capability, not a porting target or dependency. This project starts independently of any existing application.

The compatibility ambition covers suitable React Native TV runtimes, including Apple TV. React Native Web, WebAssembly, and console-specific integrations are options to evaluate when a target requires them. No web or native runtime has been selected for Xbox or PlayStation. Roku is excluded.

Start with the [independent C++20 build](core/README.md),
[candidate probe toolchains](docs/probe-toolchains.md), and
[shared native probe scenarios](docs/native-probe-scenarios.md).
The source includes deterministic registry/navigation/transaction tests and
provisional Android/Apple adapters, React APIs and fixed-extent TV list support.
[Phase 11 review and evidence](docs/validation/phase11-review.md) maps validation
to each release ticket. Physical TV/accessibility and fresh native-consumer gates
remain open; no shipping native TV compatibility is claimed.
