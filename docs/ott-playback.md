# Showcase demo playback

Every title's Play action uses the same public 480p Big Buck Bunny HLS stream:
`https://test-streams.mux.dev/x36xhzz/url_6/193039199_mp4_h264_aac_hq_7.m3u8`.
This is a test film, not the selected TMDB title, a trailer, or an entitlement
to that title. The Details disclosure and player name/credit make this explicit.
No playback API key or credential is used.

The source film is © 2008 Blender Foundation, [Big Buck Bunny](https://peach.blender.org/about/),
licensed [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/); see also
the [Creative Commons film entry](https://wiki.creativecommons.org/wiki/Big_Buck_Bunny).
The player displays attribution, source/license URLs and the Mux hosting credit.
[Mux's public test catalogue](https://test-streams.mux.dev/) supplies the HLS test
endpoint. No media was copied into the repository. Public endpoint availability
and network access remain external dependencies; the player offers Retry/Close.

Pinned `react-native-video@6.19.3` provides native Android Media3 and Apple
AVPlayer integration. [Version 6 documentation](https://docs.thewidlarzgroup.com/react-native-video/docs/v6/intro/)
and its installed podspec declare tvOS support. Declared compatibility is not
acceptance on this project's Apple TV target. Android arm64 debug installation
with react-native-tvos 0.83.0-0 built and actually decoded the stream on Android
16 TV. No Apple pod install, build, simulator, physical device or VoiceOver test
was performed.

The video now fills the viewport behind an absolute, translucent bottom overlay.
Play/Pause, ten-second rewind/forward, Restart/Retry, Mute/Unmute and Close use
local Feather icons with no visible button text. The larger play/pause target
keeps its occurrence identity while its icon and accessible action label change.
Progress, elapsed/duration time, playback status and the film attribution remain
visible. Controls stay visible for the focus-testing showcase; there is no
inactivity timer that hides a focused target.

Each icon is a non-interactive decorative image above one native Itar Action.
Explicit drawing order keeps the image above Android's raised focused button.
The image adds no extra accessibility or focus target. The Details heart button
uses the same presentation and retains its existing focus-only/no-op behavior.
No dependency, native adapter, navigation policy or media source changed in this
presentation pass.

The following timeline pass adds one managed, adjustable target above the icon
row. Up reaches the timeline; Down returns to the buttons. Left/Right immediately
seek by ten seconds, clamped to the film's duration; Select toggles playback.
Seeking preserves the paused/playing state. A position ref accumulates rapid
presses without waiting for a React render or the next media progress callback.
Older seek completions cannot overwrite a newer requested position.

`Focusable.onAdjust` opts a target into horizontal adjustment. Android consumes
those keys before navigation; Apple handles arrow presses and horizontal UIKit
focus proposals. Vertical navigation remains with the existing adapter. Native
adjustment events carry the same lifetime, mount, registration and sequence
validation as activation. Accessibility exposes a seek-bar/adjustable control
with increment/decrement actions; its label includes the current position.
This is an adapter/API addition, with no C++ navigation-policy change.

Timeline verification (2026-10-31): Android TV API36 remote input moved 0:12 →
0:42 with three Right presses, then 0:32 with Left. Repeated input clamped at
0:00 and 10:34. Playback resumed after the lower bound; seeking while playing
kept playing. Down reached Close (the existing spatial choice), and Up returned
to the timeline. The final screen is paused at 4:34 with the timeline focused.
The bundled debug/test APKs, native CallbackTest including adjustment ownership
and accessibility actions, Android lint, 48 JavaScript tests, TypeScript and
ESLint pass. Swift syntax parsing passes; Apple compilation/remote gestures and
screen-reader speech remain unverified. An initial non-bundled APK failed script
startup; rebuilding with the established `-PitarOffline=true` resolved it.
Ignored captures: `build/ott-review-2026-10-31/timeline/`.

Itar owns those controls in a separate active
focus surface; the underlying Details surface releases collection ownership.
The native video surface is not an additional remote-focus control. Hardware
Back closes playback and restores Play. Playback pauses when the app becomes
inactive; buffers are bounded to 5–15 seconds, bitrate to 1.5 Mbps, no background
playback or disk cache is requested. These settings are not a performance
benchmark. On the running Android TV API36 emulator, the icon pass verified
decoded frames, Pause/Play semantics, all six remote-focus targets with empty
visible button text, ten-second rewind/forward (0:49 → 0:39 → 0:49), Restart,
Mute/Unmute state, Close restoring Details Play, and the focused no-op heart.
The focused icons remain visible above their circular native focus rings.
TypeScript, ESLint, the Android bundle and `git diff --check` pass. Local captures
are in ignored `build/ott-review-2026-10-31/player-icons/`. Recovery from a real
stream outage, screen-reader speech, physical devices and tvOS remain unverified.

Android shell generation declares the video dependency's notification permission
so lint can validate its included service code. The showcase explicitly disables
notification controls, never requests that runtime permission and does not start
background playback. Android 13+ runtime permission is not granted merely by its
manifest declaration. Native lint enforcement remains enabled.

The pinned6.19.3 Android dependency also has a missing `@WorkerThread` on its
zero-argument manifest-track wrapper ([upstream issue4885](https://github.com/TheWidlarzGroup/react-native-video/issues/4885)).
Shell generation applies that annotation with version/shape guards. Its only
caller already runs in a worker executor; runtime logic is unchanged. A version
upgrade must review this patch rather than silently carrying it forward.
