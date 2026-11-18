# Itar C++20 engine

[العربية](README.ar.md)

The `itar_core` static library exposes the CMake target `itar::core`. It owns surface state, logical identities, committed geometry, navigation policy, transactions and collection membership. A host supplies input, measurements and actual focus observations. The core can be built and tested without React, JavaScript or a TV SDK.

## Build and test

Use CMake 3.20+ and a C++20 compiler. Run from the repository root.

```sh
cmake -S core -B build/core -DCMAKE_BUILD_TYPE=Release -DBUILD_TESTING=ON
cmake --build build/core --parallel 2
ctest --test-dir build/core --output-on-failure --no-tests=error --timeout 60
```

For library development, `cmake --build build/core --target itar_core` builds just the engine. For a CMake consumer, see the [standalone example](../docs/guides/architecture.md). Each build configuration needs its own output directory.

CTest covers registry and mount generations, atomic updates, geometry, navigation, transactions, replay, collections and platform-boundary fixtures. To run a subset while working on a change, list registered tests first, then match their names:

```sh
ctest --test-dir build/core -N
ctest --test-dir build/core -R collection --output-on-failure
```

To exercise sanitizers with Clang, configure a fresh Debug build and pass `-fsanitize=address,undefined -fno-omit-frame-pointer` in `CMAKE_CXX_FLAGS`. The [CI workflow](../.github/workflows/ci.yml) contains the full build flags. Build with `-DITAR_BUILD_BENCHMARKS=ON` to enable `itar_core_costs`. Its results describe the engine workload on the machine running it. End-to-end latency needs measurements on a TV.

## Read the core

Start with the [architecture walkthrough](../docs/guides/architecture.md) for occurrence keys, registration generations, committed geometry, selection and host confirmation. The [collection guide](../docs/guides/collections.md) explains row entry and realization. [Public headers](include/itar/) and [behavioral tests](tests/) show the concrete types and expected outcomes. The [probe](include/itar/probe/) is a separate fixture target.
