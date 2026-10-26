# Phase 11 validation review

This is release preparation. No tag, package publication, marketplace upload or
deployment is part of this change. The release recommendation is **NOT READY**.
Base: `478ca6d5c26953ec268f1961a47017b1df0a0883`. Candidate identity is the PR head;
record `git rev-parse HEAD`, artifact integrity and toolchain with every run.

## Review by ticket

| Ticket | Change / evidence | Remaining acceptance |
| --- | --- | --- |
| ITAR-0076 | `core/internal/capture.hpp`, shared v1 replay, `core.capture`: disabled capture, record/payload overflow, explicit incomplete prefix, captured confirmation and disposal | Internal diagnostic tooling only; adapters must feed ordered protocol values to capture. Native renderer/animation/speech cannot replay in the core. |
| ITAR-0077 | `core.generated`: fixed seeds 1–16, 64 operations/seed, invalid geometry, duplicates, stale generations, dirty geometry, cancellation, repeated/reordered outcomes, host time, disposal; per-step queue bounds and live confirmation; existing transaction regressions | See sanitizer command/results below. No probabilistic completeness claim. |
| ITAR-0078 | `core/benchmarks/costs.cpp`: 64/256/1024 logical, 64 mounted; cold setup, retained requested bytes, query/update percentiles and allocation counts | Mac-only instrumented timings, no TV or speedup claim. |
| ITAR-0079 | Reference app **Release validation**: same 8-card geometry for native/Itar; pinned library 5.2.0 probe fails type integration, delayed 0/750/2000ms bounded JS load | Full input-to-visible timing, compatible comparison integration, native frames/binary/startup and all device runs unrun. |
| ITAR-0080 | `core.lifecycle_memory`: 100 create/reveal/cancel/dispose cycles, fixed checkpoints and exact owned heap cleanup, trace release, normal mounted/logical distinction | Native route/modal/recycling long sessions, native retained views and host caches unmeasured. This is a core-owner check, not native leak acceptance. |
| ITAR-0081 | [Device protocol](device-acceptance.md), Android TV/TalkBack and Fire OS/VoiceView separate rows | Named physical hardware and all reader-disabled/enabled results required. |
| ITAR-0082 | [Device protocol](device-acceptance.md), Apple TV/VoiceOver navigation/exploration separate rows | Named physical Apple TV, remote gestures/momentum, native effects/reduced motion and speech observations required. |
| ITAR-0083 | `prepare-package.cjs`, package-local CMake/core podspec/license, package-named native podspec selection, `check-package.cjs` installs a tarball into an isolated non-workspace consumer and compiles portable core + Apple C facade | Fresh Android TV/tvOS builds and registration/focus/style execution still required. Portable compilation cannot satisfy native consumer acceptance. |
| ITAR-0084 | This review, measured core results, support/gate matrix and exact artifact evidence record | No shipping runtime claimed; release stays blocked by native/device gates. |

## Reproduction

Keep all outputs and dependency caches on the external volume. Run sequentially;
use one compiler/Gradle worker and one active emulator/simulator at most.
All fixtures use synthetic/local keys and geometry.

```sh
cmake -S core -B build/phase11-release -DCMAKE_BUILD_TYPE=Release \
  -DBUILD_TESTING=ON -DITAR_BUILD_BENCHMARKS=ON
cmake --build build/phase11-release --parallel 1
ctest --test-dir build/phase11-release --output-on-failure --timeout 60
build/phase11-release/itar_generated_tests 1 16
build/phase11-release/itar_core_costs > build/phase11-release/costs.jsonl
build/phase11-release/itar_lifecycle_memory_tests
cmake -S core -B build/phase11-sanitize -DCMAKE_BUILD_TYPE=Debug \
  '-DCMAKE_CXX_FLAGS=-fsanitize=address,undefined -fno-omit-frame-pointer -Wall -Wextra -Wpedantic -Werror'
cmake --build build/phase11-sanitize --parallel 1
UBSAN_OPTIONS=halt_on_error=1:print_stacktrace=1 \
  ctest --test-dir build/phase11-sanitize --output-on-failure --timeout 60
npm run build
npm run typecheck
npm run lint
npm test
node scripts/check-package.cjs /Volumes/externalStorage/oss/itar-phase11-artifacts/package-check
```

The seeded runner prints generator version, seed, step index and event kind;
configuration plus the seed deterministically reconstructs every protocol value.
Count is capped at 128 seeds; the default is 16. No sleeps or system-clock inputs.
Replay compares decisions, effects, notifications, final records/focus and active
state. Existing specific cancellation/outcome tests supplement generated checks.
The custom allocation meter belongs only to executables; it measures requested
C++ heap bytes, excludes allocator metadata/RSS, and adds instrumentation overhead.
It handles ordinary/aligned/array/sized allocation and deletion. Disabled trace
recording is checked for zero allocations with an already-created protocol value.
Capture storage is bounded by record count plus variable payload budget; copying
initial values and each enabled record may allocate. Overflow preserves a prefix
for inspection but makes `complete()` unavailable. Disabling/disposal frees it.

## Support and release gates

| Configuration | Ownership / native styles | Accessibility / stability | Release state |
| --- | --- | --- | --- |
| RN TV 0.83.0-0, Android TV, fixed-extent TV FlatList | Engine mounted direction; native observed-focus text feedback | Physical TalkBack and removal/prevention vs recovery pending | Unaccepted candidate |
| RN TV 0.83.0-0, Fire OS, same list | Must be independently observed; Android is insufficient | Physical VoiceView pending | Unaccepted candidate |
| RN TV 0.83.0-0, tvOS, same list | UIKit chooses mounted directions/gestures; explicit engine preferences; native border | Physical VoiceOver navigation/exploration, reduced motion and removal pending | Unaccepted candidate |
| Vega/Tizen/webOS/VIDAA/Xbox/PlayStation/Web/Wasm | Runtime research only | No acceptance | No support claim |
| Roku | Excluded | Excluded | Excluded |

Go requires each advertised configuration to have linked passing exact-candidate
correctness/sanitizer, end-to-end performance, native memory, physical reader and
fresh-tarball native-consumer evidence. Failures, unavailable devices or missing
measurement components mean no-go. MIT license is included in the tarball; no
stable C++ binary ABI is promised. API/setup documentation remains provisional.
Do not infer source-removal prevention from successful recovery or JS independence
from selection timings. No universal policy parity or one-announcement-per-key
promise is made. Package checks do not publish anything.

## Local measurement record — 2026-10-26

MacBook Pro `Mac15,6`, Apple M3 Pro, 18 GB, arm64; macOS 27.0.1 (26A434).
CMake 3.31.6, Apple Clang 21.0.0, C++20 Release. Build:
`build/phase11-release/itar_core_costs`, stock Release flags (`-O3 -DNDEBUG`).
[Measured JSONL](core-costs-2026-10-26.jsonl) records all percentiles and totals.
At 1024 logical / 64 mounted: query p50/p95/p99 = 18.375/24.084/26.167 us,
0 measured allocations; one-record update = 4.093/4.196/4.267 ms, 8 allocations
per update. Retained core requested bytes: 262144. Cold setup: 8.842 ms.
This is one instrumented run on a shared development Mac; no speedup, device
budget or universal allocation-free navigation claim follows. No optimization
was selected. Native UI scheduling/visible feedback are outside this executable.

Release and ASan/UBSan full suites passed 40/40; after the final capture-decision
hook, all four affected cases passed again in both configurations. Strict warnings
were enabled in the sanitizer build. No sanitizer findings on this configuration.
`core.lifecycle_memory` checks 100 owner lifetimes with zero retained owned bytes
at every post-destruction checkpoint; native views/caches and long sessions remain
unmeasured. Local JS tools are Node 22.14.0/npm10.9.2; repository/CI pins are
22.23.4/10.9.9, so local JS results do not verify the pinned runtime.

Physical Apple TV was absent from the connected-device inventory. No physical
Android TV/Fire OS or remote/reader session was supplied or exercised. No device
pass, reader speech result or native support acceptance is inferred.

Fresh outside-monorepo consumer: `itar-0.0.0.tgz`, SHA-1
`6998f92ec2faa618a30db38ba1cdc01a324f2ac9`, npm integrity
`sha512-JXN1juPB8hJRYOF1VSXQkQKz48H4yVOScPvqHdBE35H7EqERsMrXv6e7ljUqSQO5cUE44+2OZeV/4JQ9RMsr5Q==`.
File list and install/compile evidence are in the local
`itar-phase11-artifacts/package-check/package-evidence.json` next to the worktree.
The installed package is a real directory, not a workspace symlink; core and C
facade compile/run from its own sources. Both podspecs pass Ruby syntax checks.
No Android/tvOS host build or native focus/style run is inferred from this result.
Benchmark executable SHA-256:
`6290044affc8b6a7562ab79baabe6607e0208965a4f67a976e54a66b51d6fa5c`.
The npm lockfile change was generated by npm10.9.2 from the exact comparison
`react-tv-space-navigation@5.2.0` input; it adds four packages, not generated code.
The baseline is MIT; its LRUD dependency is Apache-2.0 (see installed notices).
The tarball's C++ source staging is mechanical and ignored; generator is
`packages/itar/scripts/prepare-package.cjs`, run by Node22.14.0/npm10.9.2.
Authored capture/replay changes remain within the 500-line ceiling despite moving
the existing replay definitions: review the shared replay move separately from
the new bounded capture and allocation instrumentation. Other ticket slices are
below the 250-line target, excluding mechanical lock/result records.

Final working-app build/typecheck, 18 JS tests and lint passed; the new screen warning was corrected and affected lint passed without warnings. Final single-worker Metro Release bundle passed after resolving external dependency symlinks. The CLI podspec override was rejected and replaced by its supported package-name selection convention. The pinned comparison probe still fails type integration as documented, and remains outside the working app.

App-level `react-native config` confirms the selected native spec is `itar.podspec`; the rejected override is removed. The original checkout remains clean. Draft publication is the only requested publication step.
