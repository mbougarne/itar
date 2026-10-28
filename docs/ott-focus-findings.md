# OTT focus findings — 28 October 2026

The owner authorized focus investigation on the already-open Android TV emulator.
Work stayed on `no-ticket/redisign-simple-app`; existing changes, credentials,
Metro and the local proxy were preserved. No commit, push or PR was created.

## Confirmed ownership

| Cause | Responsible layer | Fix |
| --- | --- | --- |
| Buttons shared order0, yielding alphabetical sidebar movement | OTT React Native app | Explicit displayed order |
| Generic minimum width doubled Search key width | OTT React Native app | Keyboard-specific minimum width |
| Offscreen actions in ordinary ScrollViews were ineligible | OTT composition | Existing virtualized collection/reveal path |
| Catalogue and Details competed for one collection owner | React adapter integration | Explicit ownership handoff |
| Biography-only changes republished the logical graph | React adapter | Reuse an accepted dataset when nodes are identical |
| Theme casing/insets/tint/background overrode supplied appearance | Android adapter | Narrow owned-button initialization fix |
| Every old-dataset view was detached on append | Android collection adapter | Exact live focused-binding retention across unchanged declarations |
| Center-only spatial eligibility admitted rows above/below as horizontal destinations | C++ engine geometry policy | Versioned directional-edge eligibility, `itar-linear-v2` |

## Pagination: prevention replaces recovery

The core collection mutation already preserves stable node handles and mounted
records for unchanged occurrences. The interruption came from Android's explicit
post-publication detach of every view with an older declaration, before React
received acceptance and committed new props. This could focus unrelated chrome.
The earlier opt-in JavaScript recovery command restored the title only afterwards;
that workaround has been removed.

The native adapter may retain one exact focused TargetView plus at most two
collection ancestor ScopeViews. Retention requires unchanged node declarations
through the entire ancestry, preserved slot/generation, the original view/mount,
surface ownership, lifetime and attachment. References are weak and bounded.
Current logical metadata remains authoritative; geometry refresh uses the accepted
revision only after validating the retained binding. A fresh/recycled view gets
no grant merely by repeating its occurrence key or old dataset string.

Mixed parent/target React commits are allowed only for validated collection
members. Undeclared children retain the prior membership rejection. Reorder,
changed ancestry, deletion, detach, reuse or disposal invalidate retention. This
preserves observed native focus without an extra focus request or a second JS
selection engine; it does not promise to preserve a logically deleted target.

## Boundary reproduction and policy version

A row spanning x100–340 and a narrower row above spanning x100–200 have different
centers. Under v1, Left from the first row's first item promoted to its region,
then selected the narrower row because its center was leftward—even though both
regions started at x100. A similar wider editing row below captured Right from
a Search letter row. Both minimal C++ reproductions failed before the fix.

Version2 requires both directional edges to advance strictly in the requested
physical direction. Existing ranking, logical row/column order, RTL and explicit
wrap behavior remain. A changed center inside an overlapping region is not enough.
The version is explicit because navigation winners change; this is not an
Android/UIKit parity or performance claim. The frozen architecture is unchanged.

## Evidence

All38 host C++/boundary tests pass, including the two new nested-region cases.
TypeScript, full ESLint and36 serial JavaScript tests pass. The Android build is
offline, one worker,768MiB heap and384MiB metaspace; the owner emulator is preserved.

Native `PublicationTest` observes real global host focus across accepted append
before React commits, through mixed props, and rejects stale replacement views,
recycled mounts, undeclared children and invalidating structural changes.
Both selected instrumentation tests pass on the final APK (2.928s); the first
observes zero global host-focus losses and the second covers invalidation cases.
See `design-qa.md`.

Manual live app captures in the task workspace `runtime-evidence/`:

- `final-retention-append`:20→40 real TMDB titles; same end-row title focused with the
  recovery command removed.
- `final-boundary-left`:one Left from the first fetched-row item enters sidebar.
- `final-boundary-n` then `final-boundary-result`:one Right from N enters M*A*S*H,
  without the former Space/editing-row detour.

These establish the reproduced cases on Android16 TV/arm64. They do not establish
all reorder/deletion UX policies, rapid-repeat combinations, physical devices,
TalkBack/VoiceOver, tvOS, release behavior or measured performance. The manually
started local proxy remains confined to the current approved review session.
