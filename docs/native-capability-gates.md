> Historical evidence from 2026-10-06, restored from merged PR [#5](https://github.com/mbougarne/itar/pull/5).
> The original dated record below is preserved unchanged. Its PR states, ticket
> states, dependency findings and statements that probes have not run describe
> that date; they are not a current acceptance assessment.
> Later evidence is recorded in [Android host probes](android-host-probes.md),
> [the Android probe run](android-probe-run-2026-10-07.md), and
> [Apple host probes](apple-host-probes.md). Consult those records for later
> findings and remaining device/accessibility gates. This restoration changes
> no ticket status, architecture decision or platform-support claim.

# First native capability gates (ITAR-0006)

Status: **In Progress**, 2026-10-06. This is an evidence-gap record, not a
completed capability decision. ITAR-0013 (Android feasibility) and ITAR-0020
(Apple feasibility) are both Backlog; their prerequisite host experiments have
not run. No production adapter may be selected or promoted from this record.
The accepted September 30 architecture is unchanged.

## Evidence available

- Foundation [draft #2](https://github.com/mbougarne/itar/pull/2) remains unmerged.
- [RN shell evidence](rn-probe-shell.md) records reproducible commands and exact
  tool versions. Node 22.14.0/npm 10.9.2, React 19.2.0 and RN TV 0.83.0-0 pass
  local package resolution, typecheck, lint, consumer tests and both JS bundles.
- Generated Android **arm64-v8a build only**: debug APK and lint passed on
  JDK 17.0.14, Gradle 9.0.0, AGP 8.12.0, Kotlin 2.1.20, SDK 36, NDK
  27.1.12297006 and CMake 3.22.1. Lint had 15 template warnings; native unit task
  had no source. Neither installation nor a Kotlin/JNI probe round trip ran.
- Generated Apple **shell build**: CocoaPods 1.16.2/xcodeproj 1.27.0 resolves 78
  pods with Ruby 3.4.2/Bundler 2.6.9, including clean deployment installation.
  Xcode 27.0 (27A266a), tvOS SDK 27.0 and Apple Clang 21 build both simulator
  architectures with fmt 11.2.0; compile-time checks remain enabled. The original
  fmt 11.0.2 incompatibility is repaired. A scene-owned template window fixes the
  SDK 27 launch gate; the tvOS 27 simulator renders the A/B/D shell. No Swift/C++
  round trip or remote/reader/native-focus acceptance has run.
- [Portable seam draft #3](https://github.com/mbougarne/itar/pull/3), revision
  `debe95de899d437d8adc2249ecd10de6d8b87569`, passes Release and ASan/UBSan tests
  and all five hosted checks. It is a deterministic fixture without host views;
  it does not establish any native capability.
- Availability inspection: an isolated ADB server reported no attached devices;
  Xcode listed tvOS 27 simulators but no connected physical Apple TV. No Android
  TV, Fire TV, Apple TV remote, TalkBack, VoiceView or VoiceOver scenario ran.

## Decisions and evidence still required

All host findings below are **not run**, not unsupported. An unsupported verdict
requires an actual experiment demonstrating a limit. Use the ordered evidence
format in [shared scenarios](native-probe-scenarios.md); include revision,
runtime/device/OS, ABI/toolchain, reader/input mode, capture gaps and artifacts.

| Area | Android / Fire OS gate | Apple TV gate | Present constraint |
| --- | --- | --- | --- |
| Binding/lifetime | ITAR-0007: Kotlin/JNI value round trip, stale handles, teardown | ITAR-0014: Swift/C facade round trip and consumer settings | App build or C++ tests cannot validate an adapter; no binding route promoted |
| Input ownership | ITAR-0008 / P01: focusSearch vs scoped key dispatch, native controls, busy JS | ITAR-0015 / P01: UIKit guides/preferences, clicks/swipes/momentum/repeats | One owner per input remains required; neither policy parity nor interception is selected |
| Committed geometry | ITAR-0008/0009: mounted bounds, clipping and generation | ITAR-0015/0016: same, including cooperative host selection | Geometry freshness and eligibility remain unverified |
| Removal/loading | ITAR-0009 / P02–P04/P09 | ITAR-0016 / P02–P04/P09 | Retention and pre-removal transfer remain candidates, without a validated bound |
| Callbacks/disposal | ITAR-0010 / P05–P06: real callback order plus synchronous fake host | ITAR-0017 / P05–P06: UIKit order plus fake host | Copied inbox, immediate invalidation and deferred destruction remain required |
| Native feedback | ITAR-0011 / P07: style/base updates, blur/recycle, busy JS | ITAR-0018 / P07: same plus UIKit effects/reduced motion | No native style subset is validated; this remains mandatory |
| Accessibility | ITAR-0011 / P08–P09: TalkBack; independently VoiceView on Fire TV | ITAR-0018 / P08–P09: VoiceOver navigation/exploration | Input focus, reader focus and activation remain distinct; no speech claim |
| Modal mapping | ITAR-0012 / P10: actual dialog windows, nesting/restoration | ITAR-0019 / P10: actual windows vs presented controllers | Surface/scope mapping and safe restoration hooks remain open |

For **each** remove, clip, hide, disable and recycle variant, on **each** Android
TV, Fire OS and Apple TV configuration: prevention = **not run**, recovery =
**not run**. Repeat with a competing default, same-batch replacement, no managed
registrations, JS busy and the platform reader. Capture intermediate native
focus, highlight and speech; eventual recovery alone cannot prove prevention.
A disconnected device is not evidence of absent host focus.

## Follow-up boundary

1. Keep ITAR-0006 In Progress. ITAR-0013/0020 must supply reproducible, named
   proceed/limited/blocker decisions after their host probes; this note does not
   change their dependencies or acceptance criteria.
2. Keep the RN shell draft gated on its unresolved dependency audit. The current
   high-severity braces advisory has no published patch; no security exception
   is justified by the shell being private. Record a compatible fix before
   declaring its checks green.
3. The fmt build repair enables Apple binding experiments; it cannot replace
   ITAR-0014 or the remaining UIKit/reader probes feeding ITAR-0020. Building
   a host-button shell does not establish ownership, callbacks or safe teardown.
4. Continue independent core work against the accepted contracts. Android build
   success cannot establish Fire OS; broader TV/console research need not block
   the core. Native feedback and accessibility remain production gates.

No probe evidence conflicts with the accepted architecture because no host
experiment has yet produced a finding. The repaired toolchain build does not
resolve the open native capability choices or justify changing the architecture.
