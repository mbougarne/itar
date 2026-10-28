# Itar Cinema design correction QA — 28 October 2026

Result: **blocked for complete cross-platform / all-state visual acceptance**.
The requested implementation is present and the targeted Android checks below
pass. This is not a pixel-perfect or exhaustive focus acceptance claim.

## Owner-reported issues at the publication checkpoint

Returning from a row can select the wrong sidebar item; movie Details can make
sidebar focus inaccessible; the design still needs improvement. These remain
open. See [weekend follow-up scope](docs/ott-next-steps.md). Prior passing narrow
regressions below do not establish that these broader issues are fixed.

## Reference and owner overrides

All 11 PNG references were inspected. Side-by-side normalized comparisons were
reviewed for Home, Movies, Series, Search, Profiles, Settings and Cast/Details. Reference size
1672×941 and emulator size1920×1080 are normalized only in QA images. The original
design pack is unchanged. Current instruction overrides: compact density;
full-screen Profiles without sidebar and with inactive Add button; three
landscape Search results; cards with image/title only; Play instead of Back to
catalogue; inline real recommendations and Cast. Live TMDB artwork/titles differ
from fictional reference content intentionally. No new C++ changes were made
for this design correction; earlier engine fixes remain separate below.

## Corrections and evidence

| Priority | Finding and correction | Evidence |
| --- | --- | --- |
| P1 | No real player → pinned native HLS player, explicit same-demo-film disclosure | `design-player-progress`, `design-player-paused`, `design-player-paused-still` |
| P1 | Profile chooser shared sidebar → dedicated full-screen chooser; bottom profile entry opens it | `resumed-state`, `qa-explorer-entry`, `qa-stargazer-chooser` |
| P1 | Search oversized keyboard/posters → smaller remote keyboard, three complete16:9 results | `qa-search-nav`, `qa-search-first-result` |
| P1 | Image focus unclear → native focus foreground, inset excludes title, native reset tests | `qa-search-first-result`, `design-cast-focus`; StyleChecks instrumentation |
| P2 | Oversized spacing/clipped backdrop → compact shared sizing, backdrop outside clipped rail cells | `resumed-home`, `qa-settings` |
| P2 | Card metadata noise → image and title only; full semantics retained separately | `qa-movies-final`, `qa-search-nav` |
| P2 | Details return button / excessive cast-heading gap → Play, tight heading, related titles | `design-cast-focus`; 37 serial JS tests |

Evidence lives in the task workspace `runtime-evidence/` and normalized
comparisons in `design-correction/`. PNGs captured before UIAutomator idle may
be transitional; final resumed captures take PNG after hierarchy capture.
`qa-series-final` and the first `qa-add-profile-noop` labels are exploratory
navigation, not acceptance evidence (observed focus revealed a different route).

## Actual Android observations

- Branded JS splash visible in launch frames2–4; initial platform frame is gray.
- Live catalogue, Explore→Details, real cast/recommendations and public HLS
  decoded frames were observed before disconnection. Pause changed to Resume;
  timestamp83seconds remained stable across captures. Back restored Details Play.
- After reconnect: app was on Explorer chooser. No blind repeat of interrupted
  remote input, no restart. Selected Explorer→live Home.
- Search H showed three complete landscape tiles; seven Right presses from H
  reached N then M*A*S*H. Native image outline visible, no card descriptions.
- Settings all five controls and source/footer fit1920×1080. Bottom Explorer
  entry opened chooser. Stargazer selection returned Home; reopening showed
  Stargazer current. Add a New Profile selected and remained focused with no
  account flow (`qa-add-final`). Explorer was restored afterward.
- Movies and Series final captures show landscape and poster rails with native image focus (`qa-movies-final`, `qa-series-nav-corrected`).
- Backend health remained200 live/TMDB on8787. Existing emulator, Metro, server
  and other sessions preserved; no credential read/print/configuration changes.

## Checks and remaining acceptance

TypeScript and full ESLint pass. 37/37 serial JavaScript tests pass with mock
responses/credentials. Initial restricted rerun denied five loopback listeners
(EPERM); rerun with localhost permission passed, without changing test code.
Final Android debug/test build previously passed offline in39seconds with one
worker,768MiB heap,384MiB metaspace. Three selected native instrumentation tests
passed in4.858seconds, covering callback/style reset and publication retention.
Swift host syntax parse passed; no Apple build or runtime verification.

Remaining: all eleven final visual states have not been recaptured in both
fixture and live modes. Loading/error/empty final appearance, full biography
workflow, related-title activation, player Restart/Retry/Close-button transitions,
real network outage recovery, white mode, TalkBack/VoiceOver, physical devices,
release builds, tvOS and measured performance are unverified. Existing boundary
navigation can select a sidebar entry by spatial geometry when exiting a rail;
this design pass makes no exhaustive boundary/focus claim. No unrelated engine
work was undertaken. Public-distribution TMDB approved-logo requirement remains.

## Earlier live-data/focus investigation (historical)

The following report predates this design correction; old UI wording and test
counts describe that earlier snapshot, not final acceptance.

# Itar Cinema design and runtime QA — 28 October 2026

Owner branch `no-ticket/redisign-simple-app`; baseline `dffaf17`. The11 supplied
reference PNGs were visually inspected and preserved. Existing work, native
projects, original probes and secret files were retained. No commit/push/PR.

## Implemented and observed

Fixed cinematic sidebar/route marker, shared viewport scale, mixed poster and
landscape rails, Search keyboard/results, local profiles, Settings, title details
and real Cast. Live TMDB content uses a manually approved server-only proxy;
explicit offline fixtures and no-key HTTP mocks remain available. Real titles
never receive fictional fallback metadata or playback claims.

Android TV emulator `emulator-5554`, `sdk_google_atv64_arm64`, Android16,
1920×1080; React Native TV0.83.0-0. Only Itar was reinstalled/restarted. The emulator,
Metro on8096 and other projects were preserved. The live backend binds127.0.0.1
on8787; only this port reverse was added. No automatic credential configuration.

| Scenario | Observed evidence |
| --- | --- |
| Live catalogue/artwork | Source says TMDB; real hero/posters,20 titles |
| Hero Right then Down | Explore story → Wildwood; poster row revealed |
| Title entry | Back to catalogue receives native input focus |
| Cast reveal | Down → first real performer; six Right presses reveal Jake Johnson |
| Biography | Select retains Jake Johnson; Down reveals fetched biography |
| Catalogue return | Hardware Back restores Wildwood occurrence |
| End fetch | Last-row fourth title triggers20→40 loaded titles |
| Append retention | Native exact-binding retention keeps the source focused;20→40 titles, JS recovery removed |
| Sidebar order | Two Down presses Home → Movies → Series after explicit order fix |
| Settings reveal | Down reaches final development probe control; it was not activated |
| Search | Remote H query returns19 real matching titles; measured results column stays inside screen |
| Search return | M*A*S*H details opens; Back retains H and restores same result |
| Android labels | Supplied case retained; theme gray/white background removed; ellipsis preserves full accessible label |

Screenshots and UIAutomator focused-node captures are in the task workspace
`runtime-evidence/`. Useful final pairs: `final-native-home`,
`recovery-appended-state`, `appended-next-row`, `nav-final-series`,
`settings-bottom`, `search-results-edge`, `search-details-return`.
Follow-up final pairs: `final-retention-append`, `final-boundary-left`,
`final-boundary-n`, `final-boundary-result`. Earlier images deliberately retain
failing states and are not final acceptance.

## Diagnoses and fixes

- App ScrollViews left offscreen actions ineligible: catalogue/Details/Settings
  now use the existing Itar virtualized reveal integration.
- One collection per provider: explicit active ownership handoff prevents competing
  catalogue/Details trees; request state remains local to the retained page.
- Visual-only changes republished logical nodes: equivalent node signatures now
  retain their accepted dataset, fixing cast-selection focus resets.
- App actions all had order0: explicit navigation/key order fixes alphabetical
  skipping. Keyboard keys also override the generic action minimum width.
- Android AppCompat casing, padding, tint and background overrode app presentation:
  narrow TargetView initialization fix verified by installed APK screenshots.
- Backdrop/scrim intrinsic dimensions spilled into content: explicit percentage
  width/height now constrain images to their hero frame.

## Remaining gaps

Pagination interruption and the two reproduced boundary cases are now fixed;
see [layer ownership, native retention contract and versioned C++ policy](docs/ott-focus-findings.md).
The native adapter preserves only exact unchanged focused bindings. Minimal core
reproductions failed under v1 and pass under `itar-linear-v2`; one Left exits a
fetched-row edge to chrome and one Right from N enters live Search results.

Both selected Android `PublicationTest` instrumentation tests PASS on the final
APK (2.928s). They observe zero global host-focus losses across append, validate
mixed React commits, and reject stale/recycled/replacement views, foreign children,
reorder, ancestor changes and deletion. Rapid concurrent
input, arbitrary deletion/reorder UX and full reader acceptance remain unverified.

Whole-photo exterior focus rings, arbitrary native button typography and full
biography scrolling are not claimed. Biography text is a bounded10-line preview.
Android text focus accents are supported; Apple TV behavior, physical devices,
TalkBack/VoiceOver, release builds, measured performance, exhaustive rapid input,
white mode, failures and missing-art visual states still require verification.

TMDB's required notice is visible in Settings. Its approved-logo page could not
be retrieved (robots restriction); approved logo integration/asset terms remain
a public-distribution requirement. No replacement logo was invented.

## Checks

TypeScript, full ESLint,36 serial JS tests and38 host C++/boundary tests pass. Tests use fake credentials;
live responses are separate emulator evidence. Final Android incremental debug
build passed offline with one worker,768MiB heap,384MiB metaspace, in-process
Kotlin and Metro port8096. Existing host-probe ABI tasks also ran from their
configuration. No Apple build/simulator was used. No performance claim is made.

Review source in separate slices: server/client data boundary and tests;
collection/Android host fixes; app screens/theme/assets; documentation/evidence.
The request spans a showcase redesign plus live data and runtime fixes, exceeding
a small single-ticket diff; no ticket completion or architecture change is implied.
