# Itar for native and web TV apps

[العربية](README.ar.md) · [Integration guide and first screen](../../docs/guides/integration.md)

Import the components and hooks below from `itar/react`. The source beta uses React 19.2.0, `react-native-tvos@0.83.0-0` and Fabric. To install in another app, run `npm pack --workspace itar` from a prepared checkout and install the resulting tarball into the TV app. Build the native app after installation. See the [Apple pod setup](apple/README.md) for tvOS.

Import the browser components from `itar/web` in web apps, including Samsung Tizen and LG webOS apps. Install React and React DOM 19.2.0 plus `react-native-web@0.21.4`. Import `itar/web.css` and await `initializeFocusEngine()` before rendering the first provider. The web entry embeds the compiled Wasm and works with local TV app URLs.

## Declare focus

To migrate a card built with React Native’s `Pressable`, replace its outer `Pressable` with `Focusable`. Keep the artwork and text as children, and put `onPress` and the accessible label on `Focusable`. Props such as `focusable` and `hasTVPreferredFocus` on a plain React Native view belong to the platform focus system. Itar registers a card when its own host mounts. In an Itar virtualized list, the list creates that host for each item and calls `renderItem` for its visual content.

| Component or prop | Contract |
| --- | --- |
| `FocusProvider` | Owns a native surface and its command and observation channels. Put scopes, focusable targets and hooks inside it. |
| `FocusScope` | Groups related targets under a stable local `id`. `layout` accepts `row`, `column` or `spatial`. `boundary` accepts `stop`, `wrap` or `parent`. Use React Native layout styles to arrange the views. |
| `active`, `entryReady`, `preferredKey`, `restoreOnEntry` | Deactivate a covered scope, gate automatic entry while content is preparing, name an entry target or use scope history on directional return. Keeping the scope mounted preserves its native history. |
| `Focusable` | A single owned host. Supply a stable `occurrenceKey`, an `accessibilityLabel`, and layout dimensions. Use `order` for logical ordering and `enabled` for eligibility. Give two placements of the same `contentId` distinct occurrence keys. |
| `children`, `displayLabel`, `focusStyle` | Put images and labels inside the host as presentation. Keep pressable children and nested scopes outside it. With no custom content the host renders its label. Native feedback follows observed input focus. |
| `onPress`, `onAdjust` | Activation includes the occurrence, optional content ID, source, mount, lifetime and sequence. For adjustable controls the app applies bounds and the `-1` or `1` delta. |
| `accessibilityRole`, `accessibilityState` | Android and the browser demo expose a switch when supplied with `"switch"` and a Boolean `checked`. An adjustable control uses its native role. The Apple host has no equivalent checked-state mapping in this beta. |

## Observe and request focus

Set `preferredKey={cardKey}` on `FocusScope` to declare a preferred target for scope entry. To move focus to that card after an action, call `focusByKey(cardKey)` from `useFocusCommands()` once the destination is ready.

`useFocusReady()` reports surface readiness. `useIsFocused(key, channel?)` subscribes to one occurrence. `useFocusState(channel?)` returns the current observation, including its kind and managed occurrence. Specify `'accessibility'` for the reader channel. `useScreenReaderEnabled()` can initially return `null`.

`useFocusCommands()` provides `focusByKey(key)`, `restoreScope(path)`, `restoreFocusByKey(key)` and the built-in native dialog controls. Focus requests expose a command ID, `cancel()` and a `result` promise. Inspect the returned `status` and `reason`. The terminal statuses are `applied`, `cancelled`, `unavailable` and `unsupported`. A host observation confirms application. Cancelling a command revokes further work, but a call already dispatched can still change real focus.

Save the activated occurrence before opening Details. After returning, wait for the previous scope and collection to be ready. Android supports `restoreFocusByKey` for the saved occurrence. Under reader ownership the target must already be mounted, visible and eligible. UIKit and the browser demo return `unavailable` for this specific command. Readers own accessibility focus and speech.

For virtualized lists and nested rails, use the [collection reference](virtualization.md). For examples of subscriptions, route handoff, cancellation and custom cards, use the [integration guide](../../docs/guides/integration.md).
