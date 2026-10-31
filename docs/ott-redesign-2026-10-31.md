# Cinema redesign — 31 October 2026

Owner-requested implementation on `fix/design-polish`, starting from clean
`f69dd4e`. The frozen architecture and C++ navigation implementation are unchanged.
This supersedes the design/pagination checkpoint in the older OTT notes.

## Review slices

This multi-screen request is divided into independently reviewable feature groups,
each below the repository's 500-authored-line ceiling; no commit or PR is created.

1. Data: TMDB metadata mapper/client/types, catalogue session, provider tests.
2. Home/Search: Hero, Browse, shared theme, FlatList near-end callback.
3. Details: background-only hero, CTA row, related/cast/information tabs.
4. Session/navigation: Auth, app shell, native-keyboard return, sidebar/sign-out.
5. Guide: EPGTalk parser, cached fetching, preview, timeline grid, parser tests.
6. Presentation/player: native focus fill and regression, Action styles, playback
   controls, optional comparison-probe startup isolation.

## Behavior

- The existing 1920×1080 design scale now has a 600-unit Home hero over a full-height, edge-to-edge content backdrop. The sidebar
  occupies 112 units collapsed and overlays 360 units when a navigation target has
  confirmed focus. Icons stay visible; text appears on expansion.
- Home has four rails of up to 15 distinct titles each, plus an EPG preview.
  It fetches until 60 unique titles are available, bounded by 80 source records;
  duplicate TMDB entries do not shorten rails unnecessarily. Hero actions
  open Details or the TV guide. Cards show only 16:9 or 2:3 artwork; accessible
  names retain title/media identity. Headings and guide previews provide text.
- Movies, Series and Search prefetch at the FlatList's near-end threshold and
  near the final focused items. Requests coalesce; failed requests preserve rows.
  Stable identities remain through appends. The current collection contract
  allows 256 logical nodes: a 160-title window leaves room for row scopes and
  pagination. At the boundary, Continue to next titles advances the saved cursor
  explicitly; it does not restart at page 1. Home stops after filling its four rails.
- TMDB supplies rating/votes, runtime or episode length, genres, tagline, status,
  languages, countries, studios, seasons/episodes and US certification when
  present. Details requests append the appropriate movie release-date or series
  content-rating resource. Missing values are identified, not invented.
- Details uses one backdrop with no duplicate title poster. Its tabs are More
  like this, Cast & crew, and Information. Selecting a person loads biography.
  My list and Like are focus-only no-ops. Play still opens Big Buck Bunny.
  Subtitle/audio-description availability is explicitly unknown; TMDB title
  metadata is not evidence about tracks or entitlements in a playable asset.
- Movies and Series use five-column landscape grids, with near-end row loading.
  All, Action, Comedy, Drama, Documentary and Sci-fi controls select a fresh
  catalogue session; category-specific cursors cannot be reused across filters.
  The proxy maps an allowlisted category to the movie/TV Discover genre ID.
- Search shows trending suggestions before input and has a smaller keyboard,
  native filled focus background, four landscape
  cards across and 280-unit rows. Search relevance order is preserved.
  Search, Details tabs/rails and the Home guide preview have a 40-unit sidebar
  gutter. The cast biography separates the name/role from the bounded body text.
- Welcome has Sign in and Sign up. Both accept arbitrary or empty input and open
  the local profile chooser; there is no account request or credential storage.
  Keyboard dismissal restores the edited field. Sign out clears local route
  state and returns to Welcome.
- The existing react-native-video 6.19.3 and exact HLS source remain. Controls
  include pause/resume, restart, ±10 seconds, mute/unmute, close and progress.
  Seek controls are disabled before media loads; they become available on load.
- Native focus fill is an optional presentation prop. Android draws behind the
  label; Swift uses a separate shape layer. Blur/detach removes the fill without
  replacing the application's base background. No per-key JS styling loop.
  Numeric style borderRadius is forwarded to each host: Android clips the whole
  button (including its base background), and Swift clips the rounded host layer.
  This removes square base corners protruding beyond the focused fill/outline.
- The optional comparison library 5.2.0 bundles React 18 JSX internals and threw
  `ReactCurrentOwner` during startup on React 19. Its validation-only import is
  now lazy with a visible load-failure message; other probes/Cinema can start.
  This does not claim that the third-party comparison is compatible.

## EPG source and bounds

[EPGTalk public JSON](https://epgtalk.com/api.html) provides UTC start/stop seconds.
The credential-free `https://epgtalk.com/api/now/uslocal.json` feed is cached for
30 minutes and refreshed while mounted. The parser validates time intervals,
retains available listings from one hour ago through ten hours ahead, deduplicates
identities and bounds stored data to six channels and 48 programmes per channel.
Only programmes intersecting the two-hour viewport are rendered (at most twelve
per channel). Previous/Next shift by an hour; Now restores the current window.
Navigation clamps to actual retained schedule bounds, with no invented listings. The screen displays a two-hour
aligned timeline in the device's local timezone; selected programme information
is shown below. These are schedules, not channel playback links. EPGTalk attribution
and update time remain visible. Raw API data/URLs are not accepted as instructions.

References: [TMDB details](https://developer.themoviedb.org/reference/movie-details),
[TMDB Discover movies](https://developer.themoviedb.org/reference/discover-movie),
[TMDB Discover TV](https://developer.themoviedb.org/reference/discover-tv),
[React Native Video 6](https://docs.thewidlarzgroup.com/react-native-video/docs/v6/intro/).

## Verification

- Library build, TypeScript, ESLint and Android JS bundle: pass.
- 48 serial JavaScript tests: pass, including metadata validation, mocked proxy,
  stale requests, bounded continuation, category cursor isolation, Home/grid
  repacking and EPG normalization/time-window limits.
- Android debug/test APKs, adapter/app/dependency lint: pass using JDK 17, offline
  cached dependencies, arm64-v8a and a single Gradle worker. No lint suppression.
- Existing Android TV API 36 emulator `emulator-5554`, 1920×1080: updated APKs
  installed with `-r`, no data clear or emulator restart. CallbackTest passes,
  including actual focus/blur/detach pixel checks for the new fill. The refinement
  adds transparent-corner checks and a measured, detached-label update case.
- Live TMDB backend started only after explicit owner approval. Public health
  reports live mode; catalogue returned 20 titles/four rows, and a selected movie
  returned rating 7.04, runtime 119, US R certification, English, 8 credits and 12
  related titles. Provider values can change; this is dated evidence.
- EPGTalk public feed fetched successfully: 291 channels, about 695 KB, updated
  31 October. Native grid showed six channels and correctly aligned programme
  lengths. D-pad horizontal/vertical movement and programme selection passed.
- Emulator screenshots/remote checks cover arbitrary-password sign-in, blank
  sign-up, profile entry, Home/hero, collapsed/expanded sidebar, all three details
  tabs, Search key fill/four-card layout, EPG selection and sign-out to Welcome.
- Big Buck Bunny decoded visibly. Pause and +10-second seek worked with focused
  native controls; Back restored Details. Initial media loading took several
  seconds. No replacement video was introduced.

## Joint focus pass still required

These observations are not assigned to C++, Kotlin/Swift or application ownership
without a controlled reproduction and trace:

- Left from the Home hero returned to the geometrically nearby Profile sidebar
  item, rather than the active Home route. Expansion/collapse itself worked.
- Repeated Down during Home row realization sometimes showed the newly revealed
  row without a visible focus ring; a later Select opened the earlier row's title.
  Slower navigation and Back restoration worked in other transitions. Reproduce
  on a clean launch without Fast Refresh, trace intent/host confirmation and
  inspect clipping/retention before changing engine policy.
- Search keyboard cross-row/escape behavior needs a deliberate navigation pass;
  filled focus styling and query/results were verified independently.
- Home's bottom guide preview uses the same virtualized rows. The full guide was
  verified through its hero entry; bottom-preview entry remains part of the row
  realization follow-up. Full 160-title device traversal was not performed;
  continuation/coalescing/window bounds have deterministic tests.
- Apple/tvOS build/runtime, VoiceOver/TalkBack and physical TV acceptance remain
  unrun. Swift code changes are not Apple platform acceptance.

## Refinement runtime observations

- The first Home rail was traversed through all 15 positions using the D-pad.
  Movie Drama and Series Action filters refreshed their five-column grids.
  Search showed four landscape suggestions before typing. Details related/cast
  gutters and selected biography were checked visually.
- EPG Next moved 16:30–18:30 to 17:30–19:30, Previous restored the earlier window,
  and Now was exercised. Times are emulator-local and this observation is dated.
- Scrolling the Movie grid exposed an Android TextView `checkForRelayout` crash
  during a label update before parent layout parameters existed. TargetView now
  supplies temporary wrap-content parameters when absent and avoids redundant
  text updates. The same scroll sequence then showed subsequent API rows without
  the crash. This is a Kotlin host-lifecycle correction, not a C++ policy change.
- The pre-existing row-reveal/focus progression issue still needs the controlled
  joint focus pass above; new rows appearing is not proof that every key press
  chose the intended destination. No new tvOS or screen-reader acceptance claim.

Metro on 8096 and the approved live TMDB proxy on 8787 are left running for owner testing.

Representative emulator captures are retained locally in
`build/ott-review-2026-10-31/` (ignored, not part of the source change).
