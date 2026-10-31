import React, {useEffect, useState} from 'react';
import {BackHandler, Text, View} from 'react-native';
import {FocusScope, occurrenceKey, useFocusCommands, useFocusReady} from 'itar/react';
import {Action} from './ui';
import {useDesign} from './theme';
import {guideTime, useGuide, type Programme} from './guide';
import {guideWindow} from './guide-data';
export default function Epg({onClose}: {onClose: () => void}) {
  const {s, u} = useDesign();const {guide, error, retry} = useGuide(true);const [selected, setSelected] = useState<Programme | null>(null);
  const [requested, setRequested] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now() / 1000);
  const commands = useFocusCommands();const ready = useFocusReady();
  useEffect(() => { if (!ready) { return; } const request = commands.focusByKey(occurrenceKey('epg', 'back'));return () => request.cancel(); }, [commands, ready]);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now() / 1000), 60000);return () => clearInterval(timer); }, []);
  useEffect(() => { const listener = BackHandler.addEventListener('hardwareBackPress', () => { onClose();return true; });return () => listener.remove(); }, [onClose]);
  const {start, end, previous, next} = guideWindow(guide, now, requested);
  const move = (time: number | null) => { setSelected(null);setRequested(time); };
  const scale = 1380 * u / (end - start);
  return <FocusScope id="guide" layout="spatial" style={[s.profilePage, {padding: 48 * u}]}>
    <View style={[s.row, s.guideHeader]}>
      <Action id={occurrenceKey('epg', 'back')} label="Back to Home" onPress={onClose} style={{width: 260 * u}} />
      <Text style={s.messageTitle}>TV guide</Text>
      <Text style={s.muted}>EPGTalk · US local channels · Your local time</Text>
    </View>
    <FocusScope id="guide-time" layout="row" boundary="parent" style={s.filters}>
      <Action id={occurrenceKey('epg', 'previous')} label="Previous hour" displayLabel="‹  Previous" enabled={previous} onPress={() => move(start - 3600)} style={s.filter} />
      <Action order={1} id={occurrenceKey('epg', 'now')} label="Now" onPress={() => move(null)} style={s.filter} />
      <Action order={2} id={occurrenceKey('epg', 'next')} label="Next hour" displayLabel="Next  ›" enabled={next} onPress={() => move(start + 3600)} style={s.filter} />
      <Text style={s.muted}>{new Date(start * 1000).toLocaleDateString()} · {guideTime(start)}–{guideTime(end)}</Text>
    </FocusScope>
    <View style={[s.guideRow, {marginLeft: 212 * u}]}>{[0, 1, 2, 3].map(slot => <Text key={slot} style={[s.muted, {width: 345 * u - 12 * u}]}>{guideTime(start + slot * 1800)}</Text>)}</View>
    {guide?.channels.map(channel => <FocusScope key={channel.id} id={`channel-${channel.id}`} layout="row" boundary="parent" style={s.guideRow}>
      <View style={s.guideTitle}><Text numberOfLines={2} style={s.muted}>{channel.name}</Text></View>
      <View style={{width: 1380 * u, height: 84 * u}}>
        {!channel.programmes.some(p => p.stop > start && p.start < end) && <Text style={s.muted}>No listings for this time</Text>}
        {channel.programmes.filter(p => p.stop > start && p.start < end).slice(0, 12).map((p, order) => {
          const left = (Math.max(p.start, start) - start) * scale;
          const width = (Math.min(p.stop, end) - Math.max(p.start, start)) * scale;
          return <Action key={p.start} order={order} id={occurrenceKey('epg', channel.id, String(p.start))}
            label={`${channel.name}, ${p.title}, ${guideTime(p.start)} to ${guideTime(p.stop)}`} displayLabel={`${guideTime(p.start)}  ${p.title}`}
            onPress={() => setSelected(p)} style={[s.guideCell, s.programmePosition, p.start <= now && p.stop > now && s.currentProgramme, {left, height: 84 * u, width: Math.max(1, width - 6 * u)}]} />;
        })}
      </View>
    </FocusScope>)}
    {(!guide || !guide.channels.length || error) && <View style={s.message}><Text style={s.body}>{error || (guide ? 'No current listings in this schedule. Refresh later.' : 'Loading the TV guide…')}</Text>
      <Action id={occurrenceKey('epg', 'retry')} label="Refresh guide" onPress={retry} /></View>}
    <Text numberOfLines={2} style={s.body}>{selected ? `${selected.title} · ${guideTime(selected.start)}–${guideTime(selected.stop)}${selected.subtitle ? ` · ${selected.subtitle}` : ''}` : 'Select a programme to see its information.'}</Text>
    <Text style={s.footer}>Schedule information only · No channel playback · EPGTalk / epgtalk.com{guide ? ` · Updated ${new Date(guide.updated).toLocaleString()}` : ''}</Text>
  </FocusScope>;
}
