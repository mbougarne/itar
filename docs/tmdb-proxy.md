# Local TMDB backend and native client

The React Native TV app calls only `http://127.0.0.1:8787/v1/…`. Android emulator
traffic uses a task-specific ADB reverse for port8787. The backend binds only
127.0.0.1, rejects foreign Host/Origin requests, and exposes GET-only catalogue,
selected-title details/credits, and person biography endpoints. Arbitrary URLs
and caller-supplied upstream paths are not accepted.

## Safe mock mode

From repository root, with Node22.23.4:

```sh
node scripts/tmdb-proxy.cjs
```

This mode never reads `.env` or calls TMDB. It returns explicitly labelled mock
metadata over HTTP and local original artwork. The app defaults to the proxy;
Settings can switch explicitly to offline fixtures. There is no silent fallback
from real films to fictional content. Mock mode is not live API verification.

## Live mode — owner approval required first

Before using an actual credential, obtain explicit confirmation for this exact
action: start the local backend on127.0.0.1:8787, read only the existing ignored
root `.env` value named `MOVIE_DATABASE_API_KEY` into the backend process, and
send it as TMDB’s v3 `api_key` query parameter over HTTPS exclusively to
`https://api.themoviedb.org/3` for read-only catalogue/search/title/credits/person
requests while that process runs. Search text and selected public IDs are sent
as the corresponding request parameters. The client receives public metadata
and artwork URLs, never that key. Image requests go to `https://image.tmdb.org`
without a credential. No secret is written to app code, resources, storage or logs.
This authorizes only a manually started process, not automatic future startup.

After that confirmation, the live command is:

```sh
node scripts/tmdb-proxy.cjs --live --allow-tmdb-key-use
```

Do not run it without the owner’s per-action approval. The example remains
placeholder-only; do not copy real values into it. No credentials appear in
command arguments. The backend does not log URLs, upstream bodies or raw errors,
and redacts credential echoes from public responses. It limits concurrent
upstream requests to4, timeout to8seconds, JSON to2MiB and pagination to50pages.
The client uses 160-title browsing windows with explicit cursor continuation,
while Home fills four rails of up to 15 unique titles (at most 80 source records).
Movies/Series support allowlisted genre filters through Discover; continuation
cursors bind to the category as well as media kind and query. Near-end prefetch
appends within a window. See
[the current design and verification](ott-redesign-2026-10-31.md).

The normal app/Metro configuration and server-side `.env` exclusion remain.
Use `adb -s <authorized-serial> reverse tcp:8787 tcp:8787` for the selected emulator;
do not modify unrelated devices, forwards, servers or running projects.

## Public API sources and acceptance

[TMDB authentication](https://developer.themoviedb.org/docs/authentication-application),
[popular movies](https://developer.themoviedb.org/reference/movie-popular-list),
[multi search](https://developer.themoviedb.org/reference/search-multi),
[image URLs](https://developer.themoviedb.org/docs/image-basics) and
[attribution](https://developer.themoviedb.org/docs/faq) ground the mapping.
The Settings credits include TMDB’s required notice; live distribution still
requires the approved logo/attribution and applicable asset terms.

Tests inject fake credentials/responses and exercise loopback HTTP; they never
load the real environment file. Live API, image availability and native focus
results must be reported separately. No video entitlement or playable stream is
implied by TMDB metadata.
