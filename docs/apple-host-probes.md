# Apple host probes (ITAR-0014–0020)

These disposable fixtures exercise Swift/UIKit through the existing C++20
`itar::probe` seam. They are not production navigation or a support promise.
The frozen architecture remains unchanged. Physical Apple TV, physical iOS,
Siri Remote gestures, VoiceOver navigation/exploration and audible speech remain
**not run**: no physical device/reader acceptance is available in this task.

## Reproduce

Use the pinned Node/npm and Ruby dependencies in [the shell guide](rn-probe-shell.md).
From a fresh checkout (generation refuses to overwrite existing native projects):

```sh
npm ci --ignore-scripts --no-audit
npm run build
npm run native:generate
bundle _2.6.9_ install
bundle _2.6.9_ exec ruby probes/apple/tests/wire-tests.rb
bundle _2.6.9_ exec pod install --project-directory=apps/probe/ios
xcodebuild -workspace apps/probe/ios/ItarProbe.xcworkspace \
  -scheme ItarAppleTests -configuration Debug -sdk appletvsimulator \
  -destination 'platform=tvOS Simulator,id=<your-owned-simulator>' \
  -derivedDataPath /tmp/itar-apple-derived -jobs 2 \
  CODE_SIGNING_ALLOWED=NO build-for-testing
xcodebuild -workspace apps/probe/ios/ItarProbe.xcworkspace \
  -scheme ItarAppleTests -configuration Debug \
  -destination 'platform=tvOS Simulator,id=<your-owned-simulator>' \
  -derivedDataPath /tmp/itar-apple-derived -jobs 2 \
  CODE_SIGNING_ALLOWED=NO test-without-building
```

The Ruby script adds only the optional hosted XCTest target and scheme, once.
Use `ItarProbe` for the ordinary RN app. Preserve useful generated projects and
Pods for manual testing; do not delete someone else's native edits to regenerate.
Select a task-owned Metro port for manual RN runs, passing the same port to
`-RCT_jsLocation localhost:<port>`. The native XCTest fixture replaces the host
controller temporarily; its results are UIKit tests, not remote-input or JS-load
acceptance. Run `npm audit --audit-level=high` manually; JS auditing stays outside
Actions. Existing Ruby auditing remains in CI.

## Binding, ownership and trace contracts

`ItarProbeHost.podspec` compiles the core seam and the facade as C++20, with Swift
language mode 5. The facade uses an opaque owned handle and copied scalars; no
borrowed strings, buffers, STL values or callbacks cross C. `create` returns null
on invalid identity/allocation failure. Dispose revokes; destroy frees exactly
once after active calls unwind. The nothrow allocation and noexcept seam prevent
C++ exceptions escaping. Null calls fail closed. C status values mirror the
probe enum (0 proposed, 1 boundary, 2 unmanaged, 3 absent, 4 unknown, 5 unavailable,
6 stale lifetime, 7 disposed, 8 invalid). A proposal never confirms host focus.

All Swift calls are main-thread confined. Each connection has a new lifetime;
recycling increments generation. `ProbeDispatcher` immediately rejects invalid
native identities, then applies copied observations/invalidation in a bounded
32-entry inbox after the host call returns. Nested invocation fails closed.
Disposal revokes immediately and releases C storage at unwind. Overflow closes
the dispatcher; it is not successful recovery. Root trace overflow at 256 events
marks the run inconclusive. Records use monotonic uptime and capture sequence.

`ProbeRegistration.mm` only registers a Swift view manager and forwards its
activation event. This uses RN TV's legacy-view/Fabric interop, not a completed
Codegen production component. No application-wide Swift/C++ interop flag is
introduced. CocoaPods is the tested packaging route; SPM is untested.

The host records callbacks before return independently of preferred targets.
A missing focus system is unknown; a queried nil focused item is absent;
registered A/B are managed and unrelated D/native items unmanaged. Accessibility
focus is queried independently. The fixture does not synthesize speech.

## Coverage and production starting decision

| Ticket | Implemented fixture | Remaining gate |
| --- | --- | --- |
| 0014 | C facade, Swift ownership, RN registration, portable facade regression tests | Consumer native results recorded below; physical link/run remains separate |
| 0015 | A/B/D, guide to B, read-only proposal logging, opt-in A/B boundary, preferences and actual callbacks | Remote clicks/swipes/repeat/momentum, nested scrolling/native controls, JS-load input |
| 0016 | Remove/hide/disable/clip/reuse/replace/all, intermediate callbacks, generation reset | Complete device variant matrix, video and speech |
| 0017 | Bounded guard, inline fake host, invalidation, redirect observation, callback disposal | Device timing and additional deferred callbacks |
| 0018 | Configurable native border, current base restoration, native button effects, independent semantic activation | VoiceOver navigation/exploration/speech, reduced motion and busy-JS visual capture |
| 0019 | Full-screen presentation, nesting, rejected presentation, disposed opener, guarded restoration | Interactive/failed asynchronous transitions and reader coverage |
| 0020 | Limited starting decision with explicit capability gates | Physical evidence before production acceptance |

**Limited:** continue exploring the C facade and UIKit cooperation. Reuse the
value boundary and guarded inbox concepts, not the probe's two-slot identities
or fixed geometry as production APIs. Preferences/guides express intent; exact
cross-platform destination parity and a universal removal veto are unproved.
UIKit retains input ownership; the probe intercepts no directional presses.
VoiceOver bypasses the optional scope veto and suppresses explicit restoration.
Native text/player controls and momentum remain unrun rather than implicitly
managed. Production work must preserve that distinction.

Prevention candidate: one synchronous pre-removal transfer to B, with **zero
retained views and no timer**. Removal proceeds only after `b.isFocused`; an
unconfirmed transfer leaves A intact. Baseline removal records intermediate
native targets. Final B alone never proves prevention. Highlight/video/speech
coverage is required before claiming no perceptible intermediate jump.

Style subset: border color/width only, applied from actual UIKit focus callbacks
through its animation coordinator, or immediately under reduced motion. Native
scale/parallax remain owned by UIButton; layout bounds are unchanged. Semantics
are set before insertion. Accessibility activation targets the live enabled
button without forcing input focus; the direct method test is not a VoiceOver
session. React receives only semantic activation, not per-move callbacks.

Modal candidate: an isolated scope in the existing UIWindow, with disabled
covered buttons and a hidden covered accessibility tree. Suspend before
presentation; reactivate in dismissal completion, query host restoration, then
revalidate generation, window, visibility and enabled state before a preference.
A disposed opener gets no restoration. Arbitrary RN Modal and interactive
presentation integration remain production work. No new logical surface choice
is promoted without the recorded runtime evidence.

## Validation record (2026-10-08)

Environment: Xcode 27.0 (27A266a), Apple Clang 21, Swift 6.4
(swiftlang-6.4.0.34.1), tvOS SDK/runtime 27.0 (24J360), Apple TV 4K third-generation
1080p arm64 simulator. RN TV 0.83.0-0, React 19.2, Hermes, Fabric interop.
Ruby 3.4.2 (deviation from 3.3.6 candidate), Bundler 2.6.9, CocoaPods 1.16.2,
xcodeproj 1.27.0. No external remote; accessibility reader off.

- Portable Release and ASan/UBSan: 4/4 tests each, warnings-as-errors enabled.
- RN build, typecheck, lint, workspace tests (2/2), Apple Metro bundle: passed.
- CocoaPods: 79 pods resolved, including the local probe pod; lockfile generated
  by CocoaPods 1.16.2 from the podspec and generated Podfile.
- Native build and simulator host execution: pending at this checkpoint.
- Physical Apple TV/iOS, VoiceOver, audible speech and remote gesture acceptance:
  not run. iOS runtime support is not established by a shared UIKit source file.

Per-ticket commits keep authored slices independently reviewable. The phase is
one PR by explicit request; each implementation slice stays under 250 lines
before evidence/fixes, and each remains below the 500-line ceiling. Podfile.lock
is generated separately; native projects, Pods and derived data are not tracked.
