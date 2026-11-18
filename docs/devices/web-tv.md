# Browser, Samsung Tizen and LG webOS TV

[العربية](../ar/devices/web-tv.md)

Itar Cinema has a web-only adapter in the [example app](../../apps/probe/web/). React Native Web renders the shared screens. C++ compiled to WebAssembly selects focus targets, and a DOM host measures elements, scrolls them into view and observes browser focus. Selection and DOM work share the browser thread. The web build resolves `itar/react` to this adapter inside the example; the native package does not supply a browser export.

## Desktop browser

Use Node 22.23.4, npm 10.9.9, Python 3.10+, CMake 3.20+ and Make. The build looks for **Emscripten 6.0.13** in `build/emsdk` or the SDK directory specified by `EMSDK`. From the repository root, install the compiler into the ignored build directory if you don’t already have the pinned SDK:

```sh
git clone --branch 6.0.13 --depth 1 https://github.com/emscripten-core/emsdk.git build/emsdk
python3 build/emsdk/emsdk.py install 6.0.13
python3 build/emsdk/emsdk.py activate 6.0.13
```

With an existing installation, set `EMSDK` to its activated SDK root. The build checks the compiler version and reads its local configuration. Install the workspace dependencies and start the demo:

```sh
npm ci --ignore-scripts --no-audit
npm run web
```

Open `http://127.0.0.1:8080`. A new session uses local catalogue fixtures. Sign in with demo values, select a profile, then use arrows to move, Enter to activate and Escape for Back. Tab and pointer input work independently. In **Settings**, turn off **TV arrow-key navigation** to leave the arrow keys to the browser or a reader. Stop the server with Ctrl+C.

To repeat only the checks after building, run `npm run typecheck:web` and `npm run test:web`. The latter loads the compiled Wasm. Chromium testing has exercised pointer access to active routes, Search focus recovery, Back from an editor, focus visibility after pagination and custom card activation. An accessibility-tree check verifies exposure or hiding of elements. Audible speech, reader ownership on a TV and device performance require their own runs.

To check the card focus ring with the fixture catalogue, start on **Explore title** and press Down, then Right. The cyan ring should move from **Beyond the Atlas** to **A Different Tide** and remain visible over all four edges of the artwork. Press Enter to open Details, then Escape to return to the same highlighted card.

### Known pointer issue on Home

In Chromium at 1280×720, starting from **Explore title** and clicking the second card in **Popular stories** can focus the card without opening Details. In the reproduced case, the card received pointer-down and focus, then a different element received the click. Pressing Enter opened the focused card, and Escape restored it. The offline fixture for this case is **A Different Tide**.

## Samsung Tizen

```sh
npm run build:tizen
```

The output in `build/probe-web/tizen/` includes `config.xml`, the app bundle and its assets. It is an unsigned staging directory. Import the complete directory into a Samsung TV SDK web app workflow, configure an app identity and signing profile for the selected TV, and package a signed `.wgt` for testing. The manifest targets Tizen 6.5 and the JavaScript build targets Chromium 85. Physical compatibility beyond successful staging remains open.

On the TV, first verify a packaged cold launch with offline fixtures and image loading. Then test 5-way movement, Select, Return (key code 10009), and held Back. Run the same flow with Voice Guide enabled and check spoken labels, activation, inactive route exclusion and restoration after an item disappears. Record the model, firmware and input device.

## LG webOS TV

```sh
npm run build:webos
```

The output in `build/probe-web/webos/` includes `appinfo.json`, an 80×80 icon, the app bundle and assets. With the webOS TV CLI installed, `ares-package build/probe-web/webos` produces an `.ipk` for the separate developer-device install workflow. webOS TV 22 is an investigation candidate. The manifest enables Audio Guidance semantics; physical playback, focus and speech remain unverified.

Start with a 5-way move into a card, switch to the Magic Remote pointer, scroll with the wheel and return to 5-way input. Observe the actual focused element after each transition. Try Back (key code 461) from Details and an editor. Enable Audio Guidance and check each card exposes one meaningful action, including after scrolling recycles it.
