# Contributing to Itar

**English** · [العربية](CONTRIBUTING.ar.md)

The beta needs reproducible focus scenarios, improvements to the example and tested changes to the engine and adapters. You can work on the core with a desktop compiler. A TV becomes essential when the behavior under discussion involves its remote, focus system or screen reader.

## Report a focus problem

Open an issue with one route through the example or a small consumer. Give the starting target, the exact sequence of remote inputs, the expected destination and what actually happened. For example, “Home → third card in the second rail → Details → Back. Expected the activated card. The first card in the rail received focus instead.”

Include the commit, build mode, device model or simulator, OS, runtime version, input method, content source and reader state. For a reader issue, record what the highlight did, what the reader selected, and what you actually heard. Say whether the failure happens with fixtures, during loading, after recycling, or only on repeated input. A short synthetic reproduction is easier to share than a product recording. [Per-device setup and checklists](docs/devices/README.md)

## Pick the layer that owns the behavior

| Change | Where to start | First verification |
| --- | --- | --- |
| Destination choice, history, identity, request cancellation | [C++ core](core/) and [architecture walkthrough](docs/guides/architecture.md) | Exercise the matching suite under `core/tests/` with CTest. |
| React component, public prop or collection model | [TypeScript package](packages/itar/src/) and [React reference](packages/itar/README.md) | Build the package, run typecheck and the workspace tests. Check the local tarball if exports or packaging changed. |
| Android mount, remote event, scroll, visibility or semantics | [Kotlin/JNI adapter](packages/itar/android/) | Run the generated Android consumer checks and reproduce on the affected runtime. |
| Apple focus update, Swift ownership or Fabric carrier | [Swift and Objective-C++ adapter](packages/itar/apple/) | Run the facade checks and the affected tvOS scenario. |
| Browser input, DOM focus or virtual window | [Web host and Wasm binding](packages/itar/web-runtime/) | Rebuild Wasm, run web checks, then reproduce in a browser. |
| Consumer screen, fixture or route return | [Cinema](https://github.com/mbougarne/itar-cinema) | Run the app checks and exercise the interaction in the affected host. |

The [architecture guide](docs/guides/architecture.md) explains the implemented contracts. The [repository instructions](AGENTS.md) cover ownership, native boundaries, resource limits and accessibility. Keep policy in C++, native operations in the host, and titles, routes and presentation in the app. An effect can be accepted before native focus changes. Tests should account for delayed, rejected and cancelled operations.

## Work locally

Run commands from the repository root. Use Node 22.23.4 and npm 10.9.9 for JS work. The npm install reads the lockfile. The build produces the package entrypoints consumed by the workspace tests.

```sh
npm ci --ignore-scripts --no-audit
npm run build
npm run typecheck
npm run lint
npm test
```

For C++ changes:

```sh
cmake -S core -B build/core -DCMAKE_BUILD_TYPE=Release -DBUILD_TESTING=ON
cmake --build build/core --parallel 2
ctest --test-dir build/core --output-on-failure --no-tests=error --timeout 60
```

For browser changes, install the [pinned Emscripten SDK](docs/devices/web-tv.md#desktop-browser) first:

```sh
npm run build:web:engine
npm run typecheck:web
npm run test:web
```

For packaging changes, run `node scripts/check-package.cjs build/package-check`. It creates a local tarball, installs it in a fresh directory, checks the exported entries and runs a compiled C++/Apple facade smoke test. The [device guides](docs/devices/README.md) cover testing in a native host. Keep generated shells, local credentials, signing files and raw captures out of commits.

## Send a change

Use one issue or a clearly described maintenance task per change. Keep a behavior change separate from a file move when you can. Give components descriptive filenames, keep presentation separate from focus ownership, and put shared types and pure helpers next to the feature that uses them. Explain lifecycle constraints in comments where a reader could reasonably choose a different implementation.

Use the [pull request template](.github/PULL_REQUEST_TEMPLATE.md) to name the problem, tests and outstanding hardware checks. The project targets about 250 authored changed lines per review, with an explanation for a cohesive change up to 500. Split larger features into independently verifiable steps. If a result came from an emulator, simulator or a synthetic event, identify it as such. Include the model and OS with physical results.
