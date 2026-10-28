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

Itar owns Pause/Resume, Restart/Retry and Close controls in a separate active
focus surface; the underlying Details surface releases collection ownership.
The native video surface is not an additional remote-focus control. Hardware
Back closes playback and restores Play. Playback pauses when the app becomes
inactive; buffers are bounded to 5–15 seconds, bitrate to 1.5 Mbps, no background
playback or disk cache is requested. These settings are not a performance
benchmark. Actual Android frames, elapsed time, Pause/Resume label and a stable
paused timestamp were inspected. Restart, recovery from a real stream outage,
all player button transitions and tvOS remain unverified.

Android shell generation declares the video dependency's notification permission
so lint can validate its included service code. The showcase explicitly disables
notification controls, never requests that runtime permission and does not start
background playback. Android 13+ runtime permission is not granted merely by its
manifest declaration. Native lint enforcement remains enabled.
