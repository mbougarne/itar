import React, {useRef, useState} from 'react';
import {Button, StyleSheet, Text, View} from 'react-native';
import {AndroidCommands, AndroidSurface, AndroidTarget} from 'itar/android';

// Mounted-only carrier smoke screen. Full provider/hooks/route API remains Phase 09.
export default function AndroidAdapterScreen() {
  const surface = useRef<React.ElementRef<typeof AndroidSurface>>(null);
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
    <Text>Android adapter preview — device/reader acceptance pending</Text>
    <View style={styles.controls}>
      <Button title="Focus rail B" onPress={() => surface.current && AndroidCommands.focus(surface.current, 'rail-b/entry-1')} />
      <Button title="Cancel request" onPress={() => surface.current && AndroidCommands.cancel(surface.current, request.lifetime, request.request)} />
      <Button title="Owned dialog" onPress={() => surface.current && AndroidCommands.showDialog(surface.current)} />
      <Button title="Unmount B" onPress={() => setMounted(value => !value)} />
      <Button title={active ? 'Cover route' : 'Return route'} onPress={() => setActive(value => !value)} />
      <Button title="Fresh surface" onPress={() => setGeneration(value => value + 1)} />
    </View>
    <Button title={busy ? 'JS block scheduled' : 'Block JS after 1 second'} disabled={busy} onPress={() => {
      setBusy(true);
      setTimeout(() => {
        console.info('ItarAdapter JS busy start');
        const end = Date.now() + 2000;
        while (Date.now() < end) { /* Operator can navigate mounted cards during this bounded load. */ }
        console.info('ItarAdapter JS busy end');
        setBusy(false);
      }, 1000);
    }} />
    <AndroidSurface key={generation} ref={surface} active={active} style={styles.surface}
      onFocusRecord={event => {
        const record = event.nativeEvent;
        if (record.channel === 'input') setFocus(`${record.kind}: ${record.occurrenceKey} [${record.lifetime}/${record.mount}]`);
      }}
      onRequestRecord={event => { setRequest(event.nativeEvent); setOutcome(event.nativeEvent.status); }}>
      {cards.map((key, index) => (mounted || index !== 2) && <AndroidTarget key={key} occurrenceKey={key}
        label={`Movie ${index % 2 + 1}, rail ${index < 2 ? 'A' : 'B'}`} order={index}
        baseColor="#222222" focusColor="#ff8800" style={[styles.card, positions[index]]}
        onActivate={event => setActivation(`${event.nativeEvent.occurrenceKey}: ${event.nativeEvent.source} #${event.nativeEvent.sequence}`)} />)}
    </AndroidSurface>
    <Text>Observed input focus: {focus}</Text>
    <Text>Request {request.request}: {outcome}; last JS activation: {activation}</Text>
    <Text>Reader-owned input stays native. JS callbacks can arrive after highlighting.</Text>
  </View>;
}

const styles = StyleSheet.create({
  screen: {gap: 10}, controls: {flexDirection: 'row', flexWrap: 'wrap', gap: 8},
  first: {left: 0, top: 0}, second: {left: 290, top: 0},
  third: {left: 0, top: 100}, fourth: {left: 290, top: 100},
  surface: {width: 600, height: 190}, card: {position: 'absolute', width: 270, height: 80},
});

const positions = [styles.first, styles.second, styles.third, styles.fourth];
