# Continuous integration

CI runs on pull requests, pushes to `main`, merge queues, and manual dispatch.
It uses GitHub-hosted runners, a read-only repository token, SHA-pinned actions,
timeouts, and cancellation of superseded runs. No signing or publishing secrets
are needed. Dependabot proposes weekly updates to GitHub Actions pins.

## Checks available now

- `Repository checks` validates workflow syntax and expressions with actionlint
  1.7.11 and checks tracked files for whitespace errors. Its downloaded binary
  is verified against the release SHA-256 digest. Update both version and digest
  together; Dependabot does not update this standalone binary.
- The C++ matrix activates when `core/CMakeLists.txt` exists. Until then it is
  explicitly skipped and the run summary says C++ was not tested. Adding core
  source/header files without that build entry point fails repository checks.
- `Required checks` fails when repository checks fail or any enabled core job
  fails or is cancelled. This is the stable check to select in a GitHub branch
  ruleset after the first hosted run. Repository settings are not changed by
  committing these files.

The checkout contains an independent core library build and minimal harness,
and a private RN workspace/reference shell. The RN job runs a frozen install,
package build, typecheck, lint, consumer tests, Metro bundle and security audit.
Required checks also requires that job and the Ruby lockfile audit. The Ruby
job uses Ruby 3.3.6/Bundler 2.6.9 with a frozen install and bundler-audit 0.9.3. Native projects remain generated probe
inputs; native builds and device acceptance are not established by these jobs. Local ignored
tickets and architecture notes are not required by the workflow.

## C++20 build contract

The core foundation should make `core/` independently configurable with CMake
and register tests with CTest when `BUILD_TESTING=ON`. CI requests standard C++20
without compiler extensions; the CMake targets must also declare that requirement
for consumers. Empty test suites fail rather than pass silently.

| Runner | Compiler | Configuration |
| --- | --- | --- |
| Ubuntu 24.04 | GCC 13 | Release |
| Ubuntu 24.04 | Clang 18 | Debug, AddressSanitizer and UndefinedBehaviorSanitizer |
| macOS 15 | Apple Clang | Release |

Compiler/CMake versions are printed in each run. Runner image labels do not pin
every installed tool version. This matrix validates the portable engine; macOS
compilation does not validate Swift bindings, UIKit, or tvOS.

Reproduce the unsanitized core checks:

```sh
cmake -S core -B build/core -DCMAKE_BUILD_TYPE=Release \
  -DCMAKE_CXX_STANDARD=20 -DCMAKE_CXX_STANDARD_REQUIRED=ON \
  -DCMAKE_CXX_EXTENSIONS=OFF -DBUILD_TESTING=ON
cmake --build build/core --parallel 2
ctest --test-dir build/core --output-on-failure --no-tests=error --timeout 60
```

## Add integration checks with their build projects

Add real jobs in the same changes that introduce the corresponding build entry
points. Extend `Required checks` to require their results. Do not use optional
scripts or `continue-on-error` to conceal missing integration checks.

| Layer | Required CI work when its project lands |
| --- | --- |
| React Native / TypeScript | Use the selected Node and package-manager versions, a committed lockfile and frozen install; run the actual typecheck, lint, tests, and package build scripts. |
| Android / Kotlin / JNI | Pin the chosen JDK, SDK and NDK; use the committed Gradle wrapper to build the RN consumer and run its available lint/unit-test tasks, including the C++ binding. |
| Apple TV / Swift / Objective-C++ glue | Pin a compatible Xcode and dependency setup; build the actual consumer workspace/scheme for a tvOS simulator without distribution signing, and run available tests. An iOS or macOS build is not a substitute. |

The [candidate toolchain record](../docs/probe-toolchains.md) covers ITAR-0002.
The [RN shell](../docs/rn-probe-shell.md) is ITAR-0004 work. Android and Apple
binding builds remain ITAR-0007 and ITAR-0014; hosted native jobs do not exist yet.
Device focus, accessibility, loading stability, and performance evidence remains
separate from hosted builds and belongs in the PR's verification section.

Workflow conventions follow [GitHub's workflow reference](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax).
See [actionlint](https://github.com/rhysd/actionlint) for local workflow validation
and [CTest](https://cmake.org/cmake/help/latest/manual/ctest.1.html) for test options.
