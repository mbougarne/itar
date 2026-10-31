import React, {useEffect, useRef, useState} from 'react';
import {AppState, BackHandler, Text, View} from 'react-native';
import Video from 'react-native-video';
import type {VideoRef} from 'react-native-video';
import {Focusable, FocusProvider, FocusScope, occurrenceKey, useFocusCommands, useFocusReady} from 'itar/react';
import {IconAction, icons} from './ui';
import {useDesign} from './theme';
export const DEMO_STREAM = 'https://test-streams.mux.dev/x36xhzz/url_6/193039199_mp4_h264_aac_hq_7.m3u8';
const timelineFocusStyle = {accentColor: '#FFFFFF', backgroundColor: '#176B7B'};
const source = {uri: DEMO_STREAM, type: 'm3u8', bufferConfig: {minBufferMs: 5000, maxBufferMs: 15000, bufferForPlaybackMs: 1000, bufferForPlaybackAfterRebufferMs: 2000, backBufferDurationMs: 0, cacheSizeMB: 0}};
function Playback({title, onClose}: {title: string; onClose: () => void}) {
  const {s} = useDesign();
  const video = useRef<VideoRef>(null);
  const [paused, setPaused] = useState(false);
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [duration, setDuration] = useState(0);
  const [muted, setMuted] = useState(false);
  const [buffering, setBuffering] = useState(true);
  const [time, setTime] = useState(0);
  const position = useRef(0);
  const pendingSeek = useRef<number | null>(null);
  const commands = useFocusCommands();const ready = useFocusReady();
  useEffect(() => { if (!ready) { return; } const request = commands.focusByKey(occurrenceKey('player', 'pause'));return () => request.cancel(); }, [commands, ready]);
  useEffect(() => { const event = BackHandler.addEventListener('hardwareBackPress', () => { onClose();return true; });return () => event.remove(); }, [onClose]);
  useEffect(() => { const event = AppState.addEventListener('change', value => setForeground(value === 'active'));return () => event.remove(); }, []);
  const seekTo = (value: number) => {
    if (!loaded || !video.current) { return; }
    const next = Math.max(0, Math.min(duration, value));
    position.current = next;
    pendingSeek.current = next;
    setTime(next);
    video.current.seek(next);
  };
  const seek = (offset: number) => seekTo(position.current + offset);
  const clock = (value: number) => `${Math.floor(value / 60)}:${String(Math.floor(value % 60)).padStart(2, '0')}`;
  return <View style={s.player}>
    <Video key={attempt} ref={video} source={source} style={s.video} resizeMode="contain" controls={false} focusable={false} showNotificationControls={false}
      muted={muted} paused={paused || !foreground} maxBitRate={1500000} playInBackground={false} playWhenInactive={false} progressUpdateInterval={2000}
      onLoad={event => { setDuration(event.duration);setLoaded(true);setError(false);setBuffering(false); }} onBuffer={event => setBuffering(event.isBuffering)} onProgress={event => {
        // A no-op seek at a boundary may not emit onSeek; matching progress
        // also confirms arrival so the displayed clock cannot stay frozen.
        if (pendingSeek.current === null || Math.abs(event.currentTime - pendingSeek.current) < 2.5) {
          pendingSeek.current = null;position.current = event.currentTime;setTime(event.currentTime);
        }
      }} onSeek={event => {
        // Ignore a completion from an older key press during rapid scrubbing.
        if (pendingSeek.current !== null && Math.abs(event.seekTime - pendingSeek.current) < 0.5) { pendingSeek.current = null; }
      }}
      onError={() => { setError(true);setLoaded(false); }} onEnd={() => { pendingSeek.current = null;position.current = duration;setTime(duration);setPaused(true); }} />
    <View style={s.playerChrome}>
      <View style={s.playerMeta}>
        <View style={s.fill}><Text style={s.playerTitle}>Big Buck Bunny</Text><Text numberOfLines={1} style={s.muted}>{title} · Demo playback</Text></View>
        <Text style={s.muted}>{clock(time)} / {clock(duration)}</Text>
      </View>
      {error && <Text style={s.muted}>The public test stream could not load. Use the circular arrow to retry, or close the player.</Text>}
      <View style={s.timeline}>
        <Focusable occurrenceKey={occurrenceKey('player', 'timeline')} displayLabel="" enabled={loaded}
          accessibilityLabel={`Timeline, ${clock(time)} of ${clock(duration)}. Left or right seeks 10 seconds. Select plays or pauses.`}
          onAdjust={delta => seek(delta * 10)} onPress={() => setPaused(value => !value)}
          focusStyle={timelineFocusStyle} style={s.timelineAction} />
        <View pointerEvents="none" accessible={false} importantForAccessibility="no-hide-descendants" style={[s.iconOverlay, s.timelineInset]}>
          <View style={s.playerTrack}>
            <View style={[s.playerProgress, {width: `${duration ? Math.min(100, time / duration * 100) : 0}%`}]} />
            <View style={[s.timelineThumb, {left: `${duration ? Math.min(100, time / duration * 100) : 0}%`}]} />
          </View>
        </View>
      </View>
      <FocusScope id="controls" layout="row" boundary="parent" style={s.playerControls}>
        <IconAction order={0} id={occurrenceKey('player', 'pause')} label={paused ? 'Play' : 'Pause'} icon={paused ? icons.play : icons.pause} size={88} onPress={() => setPaused(value => !value)} />
        <IconAction order={1} id={occurrenceKey('player', 'rewind')} label="Rewind 10 seconds" icon={icons.rewind} enabled={loaded} onPress={() => seek(-10)} />
        <IconAction order={2} id={occurrenceKey('player', 'forward')} label="Forward 10 seconds" icon={icons.forward} enabled={loaded} onPress={() => seek(10)} />
        <IconAction order={3} id={occurrenceKey('player', 'restart')} label={error ? 'Retry stream' : 'Restart'} icon={icons.restart} onPress={() => { if (error) { setAttempt(value => value + 1);setError(false);setLoaded(false);setBuffering(true);setTime(0);position.current = 0;pendingSeek.current = null;setDuration(0); } else { seekTo(0); } setPaused(false); }} />
        <IconAction order={4} id={occurrenceKey('player', 'mute')} label={muted ? 'Unmute' : 'Mute'} icon={muted ? icons.muted : icons.volume} onPress={() => setMuted(value => !value)} />
        <IconAction order={5} id={occurrenceKey('player', 'close')} label="Close player" icon={icons.close} onPress={onClose} />
        <Text style={s.playerStatus}>{error ? 'Playback unavailable' : !loaded ? 'Loading…' : buffering ? 'Buffering…' : paused ? 'Paused' : 'Playing'}</Text>
      </FocusScope>
      <Text style={s.footer}>Big Buck Bunny © 2008 Blender Foundation · CC BY 3.0 · peach.blender.org · creativecommons.org/licenses/by/3.0/ · HLS hosted by Mux.</Text>
    </View>
  </View>;
}
export default function Player(props: {title: string; onClose: () => void}) {
  const {s} = useDesign();
  return <FocusProvider style={s.fill}><Playback {...props} /></FocusProvider>;
}
