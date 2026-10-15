# Android adapter work (ITAR-0045–0052)

This increment connects the independent production core to an owned Kotlin/JNI
adapter. Runtime support remains gated by device and screen-reader acceptance;
compilation and emulator fixtures do not establish Android TV or Fire OS support.
The disposable `probes/android` implementation remains available for comparison.

## Boundary (ITAR-0045)

`packages/itar/android` links `itar::core`, including `State` and `Transactions`.
Each surface owns both, with transactions destroyed first. UI-thread calls carry
monotonically unique positive lifetime tokens rather than addresses. Native
storage is bounded to eight simultaneous surfaces per owner thread. Tokens are
process-unique, including across threads; stale tokens cannot access replacements.
The C++ boundary also rejects entry from another owner thread.

JNI copies bounded scalar buffers and retains no Java arrays, strings or views.
Negative boundary results distinguish stale lifetime (-1), conversion (-2),
resource exhaustion (-3), contained failure (-4) and wrong owner thread (-5).
Allocation failure and other C++ exceptions are contained before returning to JNI;
JVM allocation exceptions propagate normally. Kotlin disposal is idempotent.

Focused check: strict Apple Clang 21 / CMake 3.31.6 Release build and
`ctest --test-dir build/core -R android.boundary --output-on-failure`: 1/1 pass.
It covers create/use/dispose, stale replacement, capacity, wrong-thread entry,
allocation failure and contained exceptions. Native conversion/lifetime tests
are compiled into the consumer instrumentation APK; execution is recorded below.

Boundary consumer build: Gradle 9 / AGP 8.12 / Kotlin 2.1.20, JDK 17.0.15,
SDK 36, NDK 27.1.12297006; `assembleDebug assembleAndroidTest` passes.
Android TV API 36 arm64 emulator, reader off: both explicit BoundaryTest cases
pass (2/2); the legacy runner enumerates private Kotlin synthetic methods when
given a whole class. New tests use named scenario helpers to avoid that issue.

## Mounted registration (ITAR-0046)

Owned `ItarTarget` carriers use generated RN TV 0.83 declarations. Occurrence
keys are opaque and surface-wide; content IDs never stand in for occurrence keys.
Labels and enabled props commit before eligibility. Detach revokes the weak host
mapping before reporting mount loss independently of a configuration batch.
Root/window loss preserves unknown focus; surviving foreign controls are unmanaged.
The initial geometry subset uses untransformed, fully visible rectangles; clipped
or unmeasured views remain ineligible. Layout/scroll invalidation precedes posted
remeasurement. No third-party registration or collection realization is supplied.

Strict `android.registration` passes duplicate-key, distinct-occurrence, detach,
reuse, invalid geometry and stale-layout cases. Codegen and Kotlin compilation
pass. The narrow schema prerequisite does not complete the Phase 09 public API.
