# Next-session prompt — web repairs

Work in `/Volumes/externalStorage/oss/itar`. Park the remaining Android QA for a
separate fresh pass and begin the web repair batch. Do not restart the Android
investigation or describe Android as complete. This explicitly changes the earlier
Android-first execution order for this session; it does not close its open tickets.

First read [AGENTS.md](../AGENTS.md), [agent rules](AGENTIC_RULES.md), current Git
status/branch/recent commits, [backlog](../tickets/backlog.md), and
[phase 20](../tickets/phase_20_web_fixes.md). Read relevant contracts in the
[frozen architecture](../tickets/docs/architecture.md) before changing behavior.
If present, read the latest local continuity record and the
[QA handoff](validation/qa-handoff-2026-11-09.md) /
[Android checkpoint](validation/android-follow-up-2026-11-14.md).
Preserve unrelated and staged work. The current checkout outranks old handoff
statements about branches, uncommitted files or installed apps.

Local tickets, validation reports, build evidence and `.agents/` may be ignored
and absent from another checkout. Use the portable context below if they are
missing; do not spend the session reconstructing historical notes or rerunning
passing Android suites. Check only the context needed for the active web issue.

Start **ITAR-0120 (WEB-01 + WEB-03)**: inactive routes must stop intercepting
pointers and appearing in DOM accessibility/navigation. Reproduce Search/Settings
click interception and hidden catalogue exposure while details or guide is open.
Verify actual DOM hit targets, Tab/focus and accessibility exposure through entry
and Back, preserving mounted catalogue viewport and opener identity. Initial
source leads are [route rendering](../apps/probe/ott/App.tsx),
[opacity-only hidden styles](../apps/probe/ott/src/theme.tsx), and
[web scope rendering](../apps/probe/web/focus.tsx). Treat these as leads, not proof
that an old reproduction still applies to the current build.

Then address the remaining web slices, following dependencies and keeping each
change independently reviewable:

- **0121 / WEB-02:** Clear or final-character Delete disables the focused Search
  control, leaving BODY focused and arrows stranded. Recover an eligible target
  after commit without moving unrelated focus. Depends on 0120.
- **0122 / WEB-04:** The navigation notice overlaps focused first-row content.
  Correct layout while preserving access to its arrow-navigation checkbox.
- **0123 / WEB-05:** Email/Password inputs swallow Back. Verify Escape and TV Back
  mappings 10009/461 through actual DOM propagation, preserving values, typing
  and one Back action. Native editor behavior must remain unchanged.
- **0124 / WEB-06:** Movies → Load more moves the focused pagination control
  offscreen after layout. Preserve occurrence identity and visible focus; do not
  invent a new row-entry policy. Depends on 0120.
- **0125 / WEB-07:** Failed initial catalogue fetch → Retry returns focus to the
  bottom action. Provide coherent first-result recovery and accessible error
  order/status, retaining usable repeated-failure behavior. Depends on 0120.

Use one focused reproduction → smallest fix → meaningful regression → targeted
browser/check pass per issue. Actual DOM layout, events and accessibility exposure
need browser evidence; hook doubles or compilation alone are insufficient. Record
browser/version, viewport and build identity. Do not repeat successful checks
unless a subsequent change affects them. Avoid broad repository rediscovery,
unrelated refactors, speculative features and full native rebuild/test loops.
Target 250 authored changed lines per ticket; explain cohesive slices up to 500
and split before exceeding 500. Update ticket and index together when available.

Time-box an inconclusive investigation to **20 minutes per issue**. Then record
what was reproduced, what remains unknown and the next discriminating check;
report the blocker instead of extending the testing loop. Continue only an
independent ready web slice. This is a scoped coding session, not authorization
for an automation, scheduled task or long-running autonomous goal.

Portable Android checkpoint: **0116 and 0119 remain In Progress**. The collection
candidate passed six new reader-off checks, the existing 15-test reader-off suite,
and 11 selected reader-on checks. A controlled diagnostic Cinema build passed
one Down into More discoveries and Up into the poster rail with both input and
accessibility focus confirmed. Temporary logging was removed and the normal
Cinema APK rebuilt/installed; those diagnostic app observations do not replace
remaining normal-app horizontal-end, logical-traversal and reader-off acceptance.
The original ANR replay, NAV boundary questions and an untraced Worth→More input
redirect remain open. Earlier Fabric test-process failures are not attributed to
the ANR or claimed fixed by later passes. Speech and physical-device acceptance
remain separate. Do not reopen these investigations during this web batch.

No tvOS work, physical-TV passes, public-repository preparation or proposed focus
improvements in this session. Web 0120–0125 were Backlog/unstarted at this handoff;
verify current status before acting. Do not commit, push, merge or create/update
a PR unless I explicitly authorize it in the new conversation. Earlier commit/PR
permission applied to the prior checkpoint only. Finish with changed behavior,
checks actually run, remaining limitations and the next ticket; never claim full
platform acceptance from a bounded repair.
