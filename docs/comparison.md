# Comparing TV focus systems

[العربية](ar/comparison.md) · [Documentation](README.md)

## What Itar adds

Itar tells a React Native TV app which card the host actually focused. The app names a card by a stable key, requests focus and receives a result it can act on or cancel. The Cinema example runs the same engine in a browser through a DOM/Wasm adapter.

Suppose a viewer opens a film from *Watch again*. The same film appears in *Featured*. While Details is open, *Watch again* changes order and its old card view is reused. On Back, the app needs to answer two questions. Which appearance opened Details? Did the host actually focus the view that now represents it?

- **Address the same appearance after a reorder.** Give the two cards distinct occurrence keys. Itar can reveal the requested occurrence and rejects a measurement or focus confirmation from an earlier mount. [Identity tests](../core/tests/identity.cpp) · [Reveal and remount tests](../core/tests/transaction_reveal.cpp)
- **Know when focus lands and cancel a move in flight.** `focusByKey` returns a request with `result` and `cancel()`. Host acceptance leaves it pending. An observed input-focus change on the matching target completes it as `applied`. A late host event can update observed focus while the cancelled request stays cancelled. Of the four systems compared below, Itar is the only one whose focus call reports whether native focus landed, and the only one that returns a cancellable request. [Outcome tests](../core/tests/transaction_outcome.cpp) · [Cancellation tests](../core/tests/transaction_cancel.cpp) · [React API tests](../scripts/react-api.test.cjs)
- **Keep remote focus and reader focus distinct.** A reader can activate a card independently of the remote’s input focus. An accessibility-focus event cannot complete a pending input-focus request. The browser adapter reports reader focus as unknown. [Core channel tests](../core/tests/transaction_outcome.cpp) · [DOM focus and activation tests](../packages/itar/web-runtime/tests/focus.test.cjs)
- **Run mounted navigation on the native host.** On Android, supported directional moves and card highlights run outside React’s JS thread. On tvOS, UIKit handles ordinary moves between mounted views. The web adapter runs the C++ policy as Wasm on the browser thread and observes DOM focus. [Android directional tests](../packages/itar/android/tests/support/OrderedFocusChecks.kt) · [Highlight tests](../packages/itar/android/tests/support/StyleChecks.kt) · [Who owns a move](guides/architecture.md#who-owns-a-move)
- **Reproduce a focus race on a laptop.** Feed the C++ core the same sequence of collection changes and host events and assert the resulting state without starting React or a TV simulator. [Transaction replay test](../core/tests/transaction_replay.cpp)

## Beta limits

- **Installation and browsers.** The `@bougarnem/itar@0.1.0-beta` npm package includes both `@bougarnem/itar/react` and `@bougarnem/itar/web`. The web entry includes Itar’s DOM adapter and compiled engine. The JS and Wasm builds target Chrome 85. Older engines are outside that target. [Install Itar](guides/integration.md) · [Web adapter](devices/web-tv.md) · [Wasm build](../packages/itar/web-runtime/engine/CMakeLists.txt)
- **Collection size.** Each provider supports one active collection, with fixed-size cells and up to two levels. Its 256 logical nodes include unmounted items and their scopes. Twelve rails of twenty cards use `1 + 12 + 240 = 253` nodes. A thirteenth full rail brings the total to 274. Size the active collection independently of the catalogue on your server. [Collection limits](guides/collections.md)
- **Return from Details.** Ordinary `focusByKey` works on Android, tvOS and the browser example. The dedicated `restoreFocusByKey` command is implemented on Android. Under TalkBack ownership its target must already be mounted, visible and eligible. Apple and the browser return `unavailable` for this command, so Cinema uses ordinary keyed focus once the rail is ready. [Cinema example](https://github.com/mbougarne/itar-cinema) · [Integration guide](guides/integration.md)
- **Device testing.** Cinema was tested on Chromecast HD with TalkBack. It passed on Fire TV with VoiceView, Apple TV HD with VoiceOver, Samsung Tizen with Voice Guide and LG webOS with Audio Guidance. The device guides list the flows exercised and the Chromecast scenarios to retest. [Device results](devices/README.md)

## Capability matrix

The native baseline is `react-native-tvos` 0.83.0-0. The BAM API column uses 5.2.0, the version used in the former comparison fixture. Its note about virtualized rows comes from the project’s newer `main` README of 23 October 2025.

| Capability | Itar | Plain React Native TV | Norigin Spatial Navigation | BAM React TV Space Navigation 5.2.0 |
| --- | --- | --- | --- | --- |
| Who chooses the next card? | Android host and C++ policy, UIKit for ordinary tvOS moves, C++/Wasm and DOM on web. | Android or UIKit. `TVFocusGuideView` supplies destinations, traps and remembered entry via `autoFocus`. [Focus guides][rn-guides] | JS spatial engine with layout adapters for the DOM and native TV views. `useFocusable` attaches to an existing host by ref. [Native integration][n-native] | A shared React navigation tree backed by LRUD on native TV and web. [Design][b-design] |
| How do I address a card? | `focusByKey(occurrenceKey)`, including an offscreen entry in a registered collection. | `hasTVPreferredFocus`, guide destinations or `requestTVFocus()` on a mounted ref. [Native types][rn-types] | `setFocus(focusKey)`, preset keys before mount and remembered children. [Focus service][n-set] · [Preset keys][n-preset] · [Child history][n-child] | Mounted node `ref.focus()` or virtual list `focus(index)`. The app maps a saved ID to its current index. [Node][b-node] · [List][b-list] |
| What confirms a request? | A per-request result gives `applied`, `unavailable`, `cancelled` or `unsupported` with a reason. [Request types](../packages/itar/src/api/types.ts) | `onFocus` and `onBlur` report native view events. The app correlates them with its request. [Native events][rn-events] | `setFocus` returns `Promise<void>`. It updates logical focus and asks the native host to focus the view. The promise carries no host-confirmed outcome. [Focus service][n-set] · [Native dispatch][n-dispatch] | Both focus methods return `void`. The tree exposes logical focus state. [Node ref type][b-ref] · [List][b-list] |
| Can the caller cancel that request? | Yes, through the returned request’s `cancel()`. | No per-request handle. | No per-request handle. | No per-request handle. |
| Virtualized catalogues | Fixed-extent lists and rails, offscreen reveal by key, 256 logical nodes per active collection. | TV-optimized `VirtualizedList` and focus guides. [List handling][rn-guides] | App-managed windowing and registration. [Performance guide][n-virtual] | Lists and grids, variable item sizes and start-aligned scrolling. Upstream flags a problem with hundreds of virtualized **rows**. [List options][b-options] · [Known limits][b-limits] |
| Screen readers | Separate input and accessibility observations. Device-specific coverage above. | Platform accessibility APIs plus native focus events. [TV accessibility][rn-a11y] | Accessibility labels and an optional speech callback. [Accessibility guide][n-a11y] | Experimental Android TalkBack integration. With reader focus on a card, Enter gives it logical focus. A second Enter selects it. [Reader controls][b-reader] |
| Targets and evidence | Cinema exercised on five physical TV devices with their built-in readers, and on desktop Chromium. | Native Android TV and Apple TV. [Platforms][rn-platforms] | Upstream reports production use on Tizen and webOS and lists Android TV and Apple TV support. [Platforms][n-devices] | Upstream lists Android TV, tvOS and web TV. [Platforms][b-design] |
| Distribution | Public npm beta with native and web entry points. | Published `react-native-tvos` package. | Published core, React and React Native TV packages. Plain JavaScript, with no Wasm requirement and no stated Chrome minimum. [Device matrix][n-devices] | Published `react-tv-space-navigation` package. |

## Choosing a starting point

- **Itar** suits a native TV catalogue whose rails refresh or reorder, where the app must return to an exact card, know whether focus landed and cancel a move the viewer abandoned. Check the beta limits above against your screens first.
- **Plain React Native TV** suits screens where the platform focus engine and focus guides already put the viewer in the right place, and the app has no need to track individual focus requests.
- **Norigin Spatial Navigation** suits a React web app headed for smart TVs, or a team that wants one JavaScript focus engine with reported production use on Tizen and webOS.
- **BAM React TV Space Navigation** suits a team that wants one declarative React navigation tree shared by native TV and web, from a published package.

## Trying Itar on one screen

Start with a rail whose remote behavior you know. Each card needs a stable occurrence key that includes the rail identity, so a title that appears twice gets two keys.

| What the screen uses today | What it becomes in Itar |
| --- | --- |
| Plain React Native TV: a ref and `requestTVFocus()`, with `onFocus` to learn what happened | `focusByKey(occurrenceKey)` and the request’s `result` |
| Norigin: `focusKey` and `setFocus(focusKey)` | The same key as an occurrence key, and `focusByKey` |
| BAM: a saved ID mapped to its current index for `focus(index)` | `focusByKey(occurrenceKey)`, with no index lookup |

Wrap the screen in a `FocusProvider`. For a mounted rail, use a `FocusScope` with `layout="row"` and put each card’s label, activation and focus style on its outer `Focusable`. For windowed rails, use `FocusVirtualizedRails`, which creates the focusable hosts for its items. [Integration walkthrough](guides/integration.md) · [Cinema examples](ott-app.md)

The return from Details shows the difference. With Norigin, the app checks that the opener is registered and awaits a promise that carries no host-confirmed outcome:

```tsx
if (doesFocusableExist(openerKey)) {
  await setFocus(openerKey);
}
```

With Itar, the same return reports what happened and can be withdrawn:

```tsx
const {focusByKey} = useFocusCommands();
const pending = useRef<ReturnType<typeof focusByKey> | null>(null);

// Call this when the rail reports onReady after Back.
async function returnToOpener(openerKey: string) {
  const request = focusByKey(openerKey);
  pending.current = request;
  const outcome = await request.result;
  if (outcome.status === 'unavailable') {
    // The opener left the catalogue. Choose where the viewer goes.
    focusByKey(occurrenceKey('home', 'featured', 'featured-a'));
  }
}

// If the viewer leaves before the request settles:
pending.current?.cancel();
```

Then test it. Open Details, reorder the rail and press Back. Compare the saved occurrence with the card that receives focus and the title Select opens. Repeat after removing the opener, and after navigating away during a delayed reveal. In each case the outcome tells the app what the host did, so the app does not have to infer it from focus events. If the screen comes from Norigin, its visual debugger shows which candidates the old implementation considered on each arrow press. [Collection example](guides/collections.md) · [Cinema example](https://github.com/mbougarne/itar-cinema) · [Norigin debugger][n-debug]

## Measuring responsiveness

The previous native validation fixture was a bounded comparison. The project has not published comparative latency or memory measurements. [Standalone Cinema](https://github.com/mbougarne/itar-cinema) uses the published Itar package.

Upstream sources checked on 18 November 2026. The links point to the reviewed revisions.

[n-devices]: https://github.com/NoriginMedia/Norigin-Spatial-Navigation/blob/fa336cd33017de32a62b58549e0e8d91ffe4cbcb/README.md#L12-L34
[n-native]: https://github.com/NoriginMedia/Norigin-Spatial-Navigation/blob/fa336cd33017de32a62b58549e0e8d91ffe4cbcb/docs/guides/react-native-tv.md#L40-L51
[n-set]: https://github.com/NoriginMedia/Norigin-Spatial-Navigation/blob/fa336cd33017de32a62b58549e0e8d91ffe4cbcb/docs/guides/programmatic-focus.md#L9-L29
[n-dispatch]: https://github.com/NoriginMedia/Norigin-Spatial-Navigation/blob/fa336cd33017de32a62b58549e0e8d91ffe4cbcb/packages/react-native-tvos/src/adapter.ts#L213-L234
[n-preset]: https://github.com/NoriginMedia/Norigin-Spatial-Navigation/blob/fa336cd33017de32a62b58549e0e8d91ffe4cbcb/docs/api-reference/SpatialNavigation.md#L66
[n-child]: https://github.com/NoriginMedia/Norigin-Spatial-Navigation/blob/fa336cd33017de32a62b58549e0e8d91ffe4cbcb/docs/guides/focus-hierarchy.md#L59-L81
[n-virtual]: https://github.com/NoriginMedia/Norigin-Spatial-Navigation/blob/fa336cd33017de32a62b58549e0e8d91ffe4cbcb/docs/guides/performance.md#L150-L155
[n-a11y]: https://github.com/NoriginMedia/Norigin-Spatial-Navigation/blob/fa336cd33017de32a62b58549e0e8d91ffe4cbcb/docs/guides/accessibility-labels.md#L5-L18
[n-debug]: https://github.com/NoriginMedia/Norigin-Spatial-Navigation/blob/fa336cd33017de32a62b58549e0e8d91ffe4cbcb/docs/guides/distance-calculation.md#L146-L158
[b-ref]: https://github.com/bamlab/react-tv-space-navigation/blob/a9cadbcebf5940864a81c094f427a18feef28ca5/packages/lib/src/spatial-navigation/types/SpatialNavigationNodeRef.ts#L1-L3
[b-design]: https://github.com/bamlab/react-tv-space-navigation/blob/a9cadbcebf5940864a81c094f427a18feef28ca5/README.md#L18-L34
[b-node]: https://github.com/bamlab/react-tv-space-navigation/blob/a9cadbcebf5940864a81c094f427a18feef28ca5/docs/api.md#L64-L69
[b-list]: https://github.com/bamlab/react-tv-space-navigation/blob/a9cadbcebf5940864a81c094f427a18feef28ca5/docs/api.md#L258-L263
[b-options]: https://github.com/bamlab/react-tv-space-navigation/blob/a9cadbcebf5940864a81c094f427a18feef28ca5/docs/api.md#L239-L252
[b-reader]: https://github.com/bamlab/react-tv-space-navigation/blob/a9cadbcebf5940864a81c094f427a18feef28ca5/docs/api.md#L480-L489
[b-limits]: https://github.com/bamlab/react-tv-space-navigation/blob/7e31e426b09d7c23d458adb963ef4bc9fe8eff60/README.md#L83-L87
[rn-guides]: https://github.com/react-native-tvos/react-native-tvos/blob/e7022f2672cb2fdbf7b2e7ec86ba130f2d229fd9/README.md#L288-L309
[rn-types]: https://github.com/react-native-tvos/react-native-tvos/blob/e7022f2672cb2fdbf7b2e7ec86ba130f2d229fd9/packages/react-native/types/public/ReactNativeTVTypes.d.ts#L38-L92
[rn-events]: https://github.com/react-native-tvos/react-native-tvos/blob/e7022f2672cb2fdbf7b2e7ec86ba130f2d229fd9/README.md#L187-L199
[rn-a11y]: https://github.com/react-native-tvos/react-native-tvos/blob/e7022f2672cb2fdbf7b2e7ec86ba130f2d229fd9/README.md#L286
[rn-platforms]: https://github.com/react-native-tvos/react-native-tvos/blob/e7022f2672cb2fdbf7b2e7ec86ba130f2d229fd9/README.md
