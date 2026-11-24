# Apple TV and tvOS

[العربية](../ar/devices/apple-tv.md)

The [tvOS adapter](../../packages/itar/apple/) uses Swift for UIKit views and focus callbacks. A narrow C interface connects Swift to the engine. Fabric component views forward React props and commands to the Swift host. UIKit owns mounted directional focus and gestures. Itar can supply preferences, coordinate scrolling to a virtualized destination and confirm the move when UIKit reports the actual focused view.

## Build and run

Follow the native setup in the [standalone Itar Cinema repository](https://github.com/mbougarne/itar-cinema). For library instrumentation, generate the test host with `npm run native:fixture` in Itar and use `build/native-consumer/ios`.

## Try it with the Siri Remote

1. Use the demo sign-in, select a profile and enter Home. Move from the Home sidebar item into a card, return to the sidebar, and re-enter Home. Record the visible outline after each move.
2. Enter Settings. Check that the controls below the heading appear and can receive focus. Test returning to the sidebar using both a directional input and Back/Menu. Identify which input you used.
3. Open a nonfirst movie card, enter the player, and return through Details to the catalogue. Compare the opener with the restored card. Repeat with clicks, then swipes, then held/repeated input; gesture momentum can change the sequence.
4. Repeat in VoiceOver navigation and exploration modes. Record which element VoiceOver visits, speaks and activates. Check the outline and focus feedback again with Reduce Motion enabled.

## Review Occo recordings

Use the [offline viewer](../../tools/occo/viewer.html) to open recorded traces from library development builds. The standalone app currently uses the published package’s public APIs.

## What has been observed

A development-signed Release build displayed catalogue content and artwork on physical Apple TV HD (4th generation) running tvOS 26.6.1. Settings displayed its heading without the expected controls. The tester also reported difficulty returning to the sidebar and a Home entry that stopped responding to directions.

On a tvOS 26.5 simulator, the Home repair passed two cold-launch, card and sidebar re-entry cycles with VoiceOver off.

A later Cinema development build passed remote-button tests on a physical Apple TV HD running tvOS 26.6.1. XCTest sent D-pad, Select and Menu inputs. Home opened Details and restored the opener on return. In Movies, Down from **All** reached the first card. Settings accepted focus, and the tester could start, mark, freeze and export an Occo recording using the remote controls. The recording reopened in the offline viewer. This run used VoiceOver off.

The maintainer subsequently tested Cinema on the physical TV with VoiceOver both on and off. In the VoiceOver run, Back restored the selected recommendation and then the original Home card. The maintainer also confirmed that the paused player stayed quiet after VoiceOver read the Play label.

Separate hosted UIKit tests on a tvOS 27 simulator exercised collection reveal, cancellation, observed focus and single-host ownership for custom card content. These fixtures can drive selected host operations directly. To run the simulator fixtures, wire test targets into a freshly generated shell with `bundle _2.6.9_ exec ruby probes/apple/tests/wire-tests.rb`. Run `bundle _2.6.9_ exec pod install` inside `build/native-consumer/ios` to update the generated workspace, then select the **ItarAppleTests** scheme in Xcode. The separate **ItarRemoteTests** scheme drives simulator remote buttons and expects Metro on port 8096. [Test wiring and fixtures](../../probes/apple/tests/)
