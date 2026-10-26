# Phase 11 acceptance checklist

Prepared only; this checklist initiates no hardware request or device run.
Android and tvOS fresh-consumer compilation passed. Bounded Android emulator
registration/focus/style/list smoke passed; Apple simulator creation is blocked
by OS denial in its external device set. All other runtime cases remain
**NOT RUN** until evidence is attached. Coordinate
timing/memory measurements separately. Use synthetic labels/content only.

## What the available local targets can establish

| Target | Available validation | Cannot establish |
| --- | --- | --- |
| Portable host / CI | Capture/replay, seeded invariants, sanitizer checks; separate core timing/allocation data | Native focus, retained views, visuals or speech |
| Google TV API36 ARM64 image (`google-tv`) | Fresh tarball Android build and registration/focus/style/list smoke; route/modal/loading/cancellation/recycling; mounted native/Itar/library comparison; bounded native memory/view trends | Physical Android TV behavior/budgets or physical TalkBack; never Fire OS/VoiceView |
| tvOS27 simulator (runtime inventory reports available) | Fresh tarball Swift/C-facade build without app-wide interop; UIKit-owned navigation/preferences, native styles, route/modal/list smoke, synthetic presses, bounded memory and stall observations | Physical Siri Remote clicks/swipes/momentum, real-device latency/memory budgets, physical VoiceOver navigation/exploration/speech |
| Simulator accessibility inspection | Committed labels/roles/states, inactive-tree exclusion and supported semantic actions; any available reader events are supplementary | Acceptance of the three physical TV readers or absence of audible intermediate announcements |

Inventory is not a boot/build/run result. Use task-owned instances on external
storage; do not reuse another project's active instance. A profile named
`fire_tv_emulator` is not evidence of an installed Fire OS or VoiceView runtime.
Simulator timings describe that simulator/Mac only; do not turn them into TV
performance budgets. Run Android and tvOS sequentially, with bounded workers.

## Short physical acceptance sequence (ITAR-0081 / ITAR-0082)

Record each configuration separately: Android TV reader off/TalkBack on; Fire OS
reader off/VoiceView on; Apple TV reader off/VoiceOver navigation/VoiceOver
exploration. Both VoiceOver modes require their own observations.

1. **Identify the run.** Record exact commit, tarball integrity, physical model/OS,
   RN/React versions, Release build, remote, reader version/settings, reduced
   motion, list window/clipping configuration, diagnostics mode and evidence path.
2. **Mounted input and feedback.** With readers off, compare native/Itar/pinned
   library on eight cards with the same 20 alternating Right/Left inputs and scheduled
   0/750/2000ms JS load. Observe actual native confirmation and visible styling;
   separate Android engine selection from UIKit host selection. With readers on,
   exercise Itar through reader-owned controls under the same stalls. On Apple TV add
   real clicks, swipes and momentum; check reduced motion/native-effect interaction.
3. **Semantics and activation.** Verify live identity and committed label/role/state
   before eligibility, disabled/inactive exclusion and one semantic activation of
   the intended occurrence. Reader navigation stays reader-owned; Itar must not
   force accessibility and input focus to coincide or synthesize duplicate speech.
4. **Routes and modals.** Open/close/nest the existing owned modal, return routes,
   and dispose the opener. Check restoration order and inactive-tree exclusion;
   unmanaged/unknown host focus must not trigger repeated competing requests.
5. **Loading and disappearance.** Exercise delayed/nested reveal, repeats/reversal,
   reorder, cancellation and late/duplicate outcomes. With a competing default,
   remove/hide/disable/clip/recycle the source, including loss of all registrations.
   Capture intermediate host focus/highlight/speech and the final outcome; label
   managed/unmanaged/confirmed-absent/unknown. Record prevention separately from
   later recovery. Reject speculative Itar focus or duplicate automatic speech.
6. **Close the evidence.** Mark each case pass/fail/unrun with reproduction and
   trace/video/speech observations; note interruption/coalescing rather than
   requiring one announcement per press. Keep failures/unavailable configurations
   as release gates and record bounded follow-up fixes. No unsupported path becomes
   a pass through simulator substitution or successful final recovery.

For ITAR-0080, use the separate [100-cycle native session protocol](device-acceptance.md#long-native-sessions):
warm-up/checkpoints/quiescence, owned record/view limits, ordinary clipping and
host caches. For ITAR-0083, both fresh native consumers must install/build/run
from the same tarball without workspace links or unpublished source paths.
