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

The checkout currently contains no engine, RN package, or native build projects.
A green run at this stage means repository checks passed, not that the planned
library builds or any device is supported. Local ignored tickets and architecture
notes are not required by the workflow and remain unchanged.

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

Reproduce the unsanitized core checks once the build entry point exists:

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

The initial toolchain, RN shell, Android binding, and Apple binding work correspond
to local tickets ITAR-0002, ITAR-0004, ITAR-0007, and ITAR-0014. Their build commands
and version choices do not exist yet, so no passing native jobs are fabricated.
Device focus, accessibility, loading stability, and performance evidence remains
separate from hosted builds and belongs in the PR's verification section.

Workflow conventions follow [GitHub's workflow reference](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax).
See [actionlint](https://github.com/rhysd/actionlint) for local workflow validation
and [CTest](https://cmake.org/cmake/help/latest/manual/ctest.1.html) for test options.
