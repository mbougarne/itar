# Android host probes (ITAR-0007–0013)

This disposable Kotlin/JNI module is loaded by the generated RN TV 0.83.0-0
consumer through a native ViewManager's Fabric interop path. It is not a production
adapter or a claim of Android TV/Fire OS support. The C++ two-target seam remains
independently buildable. Sources are in `probes/android`; `native:generate` wires
them into the generated app without copying handwritten files into ignored trees.

## Build and run

From the root, install the locked workspace, then run:

```sh
npm ci --ignore-scripts
npm run build
npm run native:generate
# Set JAVA_HOME (JDK 17), ANDROID_HOME and a task-owned GRADLE_USER_HOME first.
cd apps/probe/android
./gradlew assembleDebug assembleAndroidTest lintDebug --no-daemon --max-workers=2 \
  -PreactNativeArchitectures=arm64-v8a
```

The template selects Gradle 9.0.0, AGP 8.12.0 and Kotlin 2.1.20. The probe pins
SDK/build tools 36/36.0.0, NDK 27.1.12297006 and CMake 3.22.1. Generated projects
remain disposable. The Android CI job compiles the app, JNI, instrumentation APK
and lint; it does **not** run device tests. Required checks includes that job.

For an isolated manual run (replace the serial/ports with your owned resources):

```sh
npm run start -w itar-probe -- --port 8097 --max-workers 2
adb -P 5057 -s emulator-5586 reverse tcp:8081 tcp:8097
adb -P 5057 -s emulator-5586 install -r apps/probe/android/app/build/outputs/apk/debug/app-debug.apk
adb -P 5057 -s emulator-5586 install -r apps/probe/android/app/build/outputs/apk/androidTest/debug/app-debug-androidTest.apk
adb -P 5057 -s emulator-5586 shell am instrument -w com.itarprobe.test/android.test.InstrumentationTestRunner
adb -P 5057 -s emulator-5586 shell am start -n com.itarprobe/.MainActivity
adb -P 5057 -s emulator-5586 logcat -s ItarProbe:I
```

Reset/remount the screen between destructive cases. Focus A before manual input.
Controls at the right select disappearance and callback variants; the removal
controls first refocus A. The fake callback hazards redirect to D, disable B or
revoke the surface inside B's native callback. These deliberately injected host
behaviors are distinct from dispatcher-generated effects. A two-second JS busy
button is available; native activation and the later JS callback are separate.

## Boundaries and observations

- JNI stores no host or JNI references. Eight UI-thread-owned optional surfaces
  use monotonically increasing positive tokens, never pointers. Exhaustion fails
  creation; stale/closed tokens return -1; other negative results encode
  `-2 - probe::Status`. Queries accept managed slots 1/2, host-confirmed absence 0,
  unmanaged -1 and unknown -2. Native calls are allocation-free and `noexcept`.
- A/B belong to one disposable lifetime, generation 1. Recycling immediately
  revokes eligibility and leaves generation 2 unmanaged. Reattachment requires a
  new root/lifetime; this is not the production registry or registration API.
- `focusSearch` only queries; diagnostics do not pump the dispatcher or request
  focus. Scoped Up/Down dispatch consumes matching releases and queries C++ once
  per down event. Other controls and accessibility-enabled sessions use the host
  path. This conservative reader gate does not prove reader ownership correctness.
- The guard queues at most 32 copied scalar observation/invalidation records.
  Callback disposal revokes authority immediately; native destruction waits for
  the host invocation's `finally`. No closure retains a host view in the inbox.
  Actual post-call focus and current eligibility determine confirmation.
- `ItarProbe` records native sequence and monotonic nanoseconds, call entry/return,
  callback targets, query/input ownership, style, accessibility events, native
  activation and windows. Correlation is local call ordering, not production
  request/effect IDs. The 512-event cap marks overflow inconclusive and stops
  probe movement; it never silently treats a truncated trace as a pass.
- Input observations distinguish managed A/B, unmanaged host controls, confirmed
  null focus and unknown while the root lacks window focus. Accessibility events
  and speech are separate; the module never generates announcements.
- Color-only feedback changes text from its current base color to yellow and
  restores it on blur, disposal or recycle. Native backgrounds remain intact;
  there is no animation or geometry change. No scale/parallax subset is claimed.
- Removal variants include hide, disable, clip, detach, recycle, same-call
  replacement and no managed targets. The pre-removal transfer retains zero views
  for zero time. It cannot establish prevention under delayed content or list
  recycling; those cases still require device evidence.
- Dialogs log distinct window tokens, dismissal and a weak opener's availability.
  Nesting is bounded to two dialogs; disposal dismisses owned dialogs. Restoration
  is observed without forcing focus. Deliberately withheld presentation is a
  control case, not evidence of a real platform presentation failure.

## Evidence and decision

See the adjacent run record once validation completes. Keep the shared native
probe report fields for each new run, including revision, environment, reader,
touch mode, captures and separate prevention/recovery verdicts. Android emulation
cannot stand in for Fire OS, TalkBack or VoiceView. Native logs cannot establish
visible feedback or speech without corresponding capture.

ITAR-0013 decision: **unresolved** pending the complete host/reader matrix. Do not
promote these hooks to production solely from compilation or deterministic tests.
The next gate is physical Android TV/TalkBack and separate Fire OS/VoiceView runs,
including nested native controls, busy JS, delayed destinations, disappearance,
modal background eligibility and restoration. Native styles/accessibility remain
mandatory. ITAR-0006 must retain this evidence gap; the frozen architecture is
unchanged. RN interop promotion/codegen belongs to the production adapter work.

Review scope: one grouped PR was explicitly requested. Keep the binding/build
slice (0007), mounted scene (0008), disappearance (0009), guarded callbacks (0010),
feedback/activation (0011), dialogs (0012), and evidence decision (0013) separately
reviewable. Each slice includes its relevant tests and remains below 500 authored
changed lines; generated native projects, build output and dependency trees are
not committed. No new package dependency or lockfile change is required.

References: [Android JNI guidance](https://developer.android.com/ndk/guides/jni-tips),
[public focusSearch API](https://developer.android.com/reference/android/view/ViewGroup#focusSearch(android.view.View,%20int)).
