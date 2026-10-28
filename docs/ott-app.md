# OTT showcase inside the existing Itar app

The default `apps/probe/App.tsx` now opens Itar Cinema from `apps/probe/ott/`.
The existing `ItarProbe` native registration, Android/iOS projects, Babel
configuration, package manifests, workspace dependency and lockfiles are retained.
Metro keeps its original watch folder/default exclusions and adds an environment-
file blocklist to prevent accidental mobile imports.
No vendored Itar package or standalone-project configuration is imported. The
separate `itar-ott` folder is retained untouched and is no longer the app target.

In development builds, Settings → Open original Itar probes opens the exact
previous root screen saved as `apps/probe/ProbeApp.tsx`; Return to Itar Cinema
re-enters the OTT app with a new provider lifetime. Existing adapter/API/list
probe screens remain available. Probe mode is not exposed by release Settings.
No native generation, installation, builds or runtime interaction occurred.

## Implemented source and fixture behavior

Home, Movies, Series, Search, Profile and Settings; selected-title details and
cast biographies. Home/Movies/Series initially fetch four rows (two landscape,
two poster), with another four-row page on near-end scroll, final-row observed
focus, or Load more. A finite 48-entry window avoids unbounded mounted views.
The 96 fictional catalogue records and16 procedural local images require no
provider. The UI labels asynchronous fetching as local simulation, not HTTP.

Search offers A–Z/space/delete/clear, debounce, filtering, empty/error states and
pagination. Profiles and settings are session-only. Settings can slow requests
or fail the next request; Retry preserves previous rows and appends exactly once.
The request controller coalesces repeated end events, aborts obsolete requests
and rejects stale generations even if transport ignores abort.

Cards have a single native Itar action plus decorative artwork. Parent scope
boundaries allow navigation among chrome, rows and keyboard. Catalogue bodies
remain mounted/inactive during details; Back requests native history. Top-level
screen changes remount the page and enter its navigation control (re-entry).
Native accent feedback does not depend on a JS animation. No video is associated
with the fictional titles, and no Play action is shown.

These are bounded mounted ScrollViews, not custom Itar virtualized collections.
Scrolling/reveal, clipping, restoration, inactive accessibility, native Back,
reader semantics and TV layout must still be observed on actual runtime/device
artifacts. See [unrun scenarios](ott-scenarios.md). No support/ticket is marked
complete from static checks. The exact native source in this local main checkout
is used; no sibling tarball or newer library commit was silently substituted.

## Checks and assets

From repository root: `npm run typecheck`, targeted lint, and
`node --test --test-concurrency=1 scripts/*.test.cjs`. These are lightweight source
checks; do not invoke app launch scripts while the owner is using native tools.
The original app's normal commands/port8096 remain unchanged for a future window.
`scripts/generate-ott-art.py` reproduces local images; their credit/dimensions/
hashes are in `apps/probe/ott/assets/manifest.json`.

## Optional TMDB integration: server-side only

The intended provider is TMDB (The Movie Database), confirmed by the owner.
The example names TMDB and its public v3 API URL; the key remains a placeholder.
Review provider terms before adding an adapter. The app
currently reads no environment files, keys or live endpoint. Metro blocks all
`.env`/`.env.*` imports, including the example; Git separately allows the example. `.env.example` is
placeholder-only documentation for a future separately run local/backend proxy;
it does not configure a working integration.

A separately implemented proxy may use `MOVIE_DATABASE_API_KEY` as its TMDB v3
`api_key` credential; see [TMDB authentication](https://developer.themoviedb.org/docs/authentication-application).
That value stays server-side and must not appear in client requests or responses.

Developers may copy the example into an ignored server-side environment file,
then supply their own provider settings to their own proxy process. Keep the
real file outside mobile assets and bundler inputs. Do not add dotenv/Babel
transforms, `EXPO_PUBLIC_*` variables, React Native key constants, JSON imports,
or native resource entries for secrets. Never send a provider key to the app.

A future consumer adapter should call only a credential-free proxy API: bounded
catalogue requests with kind/query/cursor; responses with public title/cast data,
licensed artwork references and an opaque next cursor. Validate/schema-map the
response to the existing content/occurrence identities, preserve cancellation and
stale-response protection, and keep all upstream authorization, rate limits and
key handling in the proxy. The existing client continues using local fixtures
until that adapter and an actual proxy are implemented. Never silently map real
films to fictional playback. Review provider/asset permissions before distribution.

## Integration verification — 28 October 2026

On existing main `478ca6d` (one commit behind locally recorded `origin/main`):
TypeScript passed before and after integration; targeted app/new-script lint passed
with zero warnings; all26 JavaScript tests passed serially (including6 fixture/
session and2 environment-boundary tests); `git diff --check` passed. Existing
native/configuration/lockfile fingerprints were preserved, except the intentional
Metro resolver guard. Environment-file metadata stayed unchanged without reading
real environment contents during the environment work. Original `ProbeApp.tsx`
bytes match the prior committed root. All16 image hashes and sibling project
preservation checks passed. `.env.example` is not ignored and eligible for Git;
no files were staged or committed.

These checks establish source integration, not native execution. No dependency
installation, Metro server/bundle, native generation/build, OS permission change,
emulator/simulator command, physical-device test or visual/reader verification
was performed. No live provider or proxy is implemented/configured. No fetch/pull,
branch switch, commit, push or PR occurred.
