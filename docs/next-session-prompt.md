# Next session — web after the Android PR merges

Work in `/Volumes/externalStorage/oss/itar`. The user has authorized committing,
pushing and opening a PR for the Android repair checkpoint. Leave merging to the
user. Begin web repairs only after that PR is merged; verify live Git/PR state.
Do not merge, enable auto-merge, deploy or release from this handoff.

Read AGENTS.md, docs/AGENTIC_RULES.md, current branch/status/recent commits and
relevant frozen architecture contracts before editing. Preserve unrelated work.
Tickets, `.agents/` continuity, validation reports and build artifacts can be local
and ignored; their absence in another checkout is not a reason to recreate them.

## Portable Android checkpoint

Android repairs prevent competing automatic focus from replacing a restored
card, keep the exact opener preferred until return settlement, preserve explicit
reader focus actions, and expose completed routes through Android pane titles.
The expanded sidebar also has full accessibility bounds and vertical containment.
The C++ navigation engine is unchanged. `FocusScope.accessibilityPaneTitle` is an
optional Android API; app routing/opener readiness remains application-owned.

Verified on Chromecast AVD Android 16/API 36 arm64, 1920×1080, RN TV 0.83.0-0,
TalkBack 14.2.0.740629310: nonfirst movie/series and player round-trips restore the
exact opener with reader on/off; reader-on input and accessibility focus align.
The original Home hero/More-discoveries/player-to-Search path reaches Search A
without ANR. Local checks: 24 focused JS tests, 1 reader-on and 3 reader-off native
tests, normal/test APKs, package build, native/web types, targeted lint/format.
Historical ANR causality remains unproved; do not claim it fixed or repeat healthy
loops indefinitely. Speech, physical Android TV/Fire OS and release acceptance
remain separate. Local detailed evidence, when present:
`docs/validation/android-talkback-return-fix-2026-11-14.md`.

## Agreed next work

1. After merge, implement web ITAR-0120–0125 in dependency order: inactive-route
   pointer/accessibility isolation; Search Clear/Delete focus recovery; notice
   overlap; editor Back mappings; visible pagination focus; coherent Retry entry.
   Reproduce through the actual DOM and verify layout/events/accessibility in a
   browser. Use the local phase_20_web_fixes tickets if available.
2. Then revisit the recorded enhancements: configurable cross-row first-card
   selection, independent horizontal visual anchoring, and composable focusable
   card content/prop integration. These are proposals, not implemented behavior.
   Row-entry policy belongs in C++; alignment and composition involve their
   React/native/DOM hosts. Keep Itar independent of Norigin's API.
3. On 15 November 2026, test tvOS together with the user, VoiceOver off and on.
4. After those checks, prepare a local trial in the agreed existing multi-app
   consumer before release. Keep consumer integration and publication separate;
   its precise local path and user-provided coverage are in local continuity.

Use focused reproduction → smallest fix → meaningful regression → targeted check.
Time-box inconclusive investigations, record the next discriminating check, and
continue independent ready work. Keep changes reviewable under the repository's
250-line target / 500-line ceiling. No automation or scheduled task is requested.
