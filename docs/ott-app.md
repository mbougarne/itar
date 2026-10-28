# Itar Cinema TV showcase

The existing `apps/probe/App.tsx` opens the OTT source in `apps/probe/ott/`.
This is one React Native TV app registered as `ItarProbe`, using the workspace
Itar package and pinned `react-native-tvos`. Android and Apple native projects,
original `ProbeApp.tsx`, dependency versions and owner design references remain.
Development Settings can open the original probes. The separate old `itar-ott`
folder is untouched. No commit, push or PR was created.

## Content

Home, Movies, Series, Search, Profile, Settings, title Details and Cast are
implemented. The default source is the local HTTP proxy. It returns actual TMDB
metadata/artwork in explicitly approved live mode, or labelled mock responses
without credentials. Settings can explicitly select offline fictional fixtures.
There is no silent substitution of fictional metadata for real titles.

See [local proxy setup and credential boundary](tmdb-proxy.md). The ignored real
root environment file stays server-only. React Native calls loopback port8787
and public credential-free image URLs; it never reads environment files or keys.
Metro blocks environment imports. `.env.example` is tracked placeholder guidance.
No dotenv transform, dependency, key constant, secret resource or account change
was introduced. Live mode is manually started after owner approval; no service,
autostart or persistent credential configuration was installed.

A page contains up to20 titles in four mixed-format rows. Focus on either of the
last two occurrences triggers another request; the reachable trailing action
also loads/retries. Responses append without removing earlier identities. A
48-title viewing window is reported separately from the provider's real end.
Concurrent end events coalesce. Aborted/stale requests cannot replace a newer
query. Failed append requests retain the previous rows. Search debounces a
bounded remote-keyboard query. Profiles and settings are session-only. There is
no playback entitlement implied by TMDB metadata. Play opens an explicitly labelled
Big Buck Bunny HLS demo for every title; see [playback and licensing](ott-playback.md).

## Focus and design

The owner-selected 11 images in `apps/probe/design` guide the fixed sidebar,
1920×1080 scale, cinematic hero, mixed artwork rows, keyboard, profiles, settings
and cast. Local original fixture art, masks and licensed Feather icons retain
provenance under `apps/probe/ott/assets/cinematic/`; real titles use TMDB art.
Missing art has a stable fallback frame instead of a fictional replacement.

Catalogue, Settings and Details now use Itar's existing virtualized rails and
native reveal pipeline. Ordinary mounted ScrollViews had left offscreen actions
ineligible, reproducing Down traps in catalogue and Cast. The adapter's optional
fixed cell decorations/headers, per-row extents and measured viewport preserve
owned native buttons and the existing native/C++ selection boundary.

Only one collection owns a provider at a time. The inactive catalogue retains
its request/session data but releases collection ownership while Details is
open. Accepted publication precedes entry; Back uses a stable occurrence bookmark
and native reveal. Visual-only metadata/callback updates retain the accepted
logical dataset, avoiding focus jumps on biography selection. Android append
preserves the exact unchanged focused binding through publication;
the temporary JavaScript recovery workaround has been removed. Source/target
retention remains bounded by the existing list integration.

Android theme all-caps, padding and background tint had clipped labels and
replaced app colors. The host button now preserves supplied case/frame/colors;
observed native focus drives cyan/white text and a native image border. Display labels
and accessible labels are separate; card borders exclude the title strip. Native
Android foregrounds and Apple shape layers follow actual host focus. No per-move
JavaScript focus ring or second geometry engine was introduced. A separate reproduced C++ region-eligibility
defect is fixed and explicitly versioned as `itar-linear-v2`; see
[focus findings](ott-focus-findings.md). The native image outline is now implemented; Android focus/blur/recycle behavior
is covered by instrumentation. Apple implementation remains runtime-unverified.

## Verification — 28 October 2026

Working branch: `no-ticket/redisign-simple-app`, owner baseline `dffaf17`.
TypeScript, full ESLint and37 serial JavaScript tests passed. Proxy tests use
fake credentials and injected responses, including hostile requests, bounded
concurrency, secret-echo sanitization, identity validation and stale state.
Collection tests include ownership handoff and rejected stale preparation.

An offline single-worker incremental Android debug build passed with768MiB JVM
heap,384MiB metaspace and Kotlin in-process. The app targets arm64-v8a; existing
host-probe tasks also checked their configured ABI outputs. Debug Metro port is
8096 (`-PreactNativeDevServerPort=8096`). Only the Itar app was reinstalled/restarted;
the owner's emulator and existing Metro process were preserved.

The owner explicitly permitted the existing Android TV emulator5554 and use of
the saved key for the live test. Real catalogue, artwork, title/credits and person
biography responses were observed. Screenshots and focus hierarchy captures
record the tested navigation; see [design QA and remaining gaps](../design-qa.md).
Android emulator results do not establish tvOS, physical-device, screen-reader,
release-build, performance or exhaustive focus acceptance.

## Owner-requested design corrections

The supplied screen PNGs remain unchanged. Newer owner instructions override
the reference sidebar on Profiles, two-poster Search, card subtitles and the
old Details return button. Startup now shows a branded JavaScript splash then
a full-screen profile chooser. Explorer/Stargazer select a session profile;
the third Add a New Profile button is focusable and intentionally does nothing.
The bottom current-profile sidebar entry opens that chooser.

Compact shared sizing keeps Settings controls visible. Cards show image/title
only, rails hide scroll indicators, Search uses a smaller keyboard with three
complete 16:9 results across, and Home Explore opens its title. Details has Play,
tighter Cast & crew heading spacing and real TMDB recommendations (similar
titles fallback); related selection opens another title.

Android debug/test builds and three selected instrumentation tests passed after
the native styling/player addition. Real HLS decoded frames, pause and Back to
Details were observed. After the Mac reconnected, live Search H and focus from
N into M*A*S*H, all five Settings controls, full-screen chooser, current-profile
switching and the bottom profile entry were rechecked without restarting the
app/emulator/server. See the dated QA report for remaining verification gaps.

## Review checkpoint

Implementation is paused for review. [Known focus/design issues and planned
weekend work](ott-next-steps.md) remain open; this is not a release acceptance claim.

## Integration with current main

The feature now includes main's validation/release and CI updates. The OTT
entry remains default; Development Settings opens the original probe carrier,
which now retains main's Release validation screen and comparison dependency.
Metro preserves external dependency realpath resolution and environment-file
blocking together. Both native-video and comparison-library dependencies remain
locked. Android mount-command changes and append retention coexist.

After integration, TypeScript, lint and37 serial JavaScript tests pass; a serial
rebuild and41 host tests (including main's added capture/memory/generated tests)
pass. Newer integration evidence does not supersede the open focus/design and
physical-device/tvOS acceptance gaps described above.
