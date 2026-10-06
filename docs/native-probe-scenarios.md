# Shared native probe protocol v1 (ITAR-0003)

This is a manual experiment/report contract for Android/Kotlin and Apple/Swift
probes, not the public API or deterministic engine replay format. No scenario
has run yet. Use the [candidate toolchains](probe-toolchains.md), recording any
deviation. A passing simulator result cannot establish physical-device support.

## Fixture and observations

Place managed episode **A** below managed destination **B**, and an unrelated
focusable **D** (Play/default) to the side. D remains present through every
removal case; run it both registered and deliberately unmanaged. Give targets
distinct synthetic labels, roles, enabled states, and activation counters before
making them eligible. Record occurrence key, native identity alias, and mount
generation separately. B can begin known but unmounted, then appear on a
controlled release signal. Reset host focus to A and confirm it before each run.

Observe input focus at the host boundary, before the adapter's removal callback
where possible, inside callbacks, after the host call returns, and after layout.
Capture highlight/video and reader speech separately from focus events. Log
unavailable observation coverage; do not infer that an unseen jump did not occur.
Every observation is one of:

| State | Required evidence |
| --- | --- |
| managed | Live host target alias, occurrence key and mount generation |
| unmanaged | Host confirms a target outside Itar; retain a synthetic alias |
| absent | Host query/event establishes no focused target at the named boundary |
| unknown | Observation missing, ambiguous, or resynchronization pending |

Zero Itar registrations, detach, or failed focus requests alone never establish
absence. Log accessibility focus independently; it need not equal input focus.
The host accepting a request does not confirm focus. Observed late effects must
be reconciled even when their request was cancelled.

## Repeatable cases

For each applicable case run JS idle and a bounded 2-second JS busy interval,
reader off and on, with native observation still active. Gate delayed B and
callback permutations explicitly; wall-clock sleeps alone are not ordering proof.
Use Android D-pad outside touch mode, and Apple clicks, swipes, momentum and
repeated input. Record device/reader limitations as unsupported or not run.
TalkBack, Fire TV VoiceView, and Apple TV VoiceOver (navigation and exploration)
are separate runs, not interchangeable evidence. Also record reduced motion.

| ID | Steps / variants | Required observation and verdict |
| --- | --- | --- |
| P01 Mounted movement | Confirm A; Up to mounted B; Down to A; repeat/hold/release. Include nested scroll, native text/player controls and reader-owned input. On Apple try guides/preferences/constraints before scoped interception. | One owner per input; name actual host destinations and achievable policy; mounted focus and baseline visuals during JS load; native/system controls retain ownership. |
| P02 Delayed destination | Confirm A; withhold B; Up; hold/release; release B mount, geometry and callback in separate orders. Repeat with timeout, reverse input, explicit command, and scope exit before release. | One pending destination and original deadline; no queued future moves; B becomes eligible only with matching generation/geometry; no speculative focus/speech. No obsolete completion authorizes a new effect. |
| P03 Late default | Confirm A; mount new preferred/default content and B without user input, including a late initial-entry callback. | Eligible A stays focused; record any unsolicited host movement independently. Content arrival does not authorize an Itar move. |
| P04 Source disappears | While awaiting B, separately remove, clip, hide, disable and recycle A, with D focusable. Repeat replacement in one native mount batch, no remaining registrations, and unavoidable removal. Compare uncoordinated removal, bounded source retention and pre-removal transfer. | Capture targets before adapter notification and every intermediate target, highlight and speech. Dead A is never styled/activated; recycled A has a new generation. Report prevention and recovery separately, including unsupported list configurations. |
| P05 Inline callbacks | During focus invocation, trigger synchronous confirmation, redirect to D, invalidate target, or dispose surface. Capture callback-before-return and return-before-callback orders where host permits; fake-host variants must be labelled. | Copied inbox events; no recursive engine mutation/effect/React event; immediate handle invalidation; drain before next effect; deduplicate confirmation. Disposal revokes immediately and destruction waits for unwind. |
| P06 Cancelled dispatched work | Dispatch B focus/reveal; cancel and start replacement; deliver old host outcome and focus observation, including duplicate/wrong-generation results. | Old request stays cancelled; actual host outcome is reconciled; old cancellation cannot cancel replacement; no conflicting operations on the same host resource. |
| P07 Native feedback | Move A/B with JS busy; update base style; blur/recycle; repeat reduced motion and native parallax/effects enabled. | Supported declared style follows actual focus without React rerender/per-move JS; base restored, recycled style reset, stable navigation bounds, no competing effects. Record supported subset and visible timing, not a guessed budget. |
| P08 Activation and semantics | Select confirmed A; accessibility-activate B while input focus differs; repeat with disabled/detached/recycled targets and reader ownership changing during JS load. | One semantic activation for the live eligible target; no forced input-focus move for accessibility activation. Labels/roles/states/actions already committed; native ownership does not wait for JS. App callbacks may wait for JS. |
| P09 Reader loading | Repeat P02–P04 with each runtime's reader, rapid input and semantic updates. Observe actual spoken output and accessibility target independently. | No Itar speculative or duplicate announcements; record host intermediate speech, interruption/coalescing and recovery. Do not require one announcement per press or synchronous speech/highlight. |
| P10 Modal boundaries | From A open modal, navigate/activate, nest another modal, dismiss in both orders. Repeat failed presentation, removed opener and disposed opener surface. | Record windows/surfaces/scopes; covered routes leave directional eligibility and appropriate accessibility tree. Suspend/cancel covered work; reconcile host restoration before revalidated Itar restoration; no race or dead opener access. |

Retention runs must declare a finite time/view bound and show release on
confirmation, cancellation, timeout and disposal; retaining the whole catalogue
does not pass. Failed/unsupported prevention remains visible even when recovery
succeeds. Never repeatedly fight a host-owned or unknown target.

## Report template

Copy this block for each case/configuration. No blank required fields: use
`not observed` or `not run` with a reason. Store sanitized reports beside probe
code once it exists; attach bounded event logs and video/audio references.

```text
protocol: itar-native-probe/1
run: <unique ID>; case: <P01..P10 + variant>; date: <UTC>
revision: <full commit SHA>; local changes: <none or patch reference>
environment: <physical/simulator/emulator, model/ID, ABI, OS/build>
runtime: <RN TV, React, Hermes, renderer, package/Gem/Pod lock hashes>
toolchain: <CMake/compiler, NDK/Kotlin/JDK/Gradle/SDK or Xcode/Swift/tvOS SDK>
input: <remote/keyboard, click/swipe/repeat, Android touch mode, owner>
accessibility: <off or reader/version + navigation/exploration, speech settings>
visuals: <style subset, reduced motion, native effects>
setup: <layout, initial host-confirmed target, keys/generations, D registration>
steps: <numbered reproduction actions, gates/order, JS busy interval>
bounds: <deadline, retention time/view limit, event capacity, cleanup result>
capture: <host hook/query boundaries, monotonic clock, video/audio references>
events:
  seq | monotonic_us | thread/boundary | request/effect | event | input_focus | a11y_focus
  <ordered entries; include mount/generation, geometry, dispatch, callback, return,
   cancellation, invalidation, disposal, highlight and speech observations>
expectation: <case invariant and adapter capability under test>
actual: <ordered targets and observed behavior; distinguish intent from host facts>
prevention: <pass/fail/unsupported/not run + intermediate focus/style/speech evidence>
recovery: <pass/fail/unsupported/not run + final live target and ordering>
result: <pass/fail/unsupported/not run + reason, limitations, missing coverage>
artifacts: <sanitized log/video/audio paths, hashes, reproduction command>
```

Assign event sequence at native capture, not delayed JS receipt. Include
correlation when available; use `uncorrelated` rather than invent an effect ID.
Record clock alignment and capture gaps. On buffer overflow stop the run and
mark it inconclusive (`not run` for the affected verdict), never silently drop
lifecycle facts or mark incomplete coverage as pass.

Example interpretation only: `A → unmanaged D → B` with final B confirmed is
**prevention: fail**, **recovery: pass** if B is live and authorized. If the
intermediate interval was unobserved, prevention is **not run**, not pass.
`unsupported` requires evidence of a runtime limitation; missing hardware is
**not run**. Probe verdicts are distinct from ticket status (Backlog/In Progress/Done).
