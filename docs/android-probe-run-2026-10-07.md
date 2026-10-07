# Android probe run — 2026-10-07

Implementation revision: `e95d5768d06380205ad068c44158e8ee0b28f360`.
Protocol: itar-native-probe/1; bounded emulator subset P01/P04/P05/P07/P10.
Commands and ownership limits: [probe guide](android-host-probes.md).

Environment: task-owned Android TV emulator, API 34 / Android 14,
`sdk_google_atv64_arm64`, build `UTT1.240131.001.F1/11825476`, arm64-v8a.
RN TV 0.83.0-0 / React 19.2.0 / Hermes / Fabric interop. Reader services: none.
Input: instrumentation `requestFocus` and synthetic Up down/up, outside touch mode.
No physical remote, reader speech, reduced-motion setting, or Fire OS run.
Host: macOS, Apple Clang 21, CMake 3.31.6; Homebrew JDK 17.0.15 (deviation
from candidate Zulu 17.0.14), Gradle 9.0.0, AGP 8.12.0, Kotlin 2.1.20,
SDK 36, NDK 27.1.12297006 and native CMake 3.22.1.
Local Node 22.22.1/npm 10.9.4 differ from the pinned CI 22.14.0/10.9.2.
No dependency or lockfile version was changed.

Follow-up validation of the activation-lifetime guard in the commit introducing
this paragraph: native build/lint pass and 10/10 instrumentation tests pass in
6.992 seconds. Recycled and disposed targets reject programmatic activation;
these deterministic assertions do not establish screen-reader activation behavior.

## Actual results

- `assembleDebug assembleAndroidTest lintDebug`: pass. Probe lint: zero errors,
  three warnings (probe-only literal labels/text); no baseline or suppression.
  RN template warnings remain separate. The NDK flexible-page setting produces
  16 KB-aligned arm64 LOAD segments; no 16 KB device runtime is claimed.
- Instrumentation: **10/10 tests pass**, 5.809 seconds. Includes 100 JNI lifetime
  cycles and stale-token rejection after replacement, wrong-thread rejection,
  deterministic fake-host reentrancy/disposal, read-only repeated queries, one
  native invocation for an Up down/up pair, redirect/invalidation/disposal,
  base-color restoration, recycling, seven disappearance variants, pretransfer,
  nested dialogs, deliberately withheld presentation and opener disposal.
- RN consumer installs/launches and renders the actual native module under Fabric.
  Instrumentation replaces the Activity content with the same native root for
  deterministic assertions; it is distinct from the RN rendering observation.
- Portable Release and ASan/UBSan: **3/3 CTest each**, warnings-as-errors.
  RN package build/typecheck/lint, **2/2** consumer tests and Metro bundle pass.
  actionlint 1.7.11 and whitespace checks pass.
- Manual npm audit exits **1**, reporting **31 findings: 26 high, 5 moderate**.
  Current registry versions braces 3.0.3 and sprintf-js 1.1.3 and GitHub advisory
  records still supply no patched release. Full output was retained locally;
  no exception or forced major upgrade was applied. Actions no longer executes
  npm audit, including implicit install auditing; other checks remain required.

A separate live RN P01 run observed JS busy-start at emulator log time
13:34:40.867 and busy-end at 13:34:42.867. During that interval, native Down/Up
moved B → A → B, each with one probe-owned dispatch and confirmed host focus.
Native key-capture to focus-callback deltas were 0.340 ms and 0.126 ms; the idle
sample was 0.920 ms and 0.159 ms. These single emulator samples establish native
execution during that bounded JS stall, **not** a latency benchmark or
input-to-visible-feedback measurement. Native style callbacks ran in the same
interval; synchronized video and reader speech were not captured. Log wall time
was used only to bracket the JS interval; deltas use native monotonic nanoseconds.

Representative observed P05 sequence (native capture order):
`entry B → callback B → injected disable B → callback A → return A`.
The host returned acceptance, but confirmation was false because B was invalid
and actual input focus was A. Redirect similarly observed B then unmanaged D,
returned acceptance and rejected confirmation. In-callback disposal returned
false and prevented the next invocation. These are emulator facts, not platform
ordering guarantees. No host/JNI references are stored by the native connection.

For P04 pretransfer, the test observed final B after A was removed and rejected
A thereafter. Baseline variants record actual post-removal focus separately.
**Prevention: not run** for visible feedback/speech because no synchronized
video/audio capture establishes every intermediate frame or utterance.
**Recovery: pass only for final native B in this explicit pretransfer fixture**;
no delayed destination, list retention or eventual recovery policy was tested.

P10 observed two native dialog shows/dismissals and rejected root movement while
its window lacked focus. Withheld presentation is not a measured BadToken failure.
Reader tree eligibility, native restoration order across frames, real failed
presentation and physical modal behavior remain unresolved.

## Ticket disposition and remaining gates

| Ticket | Disposition |
| --- | --- |
| ITAR-0007 | Binding/build/lifetime subset verified on the named emulator; Fire OS unrun. |
| ITAR-0008 | Mounted native movement/query subset verified; nested controls and reader/nested-control busy-JS matrix remains open. |
| ITAR-0009 | Seven disappearance variants/pretransfer exercised; visible/speech prevention unresolved. |
| ITAR-0010 | Fake-host and emulator inline callbacks, stale confirmation and disposal verified. |
| ITAR-0011 | Native color/reset subset verified; TalkBack speech/activation and VoiceView unrun. |
| ITAR-0012 | Bounded dialog fixture exercised; full restoration/failure/reader matrix open. |
| ITAR-0013 | Limited prototype viability; production hook selection unresolved pending remaining evidence. |

All seven tickets remain **In Progress** in local ticket/index records. The user
requested one grouped draft; this does not waive acceptance. No physical Android
TV, Fire TV/Fire OS, TalkBack or VoiceView pass is claimed. Repeated/end-to-end busy-JS timing,
reader navigation/activation/loading, nested scroll/text/player ownership,
retention deadlines, cancellation and production package integration are not
established by these tests. ITAR-0006 receives this limited result; production
ITAR-0045–0052 must retain their probe and accessibility gates.
