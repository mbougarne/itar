import React, {useState} from 'react';
import {Button, Platform, requireNativeComponent, StyleSheet, Text, View, type ViewProps, type NativeSyntheticEvent} from 'react-native';
import {packageStage} from 'itar';
import AndroidAdapterScreen from './AndroidAdapterScreen';
import AppleAdapterScreen from './AppleAdapterScreen';
import ReactApiScreen from './ReactApiScreen';
import VirtualizedScreen from './VirtualizedScreen';
import ValidationScreen from './ValidationScreen';

const HostProbe = Platform.OS === 'ios' ? requireNativeComponent<ViewProps & {
  onNativeActivation: (event: NativeSyntheticEvent<{target: string; targetAlias?: string}>) => void;
}>('ItarAppleProbe') : null;
export default function App() {
  const [showB, setShowB] = useState(true);
  const [activation, setActivation] = useState('None');
  const [appleAdapter, setAppleAdapter] = useState(false);
  const [reactApi, setReactApi] = useState(false);
  const [virtualized, setVirtualized] = useState(false);
  const [validation, setValidation] = useState(false);
  if (validation) {
    return <View style={styles.screen}>
      <Button title="Return to carrier probes" onPress={() => setValidation(false)} />
      <ValidationScreen />
    </View>;
  }
  if (virtualized) {
    return <View style={styles.screen}>
      <Button title="Return to carrier probes" onPress={() => setVirtualized(false)} />
      <VirtualizedScreen />
    </View>;
  }
  if (reactApi) {
    return <View style={styles.screen}>
      <Button title="Return to carrier probes" onPress={() => setReactApi(false)} />
      <ReactApiScreen />
    </View>;
  }
  if (Platform.OS === 'ios' && appleAdapter) {
    return <View style={styles.screen}>
      <Button title="Return to host probes" onPress={() => setAppleAdapter(false)} />
      <AppleAdapterScreen />
    </View>;
  }
  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Itar: {Platform.OS === 'android' ? 'Android adapter preview' : packageStage}</Text>
      {Platform.OS !== 'android' && <Text>Native adapter work; unrun acceptance remains explicit.</Text>}
      {Platform.OS === 'android' && <AndroidAdapterScreen />}
      <Button title="Release validation" onPress={() => setValidation(true)} />
      <Button title="React API preview" onPress={() => setReactApi(true)} />
      <Button title="Virtualized list preview" onPress={() => setVirtualized(true)} />
      {Platform.OS === 'ios' && <Button title="Apple adapter preview" onPress={() => setAppleAdapter(true)} />}
      {HostProbe && <>
        <Button title="Busy JS for 2 seconds" onPress={() => {
          console.info("ItarProbe JS busy start");
          const end = Date.now() + 2000;
          while (Date.now() < end) { /* Bounded deliberate probe load. */ }
          console.info("ItarProbe JS busy end");
        }} />
        <HostProbe style={styles.nativeProbe}
          onNativeActivation={event => setActivation(event.nativeEvent.targetAlias ?? event.nativeEvent.target)} />
      </>}
      {!HostProbe && Platform.OS !== 'android' && <>
      <View style={styles.row}>
        <View style={styles.column}>
          <View style={styles.slot}>
            {showB && (
              <Button title="B: destination" accessibilityLabel="B: destination"
                onPress={() => setActivation('B')} />
            )}
          </View>
          <Button title="A: source" accessibilityLabel="A: source"
            onPress={() => setActivation('A')} />
        </View>
        <Button title="D: unrelated control" accessibilityLabel="D: unrelated control"
          onPress={() => setActivation('D')} />
      </View>
      <Button title={showB ? 'Hide B' : 'Mount B'} onPress={() => setShowB(!showB)} />
      </>}
      {Platform.OS !== 'android' && <Text>Last JS activation: {activation}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  nativeProbe: {height: Platform.OS === 'ios' ? 300 : 220, width: 700},
  screen: {flex: 1, padding: Platform.OS === 'android' ? 16 : 60, gap: Platform.OS === 'android' ? 8 : 24, backgroundColor: '#eeeeee'},
  title: {fontSize: Platform.OS === 'android' ? 22 : 32, color: '#111111'},
  row: {flexDirection: 'row', gap: 80, alignItems: 'flex-end'},
  column: {width: 280, gap: 24},
  slot: {height: 70, justifyContent: 'center'},
});
