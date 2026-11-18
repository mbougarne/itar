# Run and explore Itar Cinema

[العربية](ar/ott-app.md)

Cinema is the example app in [apps/probe](../apps/probe/). It uses the same public components you would import in a TV app. Use it to follow focus from a sidebar into a catalogue, move to a cell that has not mounted yet, open Details and return to the card that opened it.

## Start the app

| Runtime | Entry point |
| --- | --- |
| Desktop browser | Follow the [web build instructions](devices/web-tv.md#desktop-browser). Run `npm run web` and open `http://127.0.0.1:8080`. |
| Android TV / Google TV / Fire OS | Generate the native shell, start Metro, then build for the selected Android target. [Android guide](devices/android-tv.md) |
| tvOS | Generate the native shell, install pods, then launch the tvOS scheme on the selected simulator or paired TV. [Apple TV guide](devices/apple-tv.md) |
| Samsung Tizen / LG webOS | Build the platform-specific staging directory, then package and install through that TV's SDK. [Web TV guide](devices/web-tv.md) |

On the welcome screen, choose **Sign in**, submit the demo form and select **Explorer** or **Stargazer**. The form works with empty fields. There is no account service. On the web, a local record remembers the profile, demo sign-in and catalogue source across reloads. Sign out to clear it.

A new browser session starts with offline fixtures. Native builds initially look for a local metadata proxy. To run on a TV without a backend, open **Settings → Content source → Catalogue** and select **Offline fixtures**. Settings also offers a slow request and a forced failure for testing focus while content changes. For mock or live metadata through the proxy, use the [catalogue proxy guide](tmdb-proxy.md). Every title's Play action opens a credited sample film. [Demo playback](#demo-playback)

## Follow a focus interaction

| Try this | What to observe | Implementation |
| --- | --- | --- |
| On Home, move right several cards in **Popular stories**, then press Down. In **Worth exploring**, move right to the end, then left to the first card and press Left again. | Down enters the first eligible card (`rowEntry="first"`). As you move horizontally, the focused card lines up with the leading edge until the row runs out of space to scroll (`horizontalAlignment="leading"`). Left from the first card opens the sidebar. | [Browse](../apps/probe/ott/src/Browse.tsx) · [collection options](guides/collections.md) |
| Open a nonfirst card, then return from Details. | Compare the final highlighted occurrence and scroll position with the card you activated. A repeated movie in another rail gives this check a useful control. | [Cinema route state](../apps/probe/ott/src/Cinema.tsx) · [Details](../apps/probe/ott/src/Details.tsx) |
| Search with the on-screen keyboard, clear the last character and move again. | Observe the new target when the selected action becomes unavailable. On web, repeat using Tab and a pointer. | [Search](../apps/probe/ott/src/Search.tsx) |
| Open Settings and change the focus accent. Enable slow requests and queue a failure, then browse again. | Follow focus through loading, error, Retry and successful publication. Compare observations with the reader on and off. | [Settings](../apps/probe/ott/src/Settings.tsx) · [catalogue session](../apps/probe/ott/src/session.ts) |

On native development builds, **Settings → Open original Itar probes** opens the smaller adapter, React API, virtualization and release-validation screens. Use those when a two-row reproduction is easier to diagnose than a full Cinema route. **Return to Itar Cinema** remounts the showcase. [Probe entry](../apps/probe/ProbeApp.tsx)

## Demo playback

Every **Play demo** action opens *Big Buck Bunny* by the Blender Foundation, licensed under CC BY 3.0. Native builds stream a 480p HLS sample hosted by Mux. The web player uses the 2160p H.264 MP4 on the GARR Kodi mirror. The film is streamed separately from the catalogue and requires a network connection even with offline titles. Select a card, enter the player, adjust the timeline, and press Back to exercise focus restoration. [Film credits](https://peach.blender.org/about/) · [License](https://creativecommons.org/licenses/by/3.0/) · [Native player](../apps/probe/ott/src/Playback.tsx) · [Browser player](../apps/probe/ott/src/Player.web.tsx)

## Work on the example

- The [app entry](../apps/probe/App.tsx) selects Cinema or the development probes. The [Cinema entry](../apps/probe/ott/App.tsx) provides the design theme. Shared route state lives in [Cinema](../apps/probe/ott/src/Cinema.tsx).
- Screens and the sidebar live under [ott/src](../apps/probe/ott/src/). Shared controls live in [components](../apps/probe/ott/src/components/). Artwork, shared data types, catalogue sessions, styles and viewport calculations have separate modules.
- The [web media player](../apps/probe/ott/src/Player.web.tsx) sits beside the [native player](../apps/probe/ott/src/Player.tsx). The [browser adapter](../apps/probe/web/) resolves `itar/react` to the app's DOM host. Native builds use the package's Fabric components.
- Run `npm run check:tv` to check lint and formatting, `npm run typecheck` for native TypeScript and `npm run typecheck:web` for the browser entry. From a fresh checkout run `npm run build` before `npm test`. [Contributing](../CONTRIBUTING.md)

The [design pack](../apps/probe/design/README.md) describes the layouts and credits the original fictional artwork. See the [device guides](devices/README.md) for current hardware observations.
