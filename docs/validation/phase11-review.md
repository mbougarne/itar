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
| ITAR-0079 | Reference app **Release validation**: same 8-card geometry for native/Itar; pinned library 5.2.0 comparison mode with corrected native event typing, delayed 0/750/2000ms bounded JS load | Full input-to-visible timing, comparison runtime acceptance, native frames/binary/startup and all device runs unrun. |
| ITAR-0080 | `core.lifecycle_memory`: 100 create/reveal/cancel/dispose cycles, fixed checkpoints and exact owned heap cleanup, trace release, normal mounted/logical distinction | Android debug functional follow-up covers nested dialogs, distant reveal/cancel, stable-key reorder and3 disposal/remounts; route return failed. Native long-session retained views/counters and host caches remain unmeasured; no leak acceptance. |
| ITAR-0081 | [Device protocol](device-acceptance.md), Android TV/TalkBack and Fire OS/VoiceView separate rows | Named physical hardware and all reader-disabled/enabled results required. |
| ITAR-0082 | [Device protocol](device-acceptance.md), Apple TV/VoiceOver navigation/exploration separate rows | Named physical Apple TV, remote gestures/momentum, native effects/reduced motion and speech observations required. |
| ITAR-0083 | `prepare-package.cjs`, package-local CMake/core podspec/license, package-named native podspec selection, `check-package.cjs` installs a tarball into an isolated non-workspace consumer and compiles portable core + Apple C facade | Fresh Android/tvOS builds pass; Android emulator registration/focus/style/list smoke passes. Apple runtime is blocked by OS denial creating an external simulator cache directory. Portable compilation cannot satisfy native consumer acceptance. |
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

At candidate `3864adc`, working-app build/typecheck, 18 JS tests and lint passed; the new screen warning was corrected and affected lint passed without warnings. That candidate’s single-worker Metro Release bundle passed after resolving external dependency symlinks, before the comparison mode was integrated. The CLI podspec override was rejected and replaced by its supported package-name selection convention. The initial comparison type failure is resolved by a version-checked native event declaration correction; its mode is now integrated. Native runtime and timing acceptance remain open.

App-level `react-native config` confirms the selected native spec is `itar.podspec`; the rejected override is removed. The original checkout remains clean. Draft publication is the only requested publication step.

## Comparison type correction

The pinned TV list's `CellRendererProps.onFocusCapture` used a global event type
by omitting its native import. The runtime Flow source imports React Native
`FocusEvent`. With the comparison library's Node type reference, the global React
event placeholder acquires Node Event fields and ceases to match a native event.
`prepare-tv-types.cjs` restores the import in a 212 KB, ignored, owned type copy;
root TypeScript paths select that declaration only. The script refuses unexpected
versions/declaration shapes and never edits the shared dependency installation.
The comparison and a Node-global native callback assignability regression are
included in normal typechecking. This is a type-declaration correction, not a
change to native event handling or a runtime acceptance result.

Lightweight correction evidence: with Node22.23.4/npm10.9.9, normal typechecking
(including the integrated comparison and Node-global regression) passed; targeted
lint passed without warnings. The negative control points only that type fixture
at the original installed declaration and fails all three native-event assertions
as expected. Runtime JavaScript and the original installed declaration are not
modified. Native consumer builds now proceed serially; timing/memory measurements
remain held for a separate coordinator slot.

## Fresh native consumer builds

At candidate `90020dd`, a new TV template outside the monorepo installed the
same tarball as a real directory with Node22.23.4/npm10.9.9 and passed its own
App typecheck. `:app:assembleDebug` then passed with JDK17, Gradle9.0.0,
SDK36/NDK27.1.12297006, one Gradle worker and one Ninja compile/link pool.
All79 tasks executed. Both the app and library native CMake builds completed.
The compile database identifies23 packaged Itar C++ units, including the JNI
connection and registry, exclusively below the consumer's `node_modules/itar`.
The APK contains the fixture JS strings, bundled JS, `libitar_android.so` and
`libappmodules.so` for arm64-v8a. APK SHA-256:
`489651806a676620963c07b916eb431c562bded25325cbd6702d61a323d1ae63`.
Local evidence: `itar-phase11-artifacts/native-consumers/android-evidence.json`.
Existing Kotlin deprecation/naming, SDK XML compatibility and Gradle deprecation
warnings are recorded; none was suppressed. A task-owned Google TV API36 ARM64
emulator (image revision3, 720p,
2 cores/2GB) installed and launched this APK. Initial managed focus was first;
Right confirmed second, moved its native orange text accent and restored the
first base style. Native Tab entered the list; Right confirmed item1 and a cold
reveal confirmed item3 with visible items3–5. UI-tree focused nodes/committed
button labels agree with the app observed keys; screenshots were inspected.
The crash buffer was empty. This is bounded emulator smoke, with no reader,
physical-device, performance or long-session acceptance. The task emulator and
its isolated ADB server were shut down; no physical-device command was issued.

The tvOS Ruby bundle resolves from its own external path with frozen
repository-declared versions; CocoaPods1.16.2 is verified. Anonymous public
transport checks passed (fmt11.2.0 Git tag and public CDN HTTP200). The installer
uses supported task-local Ruby NETRC, curl netrc-file configuration and Git
empty-auth configuration. Normal TLS and file validation remain enabled; user
credentials and global settings were not changed. Frozen dependency
installation passed with80 pods. The fresh consumer Release
arm64/tvOS27 simulator build passed serially with signing disabled. It compiled
24 packaged C++/Objective-C++ units and the Swift adapter, then linked the app
and JS bundle. The executable contains `itar_engine_create`, `ItarSurfaceHost`
and `ItarTargetHost`; SHA-256:
`52e6c1e12ce5a9045884bc003e8d8c1c6963e0945253b3b5b51e9d94ffa955ec`.
Local evidence: `itar-phase11-artifacts/native-consumers/tvos-evidence.json`.

Apple runtime smoke is **BLOCKED**: creating a task-owned external tvOS27
device set failed when CoreSimulator could not create `data/Library/Caches`
(NSCocoaErrorDomain513 / NSPOSIXErrorDomain1, operation not permitted; simctl
exit22). Follow-up inventory is empty; no simulator booted. No retry, alternate
internal-storage device, permission/security change or user-device reuse was
used to bypass the denial. Owner-authorized OS access to the external task
directory is needed before this runtime path can continue. Read-only follow-up
confirmed kernel System Policy read/create denials for CoreSimulatorService;
custom `--set` support, writable APFS and normal directory metadata were verified.
Owner inspection of Files & Folders / Removable Volumes is pending; no specific
UI grant or permission change has been tested.

From the fresh consumer's `ios` directory (external caches configured):

```sh
ITAR_NATIVE_ARTIFACTS=/Volumes/externalStorage/oss/itar-phase11-artifacts/native-consumers
bundle exec pod install --no-repo-update
EXTRA_PACKAGER_ARGS='--max-workers 1' xcodebuild \
  -workspace ItarTarball.xcworkspace -scheme ItarTarball \
  -configuration Release -sdk appletvsimulator \
  -destination 'generic/platform=tvOS Simulator' \
  -derivedDataPath "$ITAR_NATIVE_ARTIFACTS/tvos-derived" -jobs 1 \
  ARCHS=arm64 ONLY_ACTIVE_ARCH=YES CODE_SIGNING_ALLOWED=NO build
```

The consumer declares the packaged core pod at `../node_modules/itar`;
autolinking selects its package-named native spec. SDK27 scene lifecycle and
the pinned RN fmt11.2.0 compatibility setup follow the existing
[TV shell recipe](../rn-probe-shell.md). No application-wide Swift/C++
interoperability flag is added. Logs and native evidence JSON stay under the
external `itar-phase11-artifacts/native-consumers` directory.

## Android functional follow-up

At library inputs `90020dd` / fixture source `e150385`, the existing tarball APK
loaded unchanged `ReactApiScreen.tsx` and `VirtualizedScreen.tsx` through local
Metro8107 (one worker), with an outer mount/unmount selector. No native rebuild,
new dependency or library change. Google TV API36 ARM64, reader off, same
720p/2-core/2GB task emulator; debug mode, not Release performance acceptance.

- Remote Tab/DPAD: focus rail B returned `applied: confirmed`; one Center emitted
  one input activation with the matching occurrence/content identity.
- Inactive home-route targets disappeared from the visible accessibility tree.
  **Route return failed:** a subsequent return reported `unavailable: unavailable`
  and unmanaged focus instead of restoring the last observed managed key. Cause
  remains unresolved; no retry loop or fallback is counted as restoration.
- Owned dialogs opened/nested/dismissed. Window identities changed from app+outer
  to app+outer+inner and back to the same app+outer. The invoking control was
  unmanaged; managed-opener disposal/restoration is not established.
- List start and item30 reveal confirmed matching labels/keys. After reversal,
  focusing key0 still confirmed item1. Removing nonfocused item2 removed its UI;
  this does not test focused-source disappearance. Delayed reveal settled as
  `cancelled: cancelled` with the original window still visible.
- Three disposal/remount cycles removed the surface UI and recreated fresh request
  state. Crash buffer empty. This is not the required100-cycle retention test.

Touch-injected focus commands separately returned `unavailable: reconciled`,
with absent focus. The initial RN StrictMode/Touchable warning overlay was
retained and dismissed, not suppressed; touch-mode acceptance is not claimed.
A first restoration assertion incorrectly expected an older item after Tab had
visited another managed target; the valid later return failure above compares
against the most recently observed key and remains a release gate.

Before this run the shared host had11015MiB swap used (12288MiB total),406870
compressed-memory pages (~6.21GiB at16KiB/page), and memory-pressure free44%.
No native timing/memory benchmark was attempted on this contaminated baseline.
Local evidence: `native-consumers/android-functional/summary.json`, failure XML/
screenshots, modal window comparison and fixture hashes. Task emulator, isolated
ADB server and Metro exited; no Apple retry, permission change or physical action.

Remaining steps: reproduce/repair route return at the native commit/readiness
boundary without implicit retries; establish managed-opener and focused-source
removal/recycling cases; run the [Release comparison and100-cycle retention
protocols](device-acceptance.md) on a suitable measured host, with native markers,
owned-view/counter observations, warm-up/checkpoints/quiescence and two runs;
finish Apple consumer runtime after owner permission resolution, then separate
physical TV/reader acceptance. Unmeasured components and failures stay open.
