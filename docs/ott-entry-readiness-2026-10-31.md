# Preventing intermediate focus during route return

This follow-up to [focus restoration](ott-focus-restoration-2026-10-31.md)
implements the existing scope entry-readiness contract in the native host adapters
and uses it for the demo's page/Details handoff. Core selection and history are
unchanged. ITAR-0062 remains In Progress; this is scoped simulator evidence.

## Cause and change

The Android trace reproduced Movies card → Details → card. Returning from Details
first produced host-only focus on a Details tab, a related card and All. There was
no corresponding engine request for All. The engine then requested the correct
saved occurrence about 1.3 seconds after All gained focus. Restoring the final
card therefore did not prove prevention of the intermediate highlight.

`entryReady` already constrained C++ entry selection, but native automatic entry
ignored it. The demo also activated the page before its collection-ready callback
requested the saved card. Now:

- Kotlin rejects unsolicited input-focus requests under an unready scope. A
  validated engine effect gets a synchronous, exception-safe request allowance.
- Swift gates UIKit eligibility and focus updates under an unready scope. Only
  the engine's issued preference, or already confirmed focus, bypasses that gate.
- Both checks stop at their owning surface and preserve screen-reader ownership.
  Logical registration and collection publication remain available to the engine.
- TypeScript closes page/Details entry in the existing first transition commit,
  before replacing content. It reopens entry when the intended request settles.

This requires an application to declare its handoff before controlled removal.
It is not a general guarantee for arbitrary removals, unmanaged controls or routes
that omit the readiness contract. No timers or per-direction JS redirects were
added to the fix.

## Verification

The new Android regression failed before the fix because an unready target
accepted host focus. The new tvOS test failed because the waiting target became
eligible and gained automatic focus after source removal. Both pass with the fix.
The fixtures also check explicit focus and preservation of existing focus.

The diagnostic Android build returned directly to the exact second-row Movies
card and third-row Series card. For Series, all host gain events across opening
and returning were exactly Details Play, then the saved grid occurrence; All was
absent. Back then restored the Series menu. Scroll-offset preservation was still
outstanding at this checkpoint; see the later [sidebar/viewport follow-up](ott-sidebar-viewport-2026-10-31.md).
Temporary host/effect logging was removed from final source.

Final checks: Android 16/API 36 passed five Kotlin/JNI instrumentation tests,
including forced host recovery after hiding the focused native source. tvOS 26.4
passed four Swift/UIKit tests; the final `xcodebuild test` exited successfully.
CTest passed 41 cases; JavaScript passed 48 tests. Workspace typecheck/lint and
TV formatting/lint passed. The final Android APK was rebuilt and installed.
The final build also passed Movies/card return, player-to-Details focus return,
sidebar Back, Search entry at A and Settings entry at White focus accent, then
account Back to Home. It was left on Explore title. Playback decoding itself was
not part of this check.

Ignored artifacts live in `build/ott-focus-retest-2026-10-31/`, using the
`entry-before-*` and `entry-fixed-*` prefixes. Native fixture evidence is not full
tvOS demo, physical-TV, screen-reader or production acceptance.
