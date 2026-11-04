# Phase 11 code-only follow-up — 4 November 2026

Release decision: **NOT READY**. This work implements bounded code/test gaps and
completes the [Phase 12 feasibility records](../runtime-research/README.md).
No app, emulator, simulator or physical-device session was run. No SDK was installed,
package published or release tagged. The accepted architecture is unchanged.

Base main revision: `09d687bccc5700e0c80f429bc5be514da2e079e6`, containing PR #20
merge `291a3d4f180ba05c06059ba52c2bbebeaf0d5484`. Candidate: the reviewed diff on
`work/phase11-code-validation-phase12-research` over that base. Record the resulting
commit when committing this work; the package integrity below identifies the
actually tested artifact. Older native builds remain [historical evidence](phase11-review.md).

## Independently reviewable ticket slices

| Ticket | Current result | Still required |
| --- | --- | --- |
| ITAR-0076 | Done: replay preserves explicit input owner, authority and source; input/accessibility focus remain separate in results. Captured non-engine input emits no focus effects; an engine-owned equivalent does. Existing capacity, disabled capture, overflow and disposal checks pass. | Internal diagnostics only; adapters must supply ordered events. This does not fix the reported TalkBack jump. |
| ITAR-0077 | Done: Release and ASan/UBSan suites pass; generated seeds 1–128 pass with 64 operations each. | Other compiler/platform configurations remain untested by this run; generated coverage is bounded. |
| ITAR-0078 | Done: fresh Release query/update/allocation results with logical/mounted counts and cold setup. | No TV latency or performance advantage inferred. |
| ITAR-0079 | In Progress: existing comparison screen and protocol inspected. | Matched native/Itar/library device timings, JS-stall/native-feedback measurements and calibrated budgets. |
| ITAR-0080 | In Progress: core lifecycle adds cancellation acknowledgement, route deactivate/reactivate, source recycling and stale accessibility observation; two 100-cycle runs after 10 warm-up cycles each. | Native retained views, caches, RSS trends, session duration and two physical long-session runs. |
| ITAR-0081 | In Progress: Chromecast feedback is now explicitly distinguished from unrun acceptance. | Reproduce/trace the known focus failures; full Android/TalkBack and separate Fire OS/VoiceView protocol. |
| ITAR-0082 | In Progress: physical Apple acceptance protocol exists. | Apple TV with VoiceOver modes, native feedback, loading/removal and restoration. |
| ITAR-0083 | In Progress: prepack rebuilds JS/types; Android build caches excluded; all declared export targets checked in an isolated tarball consumer; portable core and Apple C facade compile and execute. | Fresh native consumer acceptance for this artifact, including Apple runtime focus/style behavior. |
| ITAR-0084 | In Progress: dated support/gate record updated. | Passing native, accessibility, performance, retention and package-runtime evidence before a ready decision. |

Review code slices separately: capture/replay (0076), lifecycle (0080), packaging
(0083), and evidence/status reconciliation (0084). Each Phase 12 record is its own
research slice. No single implementation ticket exceeds the 500 authored-line ceiling.

## Verification and reproduction

Host: Apple M3 Pro, 18 GiB RAM, macOS 27.0.1, Apple Clang 21.0.0
(`clang-2100.3.34.2`), C++20; Node 22.23.4 / npm 10.9.9. Use that Node version on PATH.
Run sequentially with one compiler worker. All following executables are host tests,
including tests whose names contain Android or Apple; none starts a native app.

```sh
cmake -S core -B build/phase11-code-release -DCMAKE_BUILD_TYPE=Release \
  -DBUILD_TESTING=ON -DITAR_BUILD_BENCHMARKS=ON
cmake --build build/phase11-code-release --parallel 1
ctest --test-dir build/phase11-code-release --output-on-failure --timeout 60
build/phase11-code-release/itar_generated_tests 1 128
build/phase11-code-release/itar_core_costs
build/phase11-code-release/itar_lifecycle_memory_tests
cmake -S core -B build/phase11-code-sanitize -DCMAKE_BUILD_TYPE=Debug \
  '-DCMAKE_CXX_FLAGS=-fsanitize=address,undefined -fno-omit-frame-pointer -Wall -Wextra -Wpedantic -Werror'
cmake --build build/phase11-code-sanitize --parallel 1
UBSAN_OPTIONS=halt_on_error=1:print_stacktrace=1 \
  ctest --test-dir build/phase11-code-sanitize --output-on-failure --timeout 60
npm test
npm run typecheck
npm run lint
npm_config_update_notifier=false npm_config_offline=true \
  node scripts/check-package.cjs build/phase11-code-package
```

Results: 42/42 CTest cases in each configuration; no ASan/UBSan findings on this
configuration. The expanded generated Release run passed 8,192 operations; sanitizer
CTest includes its fixed 16-seed run. JavaScript: 48/48 tests, typecheck and lint pass.
The mocked HTTP tests needed local socket permission outside the sandbox; no live
catalogue/backend was started. Logs remain in ignored `build/phase11-code-*` directories.

[Raw core measurements](core-costs-2026-11-04.jsonl) distinguish 64/256/1024 logical
records from 64 mounted targets. Query p95: 1.584/5.000/18.666 microseconds, with zero
measured query allocations. One-record update p95: 20.792/230.125/4507.460 microseconds;
updates allocate. These are instrumented host timings, not a controlled device
comparison or an optimization decision. Cold setup and retained requested bytes are
reported separately. Both lifecycle runs returned owned requested bytes to baseline
at every cycle; checkpoints 10/25/50/75/100 reported zero growth. Peak process-requested
bytes: 134,672. Native views, RSS and host caches are unmeasured.

## Packaging regression evidence

The directory allowlist previously included local `android/build` and `.cxx` outputs.
On this built checkout npm pack failed with `Exit handler never called!`, including
with lifecycle scripts disabled. A package-local Android `.npmignore` excludes native
build caches; the same pack succeeds. No cache deletion is needed to package cleanly.

Prepack now rebuilds JS/types before staging native sources. A deliberate stale
`lib/index.js` sentinel was replaced during the test; the installed real tarball
export had the expected value. The consumer is outside the workspace and is not a
symlink. Every declared JS, type and React Native source export exists; Node export
resolution stays inside the installed package. This checks resolution and contents,
not runtime execution of the React Native entries. Portable C++ and the Apple C
facade smoke executable pass without React Native, JNI, UIKit or a simulator.

Artifact: `itar-0.0.0.tgz`, 157 files, integrity:
`sha512-wFjRnUjd+g63JzaknTRUQWV12hgeJwqJR1HXL0Jv3NgnrZpO8Z+nsvzUgmeNhXi8CEn2vdwyNcqmKl137LjglQ==`.
The exact local output directory is recorded in
`build/phase11-code-release/package-output-path.txt`; it contains
`package-evidence.json`, the archive and isolated consumer. No native build or
app-runtime acceptance was rerun for this artifact.

## Physical feedback carried forward, not reproduced here

On 1 November the user tested the application on Chromecast HD (Android 14), with
TalkBack off and on. Navigation felt responsive. With TalkBack, Down/scroll could
jump focus to the menu; loading/unavailable items could trigger nearest-node fallback.
Earlier reload/route focus jumps were also reported. This is qualitative user
feedback with known failures, not a complete acceptance or timing result.

The responsible layer remains unresolved. Next reproduction must correlate route
readiness, mounted identities, input/accessibility observations and issued effects,
separating an intermediate host fallback from later recovery. The new ownership
replay checks protect diagnostic fidelity; they do not establish that the native
adapter supplied the correct owner or prevented the physical jump. Fire TV and
Apple TV acceptance remain separate pending gates. No device interaction occurred
in this follow-up.
