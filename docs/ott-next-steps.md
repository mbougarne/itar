# OTT showcase checkpoint and next work

31 October: the owner resumed implementation. See the [redesign evidence and
joint focus checklist](ott-redesign-2026-10-31.md). The stop/draft instructions
below describe the superseded 28 October checkpoint, not the current request.

The current feature branch is a work-in-progress checkpoint for review. Stop new
implementation at this point; keep the PR draft and do not merge automatically.
Earlier targeted fixes and passing regressions do not mean all focus behavior
is correct.

## Open issues reported by the owner

- Returning from a content row can focus the wrong sidebar item. Reproduced
  spatial sidebar selection needs further investigation; the earlier nested-row
  boundary regression fix does not resolve every sidebar destination.
- From movie Details, sidebar focus can be inaccessible. Current navigation
  scope is inactive while Details is open; expected escape/route behavior must
  be corrected and tested rather than labelled fixed by catalogue Back testing.
- The design still needs improvement. Current implementation is a compact
  interpretation of the reference with explicit owner-requested overrides;
  complete visual acceptance remains open.

## Planned weekend work

1. Reproduce and fix remaining focus transitions, including row-to-sidebar and
   Details-to-sidebar behavior, with minimal app/adapter/core ownership tests.
2. Redesign Home and refine the overall presentation against the references.
3. Add more TMDB catalogue content and review the existing48-title viewing cap.
4. Plan and implement EPG as new work; it is not implemented in this checkpoint.
5. Follow with real-device validation. Android TV emulator evidence exists;
   physical Android TV/Apple TV, tvOS runtime and web testing are not verified.

See [design QA](../design-qa.md), [focus findings](ott-focus-findings.md),
[server-only TMDB setup](tmdb-proxy.md) and [demo playback](ott-playback.md).
No secrets, local environment files, native build outputs, runtime captures or
local agent history belong in the PR.
