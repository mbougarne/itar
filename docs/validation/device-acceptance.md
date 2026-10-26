# Native/device acceptance protocol (ITAR-0079–0083)

All rows below are **NOT RUN**, not passing support claims. Fill each independently
with exact commit, tarball integrity, RN/React versions, device model, OS, input
remote, reader version/settings, list configuration, build mode, diagnostic mode,
recording paths, observed results and reproduction commands. Use synthetic data.

| Target | Reader modes | Required result |
| --- | --- | --- |
| Physical Android TV | Off; TalkBack on | Pending hardware evidence |
| Physical Fire OS | Off; VoiceView on | Pending hardware evidence |
| Physical Apple TV | Off; VoiceOver navigation; VoiceOver exploration | Pending hardware evidence |
| Fresh Android TV tarball consumer | Off; actual registration/focus/style smoke | Pending native consumer build/run |
| Fresh tvOS tarball consumer | Off; actual registration/focus/style smoke | Pending native consumer build/run |

Do not substitute an emulator/simulator for a physical row. Label their results
separately. Use the existing React API, virtualized list and adapter preview
screens for mounted navigation, activation, inactive routes, modal opener return,
loading, cancellation, recycling and disposal. Repeat removal/hide/disable/clip/
recycle with a competing unrelated default, rapid input, delayed/reordered outcomes
and JS load. Capture unmanaged/absent/unknown host focus and intermediate highlight
and speech before final recovery. Check committed live semantics, reader input
ownership, no speculative Itar focus or duplicate automatic speech. Apple adds
clicks/swipes/momentum, native effects/reduced motion and both reader modes.

## Mounted JS-stall comparison

Use Release binaries, the **Release validation** screen, 8 mounted cards in two
rows, identical input cadence (20 alternating Right/Left inputs), 0/750/2000ms JS
load after a 1s delay. Move focus onto card 1 before the stall. Native/Itar modes
share card frames; native Button feedback differs from Itar text/border, so report
this visual-policy difference. Android Itar uses engine selection; UIKit mounted
navigation remains cooperative and host-selected. Do not time native progress
using JS focus handlers during a JS stall.

Named pinned comparison candidate: `react-tv-space-navigation@5.2.0`, from its
[upstream package manifest](https://github.com/bamlab/react-tv-space-navigation/blob/main/packages/lib/package.json).
It uses logical directional hierarchy and JS-driven focus rendering; it cannot
be presumed equivalent to UIKit geometry. Its RN TV 0.83/React 19.2 integration
failed the type integration probe described below; runtime behavior is **unverified**. Registry artifact integrity resolved on 2026-10-26:
`sha512-MckFAQMmPIfb7mdO0c3h/IDAshaEOKS29xXY0RQTcESre5bvtFTURBCV1zK3BnJsc9DWn3fNeeJvUkIDmUioRA==`. It is installed and locked only for the reference comparison probe.
`probes/comparison/Library5_2_0.tsx` uses the same two rows/eight card frames,
a trapped native anchor, key-down-only RN TV remote subscription and JS-driven
logical highlighting. It is intentionally outside the working app: integration
failed typecheck when the library's Node type reference exposed incompatible
global `FocusEvent` versus native focus-capture types at `virtualized.tsx:58`.
Reproduce with `node node_modules/typescript/bin/tsc --noEmit -p probes/comparison`.
This configuration is **unsupported/unmeasured**; the probe is not a shipping
adapter, a measured native baseline or permission to weaken typechecking.
A compatible integration and idle runtime check are required before timing.

For every mode/target collect p50/p95/p99 for input scheduling, geometry/update,
selection where owned, native confirmation and visible feedback; frame stalls,
binary bytes and cold startup delta against the native baseline. Android uses
Perfetto/system tracing and frame observations; Apple uses Instruments/signposts
and frame observations. If markers are absent or clocks cannot be correlated,
mark the component unmeasured. New React content, app activation callbacks and
React-only visuals remain outside mounted JS-independence claims. Calibrate
budgets after results; do not assert a C++ advantage beforehand.

## Long native sessions

Run existing route/modal and virtualized-loading cases sequentially 100 times;
keep the ordinary clipping/window configuration (never mount the full catalogue).
Warm up 10 cycles; checkpoint at 10/25/50/75/100 and after quiescence and teardown.
Record elapsed duration, logical/mounted counts, native source/target retained
view counts, requests/effects/history/trace bounds, peak/current memory and reader
mode. Repeat the same run once to inspect trends. Distinguish host caches from
owned leaks; RSS need not return to an arbitrary exact value. Investigate growth
or nonreleased ownership before accepting the configuration.

## Fresh native consumers

Run `check-package.cjs` first and retain its tarball/integrity/file list. Install
that exact artifact outside the monorepo, with RN TV `0.83.0-0`, React `19.2.0`,
Android SDK36/NDK27.1.12297006 and the selected compatible tvOS Xcode toolchain.
Use no workspace links or repository source paths. Both Apple pods resolve to
`node_modules/itar`: add `ItarEngineCore` explicitly there; autolinking selects
`ItarEngineNative`. The Swift pod imports only the C facade; no application-wide
Swift/C++ interop setting. Follow `itar/react` README and virtualization recipe.
Build actual Android TV/tvOS hosts, run registration/focus/native-style and the
selected FlatList smoke scenario, and record simulator/device identity. Portable
C++ facade compilation alone does not satisfy either native consumer row.
