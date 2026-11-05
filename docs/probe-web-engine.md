# Experimental probe WebAssembly engine

This binding builds the existing C++20 engine for the `apps/probe` web consumer.
It is an app-only probe, not a published Itar browser API or physical-TV support
claim. C++ owns registry, scope/history policy, destination selection, request
identity, cancellation and host confirmation. JavaScript owns committed DOM
measurement, input ownership, virtualization, scroll/focus effects and rendering.
The accepted architecture is unchanged.

## Reproducible toolchain

The probe pins Emscripten **6.0.13**. Use the official
[emsdk installer](https://emscripten.org/docs/getting_started/downloads.html),
Python 3.10+ and CMake 3.20+. Keep the SDK outside tracked source; for example:

```sh
git clone --branch 6.0.13 --depth 1 https://github.com/emscripten-core/emsdk.git build/emsdk
python3 build/emsdk/emsdk.py install 6.0.13
python3 build/emsdk/emsdk.py activate 6.0.13
node apps/probe/web/engine/build.cjs
node --test apps/probe/web/engine/engine.test.mjs
```

Set `EMSDK` to an existing SDK directory instead. Activation writes SDK-local
configuration; this workflow needs no global shell change. The build rejects a
compiler version other than 6.0.13 and uses activation's SDK-local Python when
available; otherwise put Python 3.10+ on PATH or set `EMSDK_PYTHON`.
Output: `build/web-engine/itar-web.js` and `itar-web.wasm`, both required by the web
build. The ESM factory is `createItarEngine`; instantiate `new module.WebEngine(2048)`.

The build uses single-threaded Wasm, C++ exception handling through Emscripten's
JS mechanism, no filesystem, 32 MiB initial/256 MiB maximum linear memory, and a
Chromium 85 compilation target. No SIMD, shared memory or browser-native Wasm
exceptions are requested. These are artifact settings, not a supported-TV floor.
DOM and Wasm share browser scheduling; native JS-stall independence does not apply.
The artifact targets the web only, with no conditional Node imports. Its explicit
incoming API accepts `wasmBinary`, `locateFile` and `onAbort`; embedded bytes avoid
file-scheme fetch limitations in packaged TV apps.

## Ownership and effect protocol

- `sync(nodes)` atomically publishes a complete bounded logical graph, including
  unmounted virtualized nodes. Node keys are stable occurrence identities;
  parent keys describe scopes. Mounted targets carry positive DOM geometry and
  monotonically newer mount identities when recycled. Scope flags retain entry
  readiness, history restoration, layout, boundaries and trapping.
- `detach(key,mount)` reports an actual removed host incarnation independently
  of application batches. `observe(key,mount,channel,effectId)` reports real focus;
  empty key means confirmed absence. `unmanaged(channel)` identifies foreign
  focus. Input and accessibility channels are separate; an unknown reader state
  is not proof the engine owns reader input.
- `direction`, `focus`, and `restore` return request status, not a completed host
  move. Call `advance(performance.now())` before work; deadlines remain 1,000 ms
  from issue. `release()` ends a held direction.
- `drain()` returns bounded effects with key, mount, identity and cancellation
  correlation. `issue(id)` must return `issued` (15) immediately before the host
  operation. Revalidate actual DOM incarnation, then perform the focus effect.
  Observe actual DOM focus with its effect ID and call `complete(id,2)` afterward;
  a request is only confirmed by the matching observation (status 8).
- For reveal: issue, mount the requested target, commit geometry with `sync`, then
  `realize(id,key,newMount)`. Successful realization retires reveal and emits a
  focus effect. Do not complete reveal before realization. Cancellation uses
  the exact `cancels` identity; late observations still describe reality but do
  not revive a cancelled intent.
- Call `dispose()` on owner teardown, then embind `delete()` once references have
  unwound. No call may use the deleted object. Capacity is 1–4096 logical nodes;
  request/effect IDs and layout/mount inputs are bounded below JavaScript's exact
  integer limit. Host effect records are capped at 32.

Automated coverage supplies the actual compiled Wasm bytes in Node with fetch
disabled and a deliberately invalid resource URL, then checks directional
selection, reader ownership, separate focus channels, atomic rejection, reveal,
cancellation, stale mounts, scope readiness, disposal and bounded repeated use.
This does not establish DOM layout, TV remote delivery, reader speech, device
performance or distribution eligibility. Those remain manual acceptance gates.

CI's `Web / Wasm and TV artifacts` job uses Ubuntu 24.04 and emsdk commit
`35659964bc2762fffec0d257997fb61475f765b7` with SDK 6.0.13. It builds the engine,
checks web types, runs actual-Wasm host tests and builds browser/Tizen/webOS
directories. It starts no app, server, emulator or simulator. This is build/test
coverage, not TV acceptance; no artifact upload or signing is performed.
