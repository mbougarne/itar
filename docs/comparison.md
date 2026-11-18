# Comparing TV focus systems

[العربية](ar/comparison.md) · [Documentation](README.md)

## What Itar adds

Itar gives React Native TV apps and compatible TV browsers the same way to address a card, request focus and observe the result.

Suppose a viewer opens a film from *Watch again*. The same film appears in *Featured*. While Details is open, *Watch again* changes order and its old card view is reused. On Back, the app needs to answer two questions. Which appearance opened Details? Did the host actually focus the view that now represents it?

- **Address the same appearance after a reorder.** Give the two cards distinct occurrence keys. Itar can reveal the requested occurrence and rejects a measurement or focus confirmation from an earlier mount. [Identity tests](../core/tests/identity.cpp) · [Reveal and remount tests](../core/tests/transaction_reveal.cpp)
- **Know when focus lands and cancel a move in flight.** `focusByKey` returns a request with `result` and `cancel()`. Host acceptance leaves it pending. An observed input-focus change on the matching target completes it as `applied`. A late host event can update observed focus while the cancelled request stays cancelled. Of the four public APIs below, Itar alone exposes this combination in one request. [Outcome tests](../core/tests/transaction_outcome.cpp) · [Cancellation tests](../core/tests/transaction_cancel.cpp) · [React API tests](../scripts/react-api.test.cjs)
- **Keep remote focus and reader focus distinct.** A reader can activate a card independently of the remote’s input focus. An accessibility-focus event cannot complete a pending input-focus request. The browser adapter reports reader focus as unknown. [Core channel tests](../core/tests/transaction_outcome.cpp) · [DOM focus and activation tests](../apps/probe/web/tests/focus.test.cjs)
- **Run mounted navigation on the native host.** On Android, supported directional moves and card highlights run outside React’s JS thread. On tvOS, UIKit handles ordinary moves between mounted views. Revealing a new React cell can still require JS. The web adapter runs the C++ policy as Wasm on the browser thread and observes DOM focus. The project has no published device latency comparison. [Android directional tests](../packages/itar/android/tests/support/OrderedFocusChecks.kt) · [Highlight tests](../packages/itar/android/tests/support/StyleChecks.kt) · [Who owns a move](guides/architecture.md#who-owns-a-move)
- **Reproduce a focus race on a laptop.** Feed the C++ core the same sequence of collection changes and host events and assert the resulting state without starting React or a TV simulator. [Transaction replay test](../core/tests/transaction_replay.cpp)

## Beta limits

- **Installation and browsers.** The native npm package is marked private at `0.0.0` and ships from source. You can pack it locally. Cinema shares screens across native TV and web through a DOM/Wasm adapter in the example. A second web app must integrate that adapter itself. The JS and Wasm builds target Chrome 85. Older engines are outside that target. Norigin’s JavaScript approach avoids the Wasm requirement and its published device matrix gives no numerical Chrome minimum. [Install Itar](guides/integration.md) · [Web adapter](devices/web-tv.md) · [Wasm build](../apps/probe/web/engine/CMakeLists.txt) · [Norigin device matrix][n-devices]
- **Collection size.** Each provider supports one active collection, with fixed-size cells and up to two levels. Its 256 logical nodes include unmounted items and their scopes. Twelve rails of twenty cards use `1 + 12 + 240 = 253` nodes. A thirteenth full rail brings the total to 274. Size the active collection independently of the catalogue on your server. [Collection limits](guides/collections.md)
- **Return from Details.** Ordinary `focusByKey` works on Android, tvOS and the browser example. The dedicated `restoreFocusByKey` command is implemented on Android. Under TalkBack ownership its target must already be mounted, visible and eligible. Apple and the browser return `unavailable` for this command, so Cinema uses ordinary keyed focus once the rail is ready. [Route handling](../apps/probe/ott/src/Cinema.tsx) · [Integration guide](guides/integration.md)
- **Device testing.** Testing on Chromecast HD found TalkBack focus jumps during downward navigation and loading. Cinema has run on Apple TV HD, with physical VoiceOver checks outstanding. Chromium has exercised the browser adapter. Tizen and webOS builds produce staging directories and still need tests on TVs. [Device results](devices/README.md)

## Capability matrix

The native baseline is `react-native-tvos` 0.83.0-0. The BAM API column uses 5.2.0, the version in Cinema’s comparison screen.

| Capability | Itar | Plain React Native TV | Norigin Spatial Navigation | BAM React TV Space Navigation 5.2.0 |
| --- | --- | --- | --- | --- |
| Who chooses the next card? | Android host and C++ policy, UIKit for ordinary tvOS moves, C++/Wasm and DOM on web. | Android or UIKit. `TVFocusGuideView` supplies destinations, traps and remembered entry via `autoFocus`. [Focus guides][rn-guides] | JS spatial engine with layout adapters for the DOM and native TV views. `useFocusable` attaches to an existing host by ref. [Native integration][n-native] | A shared React navigation tree backed by LRUD on native TV and web. [Design][b-design] |
| How do I address a card? | `focusByKey(occurrenceKey)`, including an offscreen entry in a registered collection. | `hasTVPreferredFocus`, guide destinations or `requestTVFocus()` on a mounted ref. [Native types][rn-types] | `setFocus(focusKey)`, preset keys before mount and remembered children. [Focus service][n-set] · [Preset keys][n-preset] · [Child history][n-child] | Mounted node `ref.focus()` or virtual list `focus(index)`. The app maps a saved ID to its current index. [Node][b-node] · [List][b-list] |
| What confirms a request? | A per-request result gives `applied`, `unavailable`, `cancelled` or `unsupported` with a reason. [Request types](../packages/itar/src/api/types.ts) | `onFocus` and `onBlur` report native view events. The app correlates them with its request. [Native events][rn-events] | `setFocus` returns `Promise<void>`. It updates logical focus and asks the native host to focus the view. The promise carries no host-confirmed outcome. [Focus service][n-set] · [Native dispatch][n-dispatch] | Both focus methods return `void`. The tree exposes logical focus state. [Node ref type][b-ref] · [List][b-list] |
| Can the caller cancel that request? | Yes, through the returned request’s `cancel()`. | No per-request handle. | No per-request handle. | No per-request handle. |
| Virtualized catalogues | Fixed-extent lists and rails, offscreen reveal by key, 256 logical nodes per active collection. | TV-optimized `VirtualizedList` and focus guides. [List handling][rn-guides] | App-managed windowing and registration. [Performance guide][n-virtual] | Lists and grids, variable item sizes and start-aligned scrolling. Upstream flags a problem with hundreds of virtualized **rows**. [List options][b-options] · [Known limits][b-limits] |
| Screen readers | Separate input and accessibility observations. Device-specific coverage above. | Platform accessibility APIs plus native focus events. [TV accessibility][rn-a11y] | Accessibility labels and an optional speech callback. [Accessibility guide][n-a11y] | Experimental Android TalkBack integration. With reader focus on a card, Enter gives it logical focus. A second Enter selects it. [Reader controls][b-reader] |
| Targets and evidence | Chromecast HD, Apple TV HD and Chromium exercised. Tizen and webOS staging. | Native Android TV and Apple TV. [Platforms][rn-platforms] | Upstream reports production use on Tizen and webOS and lists Android TV and Apple TV support. [Platforms][n-devices] | Upstream lists Android TV, tvOS and web TV. [Platforms][b-design] |
| Distribution | Local source package. The web adapter lives in Cinema. | Published `react-native-tvos` package. | Published core, React and React Native TV packages. | Published `react-tv-space-navigation` package. |

## Migrating one screen from Norigin

Start with a rail whose remote behavior you know. Norigin’s visual debugger can show which candidates the current app considers on each arrow press. [Norigin debugger][n-debug]

Map its existing `focusKey` values to stable occurrence keys, including the rail identity if a title can appear twice. Wrap the screen in a `FocusProvider`. For a mounted rail, use a `FocusScope` with `layout="row"` and put each card’s label, activation and focus style on its outer `Focusable`. For windowed rails, use `FocusVirtualizedRails`, which creates the focusable hosts for its items. Norigin’s hook lets you keep your existing host. [Integration walkthrough](guides/integration.md) · [Cinema examples](ott-app.md)

Open Details, reorder the rail, and press Back. Compare the saved occurrence with the card that receives focus and the title Select opens. Repeat after removing the opener, and after navigating away during a delayed reveal. These cases show whether a confirmed result and cancellation simplify the code your app already owns. [Collection example](guides/collections.md) · [Route implementation](../apps/probe/ott/src/Cinema.tsx)

## Measuring responsiveness

Cinema’s native validation screen offers eight mounted targets in three modes. The native baseline uses platform controls. Itar uses its own focusable hosts. The BAM fixture keeps native focus on one trapped anchor and draws a JS highlight for the logical target. Under React 19 the optional BAM module can fail to load and show a placeholder. Skip that run. Norigin has no mode in this screen. The fixture can occupy JS briefly to exercise the mounted path. A latency or memory ranking would require comparable device measurements. [Validation screen](../apps/probe/ValidationScreen.tsx) · [BAM fixture](../apps/probe/ComparisonLibrary.tsx)

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
