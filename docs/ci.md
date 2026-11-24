# Continuous integration

[العربية](ar/ci.md)

The [CI workflow](../.github/workflows/ci.yml) runs when a pull request is opened or reopened and when its head branch is updated. Jobs use a read-only repository token. The **Required checks** job aggregates the repository, portable core, React Native workspace and web jobs.

| Job | What it checks |
| --- | --- |
| Repository checks | Validates workflows with actionlint, checks tracked whitespace, detects the CMake entrypoint and runs the Ruby dependency audit. |
| C++20 | Builds the core and runs CTest on GCC/Linux, Clang/Linux with AddressSanitizer and UndefinedBehaviorSanitizer, and Apple Clang/macOS. The Apple runner also checks the Swift production boundary. |
| React Native library and test host | Builds the package, checks types and lint, runs package tests, then generates an Android integration test host and compiles instrumentation and JNI. |
| Web / Wasm and package consumer | Builds the engine with Emscripten 6.0.13, checks types, runs DOM and Wasm tests, then installs a local tarball in a fresh consumer. |

The standalone [Cinema repository](https://github.com/mbougarne/itar-cinema) owns app builds.

To reproduce the checks for one change, start with the [contribution guide](../CONTRIBUTING.md). The [device guides](devices/README.md) cover the remote, focus, media and accessibility behavior that requires a running host. The workflow compiles the Android instrumented-test APK. Running its cases needs a target device or emulator.
