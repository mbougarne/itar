import React, {useEffect, useRef, useState} from 'react';
import {AppState, BackHandler, Text, View} from 'react-native';
import Video from 'react-native-video';
import type {VideoRef} from 'react-native-video';
import {FocusProvider, FocusScope, occurrenceKey, useFocusCommands, useFocusReady} from 'itar/react';
import {Action} from './ui';
import {useDesign} from './theme';
export const DEMO_STREAM = 'https://test-streams.mux.dev/x36xhzz/url_6/193039199_mp4_h264_aac_hq_7.m3u8';
const source = {uri: DEMO_STREAM, type: 'm3u8', bufferConfig: {minBufferMs: 5000, maxBufferMs: 15000, bufferForPlaybackMs: 1000, bufferForPlaybackAfterRebufferMs: 2000, backBufferDurationMs: 0, cacheSizeMB: 0}};
function Playback({title, onClose}: {title: string; onClose: () => void}) {
  const {s} = useDesign();
  const video = useRef<VideoRef>(null);
  const [paused, setPaused] = useState(false);
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [time, setTime] = useState(0);
  const commands = useFocusCommands();const ready = useFocusReady();
  useEffect(() => { if (!ready) { return; } const request = commands.focusByKey(occurrenceKey('player', 'pause'));return () => request.cancel(); }, [commands, ready]);
  useEffect(() => { const event = BackHandler.addEventListener('hardwareBackPress', () => { onClose();return true; });return () => event.remove(); }, [onClose]);
  useEffect(() => { const event = AppState.addEventListener('change', value => setForeground(value === 'active'));return () => event.remove(); }, []);
  return <View style={s.player}>
    <Video key={attempt} ref={video} source={source} style={s.video} resizeMode="contain" controls={false} focusable={false}
      paused={paused || !foreground} maxBitRate={1500000} playInBackground={false} playWhenInactive={false} progressUpdateInterval={2000}
      onLoad={() => { setLoaded(true);setError(false); }} onProgress={event => setTime(event.currentTime)}
      onError={() => { setError(true);setLoaded(false); }} onEnd={() => setPaused(true)} />
    <View style={s.playerChrome}><Text style={s.body}>{title} · Demo playback</Text>
      <Text style={s.muted}>{error ? 'The public test stream could not load. Retry or return to details.' : loaded ? `${Math.floor(time)} seconds · Big Buck Bunny` : 'Loading public HLS stream…'}</Text>
      <FocusScope id="controls" layout="row" boundary="stop" style={s.playerControls}>
        <Action order={0} id={occurrenceKey('player', 'pause')} label={paused ? 'Resume' : 'Pause'} onPress={() => setPaused(value => !value)} />
        <Action order={1} id={occurrenceKey('player', 'restart')} label={error ? 'Retry stream' : 'Restart'} onPress={() => { if (error) { setAttempt(value => value + 1);setError(false);setLoaded(false); } else { video.current?.seek(0); } setPaused(false); }} />
        <Action order={2} id={occurrenceKey('player', 'close')} label="Close player" onPress={onClose} />
      </FocusScope>
      <Text style={s.footer}>All titles play this same test film: Big Buck Bunny © 2008 Blender Foundation · CC BY 3.0 · peach.blender.org · creativecommons.org/licenses/by/3.0/ · HLS hosted by Mux.</Text>
    </View>
  </View>;
}
export default function Player(props: {title: string; onClose: () => void}) {
  const {s} = useDesign();
  return <FocusProvider style={s.fill}><Playback {...props} /></FocusProvider>;
}
