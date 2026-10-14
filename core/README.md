# Independent C++20 build (ITAR-0001)

Requires CMake 3.20+ and a C++20 compiler with its standard library. The
`itar_core` static library (`itar::core` for CMake consumers) exports `include/`
and the C++20 usage requirement. It has no React, JNI, UIKit, JavaScript, or
downloaded dependency. The [registry spike](../docs/core-registry-spike.md)
implements bounded identity, topology, committed geometry and observed focus
state. The [navigation policy](../docs/core-navigation.md) adds pure destination,
scope-entry and deletion-recovery proposals. [Portable transactions](../docs/core-transactions.md)
add validated requests, effects, cancellation, host time and replay; production
adapters follow.

From the repository root:

```sh
cmake -S core -B build/core -DCMAKE_BUILD_TYPE=Release -DBUILD_TESTING=ON
cmake --build build/core --parallel 2
ctest --test-dir build/core --output-on-failure --no-tests=error --timeout 60
```

The harness links the library and compiles a C++20 standard-library facility.
Checks use exit codes, so Release/NDEBUG cannot disable them. The second CTest
case expects `--fail` to return failure; a false success fails that test. To
observe the ordinary failing process directly, run:

```sh
build/core/itar_core_harness --fail
# Expected: "Intentional harness failure", exit status 1.
```

Use `-DBUILD_TESTING=OFF` for a library-only build. Keep build trees under the
ignored `build/` directory (or outside the checkout). Use a different build
directory per compiler/configuration. No third-party test framework is needed
for the harness; behavioral fixtures exercise registry and navigation contracts.

For Clang sanitizers, configure a fresh directory with
`-DCMAKE_BUILD_TYPE=Debug` and
`-DCMAKE_CXX_FLAGS='-fsanitize=address,undefined -fno-omit-frame-pointer'`.
Run CTest with `UBSAN_OPTIONS=halt_on_error=1:print_stacktrace=1`.
The [existing CI matrix](../.github/README.md) also runs GCC, Clang sanitizers,
and Apple Clang. These checks do not establish native TV support.

Local evidence (2026-10-05): CMake 3.31.6 / Apple Clang 21.0.0 passed Release
and ASan/UBSan (2/2 cases each), an isolated clean source copy, and library-only
configuration. Compile commands confirmed `-std=c++20` on both targets. Direct
`--fail` returned 1; an isolated CTest fixture without `WILL_FAIL` returned
nonzero for that command, verifying ordinary failure propagation.
