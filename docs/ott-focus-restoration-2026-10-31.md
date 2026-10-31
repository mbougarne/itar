# TV focus restoration — 31 October 2026

This follow-up applies the app corrections from the navigation audit and tests
the existing engine/binding restoration path. The architecture and core selection
policy are unchanged. The larger-than-250-line slice includes the app handoff,
the reproduced cross-platform binding correction, regression tests and evidence;
it remains below 500 authored changed lines.

## Reproduced native binding defect

`restoreScope` failed when focus was outside a destination with no saved history,
even when that destination declared a valid preferred item. Android's C++ bridge
and the Apple C interface incorrectly used the destination as input authority.
The core therefore rejected the outside source before selecting the preference.

Both bindings now use surface authority; destination membership, eligibility and
source focus traps remain checked by the existing core logic. Regression cases
in `android.scopes` and `apple.engine_boundary` failed before the change and pass
after it. Kotlin and Swift host fixtures also exercise this previously missing
first-entry case, in addition to restoration of existing history.

## App corrections

- Home enters Explore title, Movies/Series enter All, Search enters A, and
  Settings enters White focus accent, after the corresponding content is ready.
- Main-stack Back restores sidebar history; another Back presents Exit/Cancel.
  Account-stack Back goes to Home. Account navigation has a separate scope.
- Details continues into its parent scope, allowing Left to reach the sidebar.
- A content transition first commits an inactive sidebar, then changes content.
  It re-enables the sidebar after the requested focus completes. A single-commit
  guard was insufficient: Android briefly focused Home during view removal and
  legitimately overwrote the engine's sidebar history. No duplicate JS history
  service or per-direction JS redirect was added.
- Replay tracks end-of-stream and resets before resuming; it tolerates the final
  decoder timestamp being slightly earlier than the nominal duration. The stream
  and content are unchanged.

## Verification

- CMake rebuild and CTest: 41/41 passed, including both new binding regressions.
- Android 16/API 36, existing 1920×1080 emulator: five Kotlin/JNI tests passed
  (scope/history, dialogs, two boundary cases and mount-command ordering).
- tvOS 26.4 simulator: three Swift/UIKit tests passed (new scope preference,
  existing scope history, and owned presentation restoration).
- Workspace lint, TV formatting/lint, TypeScript and 48 JavaScript tests passed.
- The Android dialog fixture now waits for actual window focus before nesting;
  an idle UI queue alone did not establish that prerequisite. Logs confirmed the
  wait was exercised. An intermediate new fixture also needed its required
  accessibility label before the target could register.
- Remote navigation passed Series → Details → same Series card → Series menu
  → exit prompt → Back-to-cancel → Series. Search and Settings entry, account
  return to Home, Movies entry, Details-to-sidebar access and a third-row card
  return also passed. Card identity was restored; the old scroll offset was not.
- First-press replay from the Play control advanced to 0:05; timeline Select at
  the end advanced to 0:06 while retaining timeline focus. Player Back restored
  Details Play, then the Home hero opener.
- The explicit Cancel button restored the last menu item, the prompt reopened,
  Exit returned to the Android launcher, and relaunch/sign-in returned to Home.
  The final app is left on Explore title; existing emulator and servers remain.
- Saved snapshots/screenshots: ignored `build/ott-focus-retest-2026-10-31/`.
  Use the `accepted-*` records for the successful navigation pass; earlier
  records include intermediate failures and discarded startup/reload attempts.
  The successful replay checks use `final-player-replay` and `final-timeline-replay`.

## Remaining boundaries

Directional Left still uses geometric sidebar entry, and Down from the full-width
timeline selects Close. Automatic history-based directional entry is a separate
policy/API task; these behaviors are not fixed by explicit Back restoration.
Sending a direction immediately after Back, before the native exit dialog gains
focus, can still move the underlying menu. Settled-dialog restoration and input
during presentation are distinct; presentation input gating remains follow-up work.
Physical TVs and screen readers were not tested. Swift fixture results do not
establish full tvOS application navigation acceptance. No release acceptance,
commit or push is implied by these results.
