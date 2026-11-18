# Apple TV and tvOS

[العربية](../ar/devices/apple-tv.md)

The [tvOS adapter](../../packages/itar/apple/) uses Swift for UIKit views and focus callbacks. A narrow C interface connects Swift to the engine. Fabric component views forward React props and commands to the Swift host. UIKit owns mounted directional focus and gestures. Itar can supply preferences, coordinate scrolling to a virtualized destination and confirm the move when UIKit reports the actual focused view.

## Build and run

Complete [native example setup](README.md#prepare-the-native-example). Use a Mac with Xcode, the tvOS SDK and a tvOS simulator runtime. Xcode 27 and SDK 27 have built the example. Use Ruby 3.3.6 from `.ruby-version` with Bundler 2.6.9. From the repository root, install the pods and identify an available Apple TV simulator.

```sh
bundle _2.6.9_ install
(cd apps/probe/ios && bundle _2.6.9_ exec pod install --deployment)
xcrun simctl list devices available
```

Start Metro in one terminal with `npm run start -w itar-probe`. In another, substitute the tvOS simulator's identifier and run the showcase.

```sh
npm run tvos -w itar-probe -- --udid YOUR_TVOS_SIMULATOR_UDID --no-packager
```

For a physical Apple TV, pair it with Xcode, open `apps/probe/ios/ItarProbe.xcworkspace`, choose the **ItarProbe** scheme and select the paired TV as the destination. Configure a development signing team and an available app bundle identifier for the app target. To exercise the app without Metro on the TV, choose **Release** as the scheme's Run build configuration and run it on the selected device. Native Cinema defaults to a metadata proxy. Use **Settings → Catalogue → Offline fixtures**, or configure the [device-reachable proxy](../tmdb-proxy.md) when testing live loading.

## Try it with the Siri Remote

1. Use the demo sign-in, select a profile and enter Home. Move from the Home sidebar item into a card, return to the sidebar, and re-enter Home. Record the visible outline after each move.
2. Enter Settings. Check that the controls below the heading appear and can receive focus. Test returning to the sidebar using both a directional input and Back/Menu. Identify which input you used.
3. Open a nonfirst movie card, enter the player, and return through Details to the catalogue. Compare the opener with the restored card. Repeat with clicks, then swipes, then held/repeated input; gesture momentum can change the sequence.
4. Repeat in VoiceOver navigation and exploration modes. Record which element VoiceOver visits, speaks and activates. Check the outline and focus feedback again with Reduce Motion enabled.

## What has been observed

A development-signed Release build displayed catalogue content and artwork on physical Apple TV HD (4th generation) running tvOS 26.6.1. Settings displayed its heading without the expected controls. The tester also reported difficulty returning to the sidebar and a Home entry that stopped responding to directions.

On a tvOS 26.5 simulator, the Home failure was reproduced and the repair passed two cold-launch, card and sidebar re-entry cycles with VoiceOver off. A later build was installed and launched on the physical TV; confirmation of visible Home navigation after that install is still pending. Settings, Siri Remote gestures and both VoiceOver modes also need a hardware run.

Separate hosted UIKit tests on a tvOS 27 simulator exercised collection reveal, cancellation, observed focus and single-host ownership for custom card content. These fixtures can drive selected host operations directly. To run the simulator fixtures, wire test targets into a freshly generated shell with `bundle _2.6.9_ exec ruby probes/apple/tests/wire-tests.rb`. Run `bundle _2.6.9_ exec pod install` inside `apps/probe/ios` to update the generated workspace, then select the **ItarAppleTests** scheme in Xcode. The separate **ItarRemoteTests** scheme drives simulator remote buttons and expects Metro on port 8096. [Test wiring and fixtures](../../probes/apple/tests/)
