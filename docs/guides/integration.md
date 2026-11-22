# Add Itar to a React Native TV app

[العربية](../ar/guides/integration.md)

Use `itar/react` for focus scopes, buttons, commands, and fixed-size lists. This beta is distributed as source. The repository includes a working TV app you can modify and a local tarball workflow for trying the package in your own app. The pinned combination is React 19.2.0 and the TV fork installed as `"react-native": "npm:react-native-tvos@0.83.0-0"`. The native components use Fabric. Browser apps use `itar/web`. [TV app setup](../ott-app.md) · [Browser demo](../devices/web-tv.md)

## Install from your checkout

Use Node 22.23.4 and npm 10.9.9. From the Itar repository root, install the lockfile and build a tarball. The pack step compiles declarations and JavaScript, then copies the C++ source, headers and license needed by a separate consumer.

To pack from source, first install [Emscripten 6.0.13 and CMake](../devices/web-tv.md#desktop-browser). The pack step builds the web engine. Apps installing the resulting tarball receive the compiled bytes.

```sh
npm ci --ignore-scripts --no-audit
mkdir -p build/packages
npm pack --workspace itar --pack-destination build/packages
```

In your TV app, install the path to that file. A fresh native build is required because Itar adds native views, codegen and a C++ library. To run the repository demo instead, its workspace dependency is already wired after `npm ci`.

```sh
npm install /absolute/path/to/itar/build/packages/itar-0.1.0-beta.tgz
```

- **Android TV.** Use the TV template's native-module autolinking. The library declares Android SDK 36, minimum API 24, NDK 27.1.12297006 and CMake 3.22.1. Use JDK 17 for the example build. Rebuild the Android application after installation. [Android library build](../../packages/itar/android/build.gradle)
- **tvOS.** In your TV target in `ios/Podfile`, add the line below. The package-named podspec lets React Native autolink `ItarEngineNative`. The explicit local dependency resolves its C++ core from the same tarball. Install pods from `ios/` with `bundle exec pod install` and build the TV scheme in the resulting workspace. The podspec declares a tvOS 15.1 deployment target. On the SDK 27 / Apple Clang 21 combination, the sample also adapts the TV template’s scene lifecycle and fmt dependency. [TV shell generator](../../scripts/generate-probe.cjs) · [Apple integration](../../packages/itar/apple/README.md)

```ruby
pod 'ItarEngineCore', :path => '../node_modules/itar'
```

To verify the package archive independently, run `node scripts/check-package.cjs build/package-check` from the repository root. It installs its tarball outside npm's workspace resolution, verifies the exports and compiles a small C++/Apple C facade consumer. Native interaction needs a TV build. [Package verification](../../scripts/check-package.cjs) · [Device testing](../devices/README.md)

## Use Itar in a web TV app

Import the browser components from `itar/web` in web apps, including Samsung Tizen and LG webOS apps. Install React and React DOM 19.2.0 plus `react-native-web@0.21.4`. Import `itar/web.css` and await `initializeFocusEngine()` before rendering the first provider. The web entry embeds the compiled Wasm and works with local TV app URLs.

```tsx
import {createRoot} from 'react-dom/client';
import {FocusProvider, FocusScope, Focusable, initializeFocusEngine} from 'itar/web';
import 'itar/web.css';

initializeFocusEngine().then(() => {
  createRoot(document.getElementById('root')!).render(
    <FocusProvider>
      <FocusScope id="actions" layout="row" style={{flexDirection: 'row'}}>
        <Focusable occurrenceKey="play" accessibilityLabel="Play" style={{width: 160, height: 80}} />
        <Focusable occurrenceKey="save" accessibilityLabel="Save" style={{width: 160, height: 80}} />
      </FocusScope>
    </FocusProvider>,
  );
});
```

## Make a screen with two buttons

Put this component in the TV app's `App.tsx`. Use Left and Right to move, then Select to activate a title. The row scope declares navigation order. Its React Native style also lays out the children horizontally. The native focus style highlights the actual host target. The status text changes only when a button is activated.

```tsx
import React, {useState} from 'react';
import {Text} from 'react-native';
import {Focusable, FocusProvider, FocusScope, occurrenceKey} from 'itar/react';

const titles = [
  {entry: 'featured-a', movie: 'film-7', title: 'Paper Moon'},
  {entry: 'featured-b', movie: 'film-9', title: 'Night Train'},
];

export default function App() {
  const [selected, setSelected] = useState('Choose a title');

  return (
    <FocusProvider style={{flex: 1, backgroundColor: '#fff'}}>
      <FocusScope id="featured" layout="row" style={{flexDirection: 'row'}}>
        {titles.map((item, order) => (
          <Focusable
            key={item.entry}
            occurrenceKey={occurrenceKey('home', 'featured', item.entry)}
            contentId={item.movie}
            accessibilityLabel={item.title}
            order={order}
            style={{width: 220, height: 88}}
            focusStyle={{accentColor: '#006699'}}
            onPress={() => setSelected(item.title)}
          />
        ))}
      </FocusScope>
      <Text style={{color: '#111'}}>{selected}</Text>
    </FocusProvider>
  );
}
```

Give every occurrence a stable key unique within its provider. If *Paper Moon* appears in Featured and Continue Watching, both cards may carry `contentId="film-7"`. Their occurrence keys must distinguish those placements. Two appearances in the same rail also need distinct entry IDs. Use the same key when items move within the data. Array indices would attach history to the wrong title after a reorder.

A provider owns one native surface. Each scope's `id` is local to its parent. A nested scope can use `boundary="parent"` to allow navigation beyond its edge. Other choices are `stop` (default) and `wrap`. Set `trap` on a scope that should contain managed direction input. UIKit retains substantial authority over mounted navigation and gestures. Confirm layout and edge behavior on each target. [Platform boundaries](architecture.md#who-owns-a-move)

## Observe or request focus

Call hooks inside a child of `FocusProvider`. For routine highlights, use `focusStyle` so native feedback can run during a busy JS frame. Use a subscription when application UI needs the observed occurrence.

| API | Use it for |
| --- | --- |
| `useFocusReady()` | The active, connected native surface can receive a command. A list may still be publishing its data. |
| `useFocusState('input')` | The surface's last input observation. The kind is `managed`, `unmanaged`, `absent` or `unknown`. Only a managed target has an occurrence key. |
| `useIsFocused(key, channel?)` | A small piece of UI that depends on one occurrence. The channel defaults to input. |
| `useFocusState('accessibility')` | Inspect a separately observed accessibility focus change. Coverage depends on the host. |
| `useScreenReaderEnabled()` | Adapt app features such as autoplay. The value is `null` while the reader state is unknown. |
| `useFocusCommands()` | Request a key, restore a scope, or open/dismiss the built-in native dialog fixture. |

For example, add this control after the two titles inside the same row scope. It reports the terminal result of a user-initiated command. The request object has a `cancel()` method for a caller that leaves the route before completion. A native focus operation that was already issued can still produce a later real observation.

```tsx
import React, {useState} from 'react';
import {Text} from 'react-native';
import {Focusable, occurrenceKey, useFocusCommands, useFocusReady} from 'itar/react';

export function FocusFirstTitle() {
  const {focusByKey} = useFocusCommands();
  const ready = useFocusReady();
  const [status, setStatus] = useState('');

  async function move() {
    const request = focusByKey(occurrenceKey('home', 'featured', 'featured-a'));
    const outcome = await request.result;
    setStatus(outcome.status + ' (' + outcome.reason + ')');
  }

  return (
    <>
      <Focusable
        occurrenceKey={occurrenceKey('home', 'featured', 'shortcut')}
        accessibilityLabel="Focus first title"
        enabled={ready}
        order={2}
        style={{width: 200, height: 88}}
        onPress={move}
      />
      <Text>{status}</Text>
    </>
  );
}
```

The promise resolves to `applied` after confirmed native focus, `cancelled` for a cancelled request, `unavailable` when the operation cannot complete, or `unsupported` for an unsupported runtime or transport. Check `outcome.reason` for details. A request does not activate the target. Activation arrives on `onPress` with the occurrence key, optional content ID and source. This matters for readers, which can activate a semantic target independently of input focus.

On Android, a mounted target can be scrolled into view before it receives D-pad focus. Place the native scroll view inside its owning `FocusScope` and match the axis, using `layout="row"` for horizontal scrolling or `layout="column"` for vertical scrolling. For nested viewports, the adapter starts at the nearest scroll view shared by the focused and destination targets, then reveals the destination from the outside in. The destination must fit fully inside each applicable viewport. This path runs while the app owns directional input. For unmounted items use the [collection integration](collections.md).

## Route changes and accessibility

- **Returning to a menu.** Use `restoreOnEntry` for remembered directional entry to a scope. To restore explicitly, commit its active state first, then request `restoreScope(['home', 'menu'])` with the actual nested scope IDs. The engine tries valid scope history and then the declared entry policy, including `preferredKey`. Unmounting the scope discards its history.
- **Returning from details.** Save `activation.occurrenceKey` when opening details. Once the previous route is active and the rail reports `onReady`, the Android adapter can use `restoreFocusByKey(savedKey)` for the opener. Under reader ownership, Android limits this to an already mounted, visible and eligible target. Keyed restoration concerns input focus. Apple and the browser probe currently return unavailable for that specific command.
- **Replacing a focused route.** Commit `entryReady={false}` on the destination scope *before* removing the source. This gates automatic entry while the app prepares content. Issue explicit focus once the intended target is ready, then reopen entry after the request settles, including cancellation or failure. Retain the old scope/viewport when return history matters. [Example route handling](../../apps/probe/ott/src/Cinema.tsx)
- **Custom cards.** Give the outer `Focusable` an explicit size and an accessible label. Supply images and text as presentation-only children. The owned host handles semantics, native focus feedback and activation. Put independent controls beside it.
- **Switches and sliders.** For an Android or web-probe switch use `accessibilityRole="switch"` and `accessibilityState={{checked: value}}`. Apple checked semantics remain outside this contract. For an adjustable target, use `onAdjust(delta)` with no explicit role. The app applies bounds and changes the value for `-1` or `1`. Keep `onPress` for Select. [Adjustable timeline in Cinema](../../apps/probe/ott/src/Playback.tsx)

For a scrollable catalogue, continue with [fixed-size lists and rails](collections.md). For the full mounted component and event contracts, see the [package reference](../../packages/itar/README.md).

## Exercise the behavior in Itar Cinema

In a **native development build**, open **Settings → Open original Itar probes**. The menu keeps each experiment small enough to repeat on a remote.

| Screen | Try this |
| --- | --- |
| **React API preview** | Focus a title in rail B, press Select and note the reported occurrence. Open the Details route and return home. Observe where focus lands and which command outcome is reported. |
| **Virtualized list preview** | Choose **Focus start**, then **Reveal distant item**. Repeat with **Cancel delayed reveal**. In **Nested rails**, change the row-entry setting and compare the selected column after moving between rows. |
| **Release validation** | Select the native, library or Itar implementation of the same eight mounted targets. Schedule a bounded JavaScript stall and move with the remote. Native observation or instrumentation is needed to time visible feedback while JS is busy. |

The **Return to Itar Cinema** button leaves the diagnostic screens. Where physical behavior differs, include the device model, OS, app revision, input device, reader state and exact sequence in a report. [Development probe screens](../../apps/probe/ProbeApp.tsx) · [Device guide](../devices/README.md)
