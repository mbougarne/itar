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

## Queries and input (ITAR-0047)

`focusSearch` reads committed core state and validates the returned mount mapping;
it never drains the dispatcher, measures geometry or starts a request. The owned
D-pad path consumes matching releases and forwards directions/repeats to the
existing core coalescing policy. Other controls and accessibility-enabled input
fall through. There is no Kotlin movement queue. Deferred collection reveal is
outside this mounted-only increment. The new `android.input` fixture checks pure
queries and 1,000 joined repeats; its local run was stopped after configuration
when the user paused heavy testing. Final native acceptance is operator-run via
[the manual checklist](android-adapter-manual-testing.md).

## Guarded dispatch (ITAR-0048)

The copied-value inbox is bounded at 32; a turn does at most 64 units before
posting continuation. Native mapping revocation is immediate; JNI destruction
waits until a synchronous host call unwinds. Inline observations are checked
against current host focus before entering core, so an intermediate redirect
cannot confirm a superseded destination. Every outcome carries lifetime/request/
effect/kind; disposal and old-operation cancellation cannot authorize a replacement.
One uptime deadline callback is rescheduled from core state, with no idle polling.
Inbox/core saturation closes the surface and requires a fresh native root; no
uncertain lifecycle fact is silently accepted. This mounted-only adapter rejects
reveal effects and reports completed synchronous focus operations accurately.
The new effect protocol fixture and native callback acceptance are **unrun** after
the user's memory-pressure pause; use the manual checklist. Earlier boundary and
registration results do not validate these subsequent changes.

## Native text color (ITAR-0049)

The supported subset is `baseColor` plus optional `focusColor` on owned buttons.
The native input-focus callback applies it directly; a changed base property is
retained while focused and restored on blur, detach, disposal or reset. Clearing
the configured base restores the original native ColorStateList. Native button
backgrounds, navigation rectangles and accessibility highlights stay native.
There is no animation/scale/shadow path, hence no motion scheduled to compete
with reduced-motion settings or platform effects. Debug style assertions are
included in CallbackTest's style scenario. Their execution and visible feedback
under busy JavaScript remain operator-run and **unrun** for this head.

## Owned dialogs (ITAR-0050)

Each owned Dialog hosts its own core surface; nesting is bounded to two windows.
Presentation captures core recovery context and a value-only lifetime/key token,
cancels pending opener authority and hides covered descendants from input and the
accessibility tree. Failed presentation releases its new surface and uncovers the
opener. Dismissal waits for the real opener window, adopts any native restoration,
and requests a valid key or the existing core deletion-recovery policy only when
native focus is confirmed absent. Disposed or replaced opener lifetimes reject
restoration. This coordinator supplies explicit owned native dialogs, not an RN
Modal/router integration claim. Dialog fixtures are authored but **unrun**; reader
hiding, failed native presentation, nesting and restoration remain operator gates.

## Accessibility ownership and activation (ITAR-0051)

Native accessibility state/change listeners cancel pending authority without
waiting for JS. The conservative ownership gate falls through whenever a native
accessibility service is enabled; no claim is made that every enabled service is
a screen reader. Input and accessibility focus use separate core channels. A
missing semantic registration remains unknown rather than proving absence.
The semantics subset is native Button role, committed label, enabled state and
click. Owned Select down/up carries a value-only mount/lifetime lease, rejecting
recycling between events. Accessibility click validates its semantic element
without first moving input focus. The native click path emits one identity record;
framework click notifications do not emit a duplicate. No announcement is posted.
Activation fixture execution, TalkBack and VoiceView acceptance are **unrun**.
