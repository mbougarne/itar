import React, {useRef, useState} from 'react';
import {Button, StyleSheet, Text, View} from 'react-native';
import {AppleCommands, AppleSurface, AppleTarget} from 'itar/apple';

// Carrier-level consumer. The later cross-platform provider/hooks are separate.
export default function AppleAdapterScreen() {
  const surface = useRef<React.ElementRef<typeof AppleSurface>>(null);
  const [mounted, setMounted] = useState(true);
  const [active, setActive] = useState(true);
  const [generation, setGeneration] = useState(0);
  const [focus, setFocus] = useState('Unknown');
  const [request, setRequest] = useState({lifetime: '0', request: '0'});
  const [outcome, setOutcome] = useState('None');
  const [activation, setActivation] = useState('None');
  const [busy, setBusy] = useState(false);
  const cards = ['rail-a/entry-1', 'rail-a/entry-2', 'rail-b/entry-1', 'rail-b/entry-2'];
  return <View style={styles.screen}>
    <View style={styles.controls}>
      <Button title="Focus rail B" onPress={() => surface.current && AppleCommands.focus(surface.current, 'rail-b/entry-1')} />
      <Button title="Cancel request" onPress={() => surface.current && AppleCommands.cancel(surface.current, request.lifetime, request.request)} />
      <Button title="Owned dialog" onPress={() => surface.current && AppleCommands.showDialog(surface.current)} />
      <Button title={mounted ? 'Unmount B' : 'Mount B'} onPress={() => setMounted(value => !value)} />
      <Button title={active ? 'Cover route' : 'Return route'} onPress={() => setActive(value => !value)} />
      <Button title="Fresh surface" onPress={() => setGeneration(value => value + 1)} />
    </View>
    <Button title={busy ? 'JS block scheduled' : 'Block JS after 1 second'} disabled={busy} onPress={() => {
      setBusy(true);
      setTimeout(() => {
        const end = Date.now() + 2000;
        while (Date.now() < end) { /* Bounded native-feedback fixture. */ }
        setBusy(false);
      }, 1000);
    }} />
    <AppleSurface key={generation} ref={surface} active={active} style={styles.surface}
      onFocusRecord={event => {
        const record = event.nativeEvent;
        if (record.channel === 'input') setFocus(`${record.kind}: ${record.occurrenceKey} [${record.lifetime}/${record.mount}]`);
      }}
      onRequestRecord={event => { setRequest(event.nativeEvent); setOutcome(event.nativeEvent.status); }}>
      {cards.map((key, index) => (mounted || index !== 2) && <AppleTarget key={key} occurrenceKey={key}
        label={`Movie ${index % 2 + 1}, rail ${index < 2 ? 'A' : 'B'}`} order={index}
        baseColor="#222222" focusColor="#ff8800" style={[styles.card, positions[index]]}
        onActivate={event => setActivation(`${event.nativeEvent.occurrenceKey}: ${event.nativeEvent.source} #${event.nativeEvent.sequence}`)} />)}
    </AppleSurface>
    <Text>Observed input focus: {focus}</Text>
    <Text>Request {request.request}: {outcome}; last activation: {activation}</Text>
  </View>;
}

const styles = StyleSheet.create({
  screen: {gap: 12}, controls: {flexDirection: 'row', flexWrap: 'wrap', gap: 8},
  first: {left: 0, top: 0}, second: {left: 310, top: 0},
  third: {left: 0, top: 110}, fourth: {left: 310, top: 110},
  surface: {width: 620, height: 210}, card: {position: 'absolute', width: 290, height: 90},
});
const positions = [styles.first, styles.second, styles.third, styles.fourth];
