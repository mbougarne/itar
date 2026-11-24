# Browser, Samsung Tizen and LG webOS TV

[العربية](../ar/devices/web-tv.md)

The [standalone Cinema app](https://github.com/mbougarne/itar-cinema) uses the published DOM/Wasm adapter. The [adapter source](../../packages/itar/web-runtime/) stays in the library.

## Desktop browser

Use Node 22.23.4, npm 10.9.9, Python 3.10+, CMake 3.20+ and Make. The build looks for **Emscripten 6.0.13** in `build/emsdk` or the SDK directory specified by `EMSDK`. From the repository root, install the compiler into the ignored build directory if you don’t already have the pinned SDK:

```sh
git clone --branch 6.0.13 --depth 1 https://github.com/emscripten-core/emsdk.git build/emsdk
python3 build/emsdk/emsdk.py install 6.0.13
python3 build/emsdk/emsdk.py activate 6.0.13
```

With an existing installation, set `EMSDK` to its activated SDK root. The build checks the compiler version and reads its local configuration.

```sh
npm ci --ignore-scripts --no-audit
npm run build:web:engine
npm run typecheck:web
npm run test:web
```

Run the browser demo from the [Cinema repository](https://github.com/mbougarne/itar-cinema).

### Review Occo recordings

Open a saved trace in the [offline viewer](../../tools/occo/viewer.html). DOM focus and reader focus remain separate channels.

## Samsung Tizen

```sh
# Run in the standalone Cinema checkout
npm run build:tizen
```

The output in `build/web/tizen/` includes `config.xml`, the app bundle and its assets. It is an unsigned staging directory. Import the complete directory into a Samsung TV SDK web app workflow, configure an app identity and signing profile for the selected TV, and package a signed `.wgt` for testing. The manifest targets Tizen 6.5 and the JavaScript build targets Chromium 85. Itar Cinema was tested on a Samsung UE43DU7100UXTK with the physical remote and live catalogue. Voice Guide passed on the same TV before the Home row performance update.

On the TV, first verify a packaged cold launch with offline fixtures and image loading. Then test 5-way movement, Select, Return (key code 10009), and held Back. Run the same flow with Voice Guide enabled and check spoken labels, activation, inactive route exclusion and restoration after an item disappears. Record the model, firmware and input device.

## LG webOS TV

```sh
# Run in the standalone Cinema checkout
npm run build:webos
```

The output in `build/web/webos/` includes `appinfo.json`, an 80×80 icon, the app bundle and assets. With the webOS TV CLI installed, `ares-package build/web/webos` produces an `.ipk` for the separate developer-device install workflow. Cinema’s remote navigation was tested on a physical LG TV with Audio Guidance enabled.

Start with a 5-way move into a card, switch to the Magic Remote pointer, scroll with the wheel and return to 5-way input. Observe the actual focused element after each transition. Try Back (key code 461) from Details and an editor. Enable Audio Guidance and check each card exposes one meaningful action, including after scrolling recycles it.
