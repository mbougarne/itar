# Itar · إطار

**English** · [العربية](README.ar.md)

[Features](#what-you-can-build-with-it) · [Occo focus debugger](#debug-focus-with-occo) · [Get started](#try-it-from-a-checkout) · [React example](#use-it-in-a-react-native-tv-screen) · [Devices](#where-the-beta-stands) · [Compare libraries](#how-itar-compares) · [Documentation](#find-your-way-around)

Itar is a C++20 focus engine for React Native TV apps. It handles the part of remote navigation that gets difficult in a real catalogue. A viewer can open a movie from the fourth rail, watch something, and press Back after the list has changed. Itar gives the app a way to identify that *particular card*, ask the host to reveal it, and learn whether focus actually returned.

**Install the first beta with `npm install @bougarnem/itar@beta`.** Version `0.1.0-beta` includes the React Native TV adapter (`@bougarnem/itar/react`) and the browser/WebAssembly adapter (`@bougarnem/itar/web`) used on Samsung Tizen and LG webOS. The React API and host behavior can change during the beta. [Device status and open checks](docs/devices/README.md)

[Itar Cinema](https://github.com/mbougarne/itar-cinema) is the standalone example app. It installs the published Itar beta and includes browser and TV build instructions.

## What you can build with it

- **Menus, rails and routes.** Declare a scope for each navigable region. Give it a row, column or spatial layout, a boundary policy and, where needed, a preferred entry target or history-based return.
- **Cards with a single focus target.** Put artwork and text inside a `Focusable`. The outer host owns the accessible label, activation and focus feedback. The same title can appear in multiple rails with distinct occurrence keys.
- **Virtualized catalogues.** Fixed-extent lists and nested rails keep logical items in the engine while React mounts a window of cells. A request for a distant item can wait for realization, scroll and native confirmation.
- **Interfaces that load or change routes.** Gate entry while data is being committed, cancel obsolete focus requests and observe the outcome. Input focus and accessibility focus have separate channels. Platform readers retain control of speech and exploration.

## Debug focus with Occo

Occo is Itar’s focus trace tooling. Its timeline records the input, request, host outcome, and observed focus on separate channels. Open the [offline viewer](tools/occo/viewer.html) and load the [sample recording](tools/occo/synthetic-example.json) to inspect a trace. The standalone [Cinema repository](https://github.com/mbougarne/itar-cinema) uses the public package.

## Try it from a checkout

### Run the engine tests

With CMake 3.20+ and a C++20 compiler, run these commands from the repository root. This path works without Node, a TV SDK or a device.

```sh
cmake -S core -B build/core -DCMAKE_BUILD_TYPE=Release -DBUILD_TESTING=ON
cmake --build build/core --parallel 2
ctest --test-dir build/core --output-on-failure --no-tests=error --timeout 60
```

### Run Itar Cinema

Clone the [standalone Cinema repository](https://github.com/mbougarne/itar-cinema) and follow its README. The app uses the packaged WebAssembly engine, so its browser build does not require Emscripten.

## Use it in a React Native TV screen

The [integration guide](docs/guides/integration.md) covers packing a local tarball, the pinned React Native TV runtime and native setup. Import the React API from `@bougarnem/itar/react`.

```tsx
import {FocusProvider, FocusScope, Focusable, occurrenceKey} from '@bougarnem/itar/react';

const entries = [
  {id: 'arrival', title: 'Arrival'},
  {id: 'solaris', title: 'Solaris'},
];

export function Watchlist({openTitle}: {openTitle: (id: string) => void}) {
  return (
    <FocusProvider style={{flex: 1}}>
      <FocusScope id="watchlist" layout="row" style={{flexDirection: 'row'}}>
        {entries.map((entry, index) => (
          <Focusable
            key={entry.id}
            occurrenceKey={occurrenceKey('watchlist', entry.id)}
            contentId={entry.id}
            accessibilityLabel={entry.title}
            order={index}
            style={{width: 200, height: 80}}
            focusStyle={{accentColor: '#26d9f2'}}
            onPress={() => openTitle(entry.id)}
          />
        ))}
      </FocusScope>
    </FocusProvider>
  );
}
```

Here `occurrenceKey('watchlist', 'arrival')` identifies the card the viewer activated. A second copy in a recommendations rail gets its own key and can have a different return position. `layout="row"` describes navigation policy. React Native's `flexDirection` and dimensions place the controls on screen. For larger datasets, see [lists, rails and custom cell rendering](docs/guides/collections.md).

## Where the beta stands

| Target | What testers can try | What still needs evidence |
| --- | --- | --- |
| Android TV / Google TV | Cinema was tested on Chromecast HD with TalkBack off and on. Google TV emulator checks also cover directional navigation and selected TalkBack returns. | Repeat the Chromecast Down and loading scenarios on the latest build. |
| Apple TV / tvOS | Cinema passed on physical Apple TV HD with VoiceOver on and off, including remote navigation, nested Back restoration and player controls. | Repeat on other Apple TV models and tvOS versions. |
| Fire TV / Fire OS | Cinema passed on a physical Fire TV (AFTKA, Android API 28) with VoiceView off and on. Tested Home rows, More Like This, return to the opening card and player seeking. | Other Fire OS models and versions. Vega OS requires a separate adapter. |
| Desktop browser, Samsung Tizen, LG webOS | Cinema navigation passed on physical Samsung and LG TVs with Voice Guide and Audio Guidance enabled, respectively. Chromium exercises the same DOM/Wasm adapter. | Coverage on other TV models and browser versions. |
| Other TV runtimes | Vega OS, VIDAA, Xbox and PlayStation are under investigation. | No adapter has been validated for these targets. Roku is outside the project scope. |

## How Itar compares

If your TV app already uses Norigin, you can keep the idea of a stable key for each card. Itar adds a request you can cancel while a rail scrolls or a route changes, and a result that tells you whether the host focused the intended card. Cinema uses the same occurrence keys on Android TV, Apple TV and the web. The packaged web adapter targets Chrome 85.

The comparison follows one rail through a reorder and a return from Details. It covers plain React Native TV, Norigin, BAM and Itar, including who chooses the next card, what each focus call returns, virtualized collection limits and reader support. [Compare TV focus systems](docs/comparison.md)

## Find your way around

| If you want to… | Start here |
| --- | --- |
| Integrate a screen or inspect the API | [Integration guide](docs/guides/integration.md) · [React API reference](packages/itar/README.md) |
| Understand where a remote press goes | [Architecture walkthrough](docs/guides/architecture.md) |
| Work on a platform or report a device issue | [Device guides](docs/devices/README.md) · [contributing and reporting](CONTRIBUTING.md) |
| Explore the implementation | [C++ engine](core/) · [React and native adapters](packages/itar/) · [standalone Cinema app](https://github.com/mbougarne/itar-cinema) |
| Find a contract, a build command or a test protocol | [Documentation index](docs/README.md) |

Itar is distributed under the [MIT license](LICENSE). Media and artwork credits belong to [Itar Cinema](https://github.com/mbougarne/itar-cinema).
