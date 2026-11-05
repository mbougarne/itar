# Browser and web TV probe builds

The OTT application in `apps/probe` can be built for a browser, Samsung Tizen web
staging, or LG webOS web staging. This is an experimental application integration
using the C++ engine compiled to Wasm and a DOM host adapter. It is not a published
`itar` web package or a device-support claim. Existing Android/tvOS builds retain
their native entry and adapters. VIDAA and console deployment remain unresolved.

## Build

Use the repository's Node/npm versions, install the locked dependencies, and build
the web engine with the pinned toolchain described by
`apps/probe/web/engine/build.cjs`. The build commands include that engine step:

```sh
npm run build:web
npm run build:tizen
npm run build:webos
```

The commands write `build/probe-web/browser`, `build/probe-web/tizen`, and
`build/probe-web/webos`. Each directory contains its own HTML, JavaScript, CSS,
artwork, icon and `itar-web.wasm`; all bundled URLs are relative. The bundle embeds
the Wasm bytes to avoid fetching a binary through a packaged TV URL scheme. Copy the entire
directory, not only `app.js`. `build-manifest.json` records its target and inputs.
These build commands do not launch a browser, app, emulator or simulator.

For manual browser testing, run `npm run web` from the repository root (or
`npm run web -w itar-probe`). It builds the browser target, then serves it at
`http://127.0.0.1:8080`; open that address in your browser and stop the server with
Ctrl+C. If the build already exists, `npm run web:serve` serves it without rebuilding.
These serving commands require Python 3. Opening `index.html` directly with a
`file:` URL is not a supported browser test path. No server or app was started
as part of code-only verification.

Tizen output is an unsigned staging directory containing `config.xml`, not an
installable signed `.wgt`. Import it into the Samsung TV SDK workflow, set the
application/package identity and signing profile appropriate to your device, then
package/sign/install there. No certificates or partner credentials are generated.

webOS output contains `appinfo.json` and the required 80×80 PNG test icon. Package
that directory with your authorized webOS CLI workflow, for example
`ares-package build/probe-web/webos`; device installation is a separate action.
The manifest opts into Audio Guidance semantics; that flag does not prove reader
acceptance. Neither a `.ipk` nor a physical-device result is produced by these builds.

## App behavior

Web builds default to bundled fictional catalogue fixtures without a backend.
After demo sign-in, localStorage remembers the sign-in flag, selected profile and
catalogue source under `itar.probe.session.v1`. Reload restores Home with those
choices. Sign-out removes that record. No email, password or TMDB credential is
stored. If browser storage is blocked, the app works for the current page only.
Restoring the TMDB source still requires its backend to be running.
For real TMDB titles and posters, start the loopback backend with
`--live --allow-tmdb-key-use --allow-web` after the per-startup approval described
in [TMDB setup](tmdb-proxy.md), then select Settings → Content source → TMDB proxy.
The `--allow-web` flag permits only `http://127.0.0.1:8080` and
`http://localhost:8080`; other browser origins remain rejected. Without that flag,
the backend remains native-only. Credentials stay in the backend. For testing
without credentials, `node scripts/tmdb-proxy.cjs --allow-web` serves mock metadata.
Packaged TVs still need a separately configured reachable service; this local
browser option does not establish device backend connectivity.

Use directional keys/remote navigation or pointer input in the catalogue. Browser
Tab remains available. The external “TV arrow-key navigation” checkbox lets a user
turn off directional interception when using a reader or browser navigation; web
code cannot reliably detect screen-reader ownership. Escape, Samsung Return (10009), and webOS Back (461) dispatch
the app's Back listeners from the most recently mounted handler. Long-press repeats
are ignored for Back. The browser uses its native confirmation dialog for exit UI.

The web player fills the app viewport with an HTML video surface and persistent
play/pause, seek, timeline, mute and volume controls. Its top-right close icon and
remote Back/Escape return to the title. There is no fullscreen toggle, native
media menu or picture-in-picture action. Tab stays within the player; sliders
retain native keyboard adjustment, and optional arrows move between controls.
Playback pauses when hidden and releases its source on close. Autoplay denial
offers Play; media errors offer Retry. The public sample is
[Big Buck Bunny 4K](https://kodi.mirror.garr.it/demo-files/BBB/bbb_sunflower_2160p_30fps_normal.mp4)
on the GARR Kodi mirror: 3840×2160, H.264, 30 fps, 10:34 duration, approximately
633 MB for the full file. It streams remotely and is not bundled into the app.
© Blender Foundation | bigbuckbunny.org,
[CC BY 3.0](https://peach.blender.org/about/), not a stream of the catalogue title.
Network reachability, codecs, physical TV remotes/readers and DRM are separate
acceptance checks. No streaming entitlement is supplied by TMDB metadata.

## Compatibility and evidence

Build inputs: React/React DOM 19.2.0, React Native Web 0.21.4 and esbuild 0.28.2.
The JS target is Chromium 85, chosen to align with the existing Tizen 6.5 and
webOS TV 22 investigation candidates. This target transforms syntax; it does not
polyfill APIs or establish compatibility of CSS, Wasm, codecs or screen readers.
See [Samsung research](runtime-research/samsung.md) and
[webOS research](runtime-research/webos.md). Browser scheduling still applies;
this implementation makes no JS-independent navigation claim.

Node tests cover copied image assets, local manifest references, icon dimensions,
Back listener ordering/cleanup and confirmation callback deduplication. Full
bundling and the C++/Wasm tests are code evidence. Later device acceptance must
check source removal/loading, actual focus and feedback, pointer/5-way transitions,
reader ownership, activation, inactive routes and teardown. These remain unrun.

Primary build/packaging references checked 2026-11-05:
[esbuild API](https://esbuild.github.io/api/),
[esbuild releases](https://github.com/evanw/esbuild/releases),
[React Native Web](https://necolas.github.io/react-native-web/docs/),
[Samsung configuration](https://developer.samsung.com/smarttv/develop/guides/fundamentals/configuring-tv-applications.html),
[LG appinfo](https://webostv.developer.lge.com/develop/references/appinfo-json).
