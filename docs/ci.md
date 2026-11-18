# Continuous integration

[العربية](ar/ci.md)

The [CI workflow](../.github/workflows/ci.yml) runs on pull requests, pushes to `main`, merge queues and manual dispatch. Jobs use a read-only repository token. The **Required checks** job aggregates the repository, portable core, React Native workspace and web jobs.

| Job | What it checks |
| --- | --- |
| Repository checks | Validates workflows with actionlint, checks tracked whitespace, detects the CMake entrypoint and runs the Ruby dependency audit. |
| C++20 | Builds the core and runs CTest on GCC/Linux, Clang/Linux with AddressSanitizer and UndefinedBehaviorSanitizer, and Apple Clang/macOS. The Apple runner also checks the Swift production boundary. |
| RN workspace | Installs locked JS dependencies, builds the package, checks types/lint/TV formatting and runs the workspace tests. Installs and verifies a local tarball in a fresh portable consumer, builds the Android Metro bundle, generates the native shells, then compiles the Android app, JNI, instrumented-test APK and lint targets. |
| Web / Wasm and TV artifacts | Builds the shared engine with Emscripten 6.0.13, checks web types, runs actual-Wasm and web host tests, and builds the browser, Tizen and webOS staging directories. |

To reproduce the checks for one change, start with the [contribution guide](../CONTRIBUTING.md). The [device guides](devices/README.md) cover the remote, focus, media and accessibility behavior that requires a running host. The workflow compiles the Android instrumented-test APK. Running its cases needs a target device or emulator.
