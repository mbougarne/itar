# tvOS host and C interface

[العربية](README.ar.md) · [Build and test on Apple TV](../../../docs/devices/apple-tv.md)

The Apple package contains the C++ engine, its C interface, the Swift/UIKit owner and the Objective-C++ Fabric component views. The podspec targets tvOS 15.1 and Swift language mode 5. The Swift module imports the C interface exposed by [ItarEngine.h](ItarEngine.h). Its C++ settings stay inside the pod targets.

For an app using the Itar tarball and React Native autolinking, add the following line to its tvOS target in `ios/Podfile`, then run `bundle exec pod install` there. Autolinking selects the package-named podspec for the Swift/native target.

```ruby
pod 'ItarEngineCore', :path => '../node_modules/@bougarnem/itar'
```

## Host contract

- Each `EngineConnection` owns one surface lifetime. Create, use and close it on the main thread. Dispose to revoke work and destroy the C handle once. Queue any callbacks that occur during a host operation before returning to engine dispatch.
- The C facade borrows buffers for the duration of a call and copies keys up to 512 bytes. The caller owns the effect and notification output buffers. Read the transport status and the batch or request result separately. Copy an effect, revalidate its identity, then issue it before performing native work.
- UIKit chooses ordinary mounted moves and remote gestures. An explicit engine preference can request focus. For fixed-extent collections the host can scroll to a newly realized item and coordinate logical entry between rows. An observed UIKit focus update completes the transfer.
- For a new screen, give its active, ready scope an `accessibilityPaneTitle` and a `preferredKey` inside that scope. With VoiceOver on, the Apple host presents the mounted, visible button as the entry point once per pane transition. Later layout changes leave the reader free to explore.
- VoiceOver observation and semantic activation use their own channel. The host can activate an accessible target without moving input focus to it. For real remote, reduced-motion and VoiceOver checks, follow the [device guide](../../../docs/devices/apple-tv.md).

See [EngineConnection.swift](EngineConnection.swift), [the C++ implementation](ItarEngine.cpp) and [the collection API](../virtualization.md) when changing the integration.
