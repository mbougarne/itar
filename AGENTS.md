# Working on Itar

**English** · [العربية](AGENTS.ar.md)

Start from the issue, the current checkout and the [contribution guide](CONTRIBUTING.md). The [architecture guide](docs/guides/architecture.md) explains which layer owns each decision. Maintainer checkouts can also contain a local supplement at `tickets/maintainer-workflow.md`. Follow it when present.

- Keep navigation policy, identity and request state in the independent C++20 core. Kotlin/JNI connects Android views and input. Swift/UIKit owns the tvOS host, with Objective-C++ at the Fabric boundary. The browser example uses a DOM host and WebAssembly.
- Keep occurrence keys, registration generations and mount lifetimes distinct. Validate an effect against the live host before dispatch. A late callback can report a real focus change after a request is cancelled.
- Prefer RAII and value semantics. Keep buffers and pending operations bounded. At native boundaries document who owns a resource, how long it lives and which thread can access it.
- Preserve host ownership of native input, accessibility navigation, activation and speech. Apply focus visuals from observed host focus. Test navigation and restoration with the reader settings relevant to the affected platform.
- Preserve existing public API and packaging behavior unless the issue changes them. Group code by responsibility, keep comments about invariants close to the implementation, and include a focused reproducer for behavioral fixes.
- Run the checks for the layer you changed. Record the commit, configuration, target and result. Identify which observations came from a software test, browser, simulator or physical TV. [Device guides](docs/devices/README.md)
