# Sidebar history and retained catalogue viewport

This follows [entry readiness](ott-entry-readiness-2026-10-31.md). It adds an
opt-in scope policy and preserves the existing virtualized viewport during the
demo's catalogue/Details handoff. Earlier uncommitted readiness fixes are retained.

## Causes and changes

- Directional entry previously used perpendicular geometry even for the sidebar.
  The engine had valid history, but the adjacent-entry policy did not consult it.
  `restoreOnEntry` now selects eligible engine history, then preference and a
  deterministic fallback. The default remains geometric for ordinary rails.
  The demo opts its navigation scope in. Kotlin/JNI carries the flag to C++.
  Swift rejects a geometric sidebar entry before it gains focus and queues one
  C++ restoration outside the UIKit callback. New focus, changed scope/source,
  disposal or the original deadline invalidates that queued handoff.
- `FocusVirtualizedRails` previously returned a placeholder when inactive,
  unmounting FlatList and losing its scroll position. Native reveal then aligned
  the saved row with the viewport start. The component now keeps its existing
  virtualized window mounted while releasing logical catalogue ownership.
  Inactive/old-dataset targets remain ineligible; reactivation republishes before
  `onReady`. Component disposal still releases the viewport. This does not expand
  the render window or retain the whole catalogue.

## Evidence and boundaries

Before the change, an Android third-row card moved from `[152,705][478,889]` to
`[152,274][478,458]` on return, and Left entered Search from the Series screen.
After the change, a third-row card returned to exactly `[152,705][478,889]`, and
Left restored Series. Focusing Home without opening it, then entering the current
Series content and pressing Left, restored Home. This distinguishes remembered
focus from merely selecting the active route's menu item.

In a genuinely scrolled viewport, Friends stayed at `[152,706][478,890]` after
Details return and a second open/Back cycle. Left from Friends' Details restored
the remembered Home menu item. The final app was left on Friends in Series.

The new core assertion failed before the policy implementation; all 41 CTest
cases pass afterward, including unchanged default anchor behavior and fallback
from disabled history. Android 16/API 36 passes five native tests, including a
read-only directional query followed by an actual history-based key move. tvOS
26.4 passes three hosted Swift/UIKit cases, including restoration and cancellation
of a stale queued entry. JavaScript's 48 tests, package build, typecheck, lint and
TV formatting checks pass. Both native consumers were rebuilt.

Ignored snapshots use `sidebar-*` and `viewport-*` under
`build/ott-focus-retest-2026-10-31/`. Full tvOS demo viewport behavior, physical TVs
and screen-reader acceptance remain unverified. Unmounting a route does not
persist its viewport. No commit, push or release acceptance is implied.
