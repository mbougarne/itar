import React, {useEffect, useRef, useState} from 'react';
import {Button, StyleSheet, Text, View} from 'react-native';
import ComparisonLibrary from './ComparisonLibrary';
import {FocusProvider, FocusScope, Focusable, occurrenceKey} from 'itar/react';

const focusStyle = {accentColor: '#ff8800'};
const rows = [0, 1];
const columns = [0, 1, 2, 3];
// Mounted-only comparison. Record input/host/visible timing with native tools;
// JS callbacks cannot timestamp native progress while JS itself is stalled.
export default function ValidationScreen() {
  const [mode, setMode] = useState<'native' | 'itar' | 'library'>('itar');
  const [scheduled, setScheduled] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current !== null) { clearTimeout(timer.current); } }, []);
  const schedule = (duration: number) => {
    setScheduled(true);
    console.info(`ItarValidation mode=${mode} mounted=8 stall_ms=${duration} scheduled_delay_ms=1000`);
    timer.current = setTimeout(() => {
      timer.current = null;
      const start = Date.now();
      while (Date.now() - start < duration) { /* Bounded synthetic JS load. */ }
      console.info(`ItarValidation actual_stall_ms=${Date.now() - start}`);
      setScheduled(false);
    }, 1000);
  };
  const grid = <View style={styles.grid}>
    {rows.map(row => mode === 'itar' ?
      <FocusScope key={row} id={`row-${row}`} layout="row" style={styles.row}>
        {columns.map(column => <Focusable key={column}
          occurrenceKey={occurrenceKey('validation', String(row), String(column))}
          accessibilityLabel={`Target ${row * 4 + column + 1}`} order={column}
          focusStyle={focusStyle} baseAccentColor="#222222" style={styles.card} />)}
      </FocusScope> :
      <View key={row} style={styles.row}>
        {columns.map(column => <View key={column} style={styles.card}>
          <Button title={`Target ${row * 4 + column + 1}`} onPress={() => {}} />
        </View>)}
      </View>)}
  </View>;
  return <View style={styles.screen}>
    <Text>Mounted validation: {mode}; 8 targets; native timing required</Text>
    <View style={styles.controls}>
      <Button title="Native baseline" disabled={scheduled} onPress={() => setMode('native')} />
      <Button title="Library 5.2.0" disabled={scheduled} onPress={() => setMode('library')} />
      <Button title="Itar" disabled={scheduled} onPress={() => setMode('itar')} />
      {[0, 750, 2000].map(duration => <Button key={duration} title={`Schedule ${duration}ms JS load`}
        disabled={scheduled} onPress={() => schedule(duration)} />)}
    </View>
    {mode === 'library' ? <ComparisonLibrary /> : mode === 'itar' ? <FocusProvider key="itar" style={styles.grid}>
      <FocusScope id="validation" layout="column" style={styles.grid}>{grid}</FocusScope>
    </FocusProvider> : grid}
    <Text>Focus the first target before load. Alternate Right/Left 20 times with the same remote cadence.</Text>
    <Text>New rendering, React visuals and activation callbacks are outside this mounted-only scenario.</Text>
  </View>;
}
const styles = StyleSheet.create({
  screen: {flex: 1, gap: 12}, controls: {flexDirection: 'row', flexWrap: 'wrap', gap: 8},
  grid: {width: 760, height: 180}, row: {height: 80, flexDirection: 'row', gap: 12},
  card: {width: 170, height: 72, justifyContent: 'center'},
});
