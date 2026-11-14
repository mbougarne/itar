# Local TMDB backend and native client

The React Native TV app defaults to `http://127.0.0.1:8787/v1/…`. Android emulator
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
For local browser testing, append `--allow-web` to the manually started backend
command. This enables responses for exactly `http://127.0.0.1:8080` and
`http://localhost:8080`, without credentials in browser code or wildcard CORS.
Select TMDB proxy in the app's Content source settings. The same per-startup live
credential approval above applies. Without this flag, browser Origin headers
remain rejected; foreign Host headers are always rejected.
Use `adb -s <authorized-serial> reverse tcp:8787 tcp:8787` for the selected emulator;
do not modify unrelated devices, forwards, servers or running projects.

## Physical TV on the same private IPv4 network

The TV's loopback is not the Mac's loopback. Keep the approved live backend on
127.0.0.1:8787 and start a separate credential-free gateway for one selected TV.
Replace these example addresses with the verified Mac and TV addresses:

```sh
node scripts/tmdb-device-gateway.cjs 192.168.1.10 192.168.1.20
```

It binds only the named Mac address on port 8788, checks the actual peer address
and exact Host, rejects Origin headers and non-GET/arbitrary routes, and forwards
only to 127.0.0.1:8787. It never reads dotenv or credentials. Address filtering is
for manual testing on a trusted LAN, not a public hosting/authentication scheme.
The backend's existing live-key approval, host guards and upstream limits remain.
The gateway expects live metadata; loopback artwork URLs from mock mode are not
rewritten. Stop the gateway when the device session ends or its address changes.

Set `ITAR_TMDB_PROXY_URL=http://192.168.1.10:8788` for the native bundle/build.
For Xcode CLI builds, pass it as a build setting alongside the chosen signing
settings. Babel replaces only that public value; it does not import dotenv or
inline other environment values. Invalid values fail the build. Omitting it
retains the loopback default. Only canonical private IPv4 HTTP origins on port
8788 are accepted. Rebuild and reinstall when the Mac's address changes.

Browser/web-TV bundles retain the loopback default; they do not consume this
native setting. The Apple probe already sets `NSAllowsLocalNetworking`; broad
ATS exceptions are not required for the tested modern tvOS runtime. See
[Apple's local-network ATS setting](https://developer.apple.com/documentation/bundleresources/information-property-list/nsapptransportsecurity/nsallowslocalnetworking).

Verify `/health` and catalogue responses on the Mac separately from requests
received from the TV. The gateway logs only response status and route pathname,
never search queries or upstream URLs. Data connectivity does not establish
correct rendering, focus, or screen-reader behavior.

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
