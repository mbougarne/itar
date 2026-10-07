import React, {useState} from 'react';
import {Button, Platform, requireNativeComponent, StyleSheet, Text, View, type ViewProps, type NativeSyntheticEvent} from 'react-native';
import {packageStage} from 'itar';

const AndroidProbe = Platform.OS === 'android' ? requireNativeComponent<ViewProps & {
  onNativeActivation: (event: NativeSyntheticEvent<{target: string}>) => void;
}>('ItarHostProbe') : null;
export default function App() {
  const [showB, setShowB] = useState(true);
  const [activation, setActivation] = useState('None');
  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Itar: {packageStage}</Text>
      <Text>Probe only; production Itar adapters are not installed.</Text>
      {AndroidProbe && <>
        <Button title="Busy JS for 2 seconds" onPress={() => {
          console.info("ItarProbe JS busy start");
          const end = Date.now() + 2000;
          while (Date.now() < end) { /* Bounded deliberate probe load. */ }
          console.info("ItarProbe JS busy end");
        }} />
        <AndroidProbe style={styles.nativeProbe}
          onNativeActivation={event => setActivation(event.nativeEvent.target)} />
      </>}
      {!AndroidProbe && <>
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
      <Text>Last JS activation: {activation}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  nativeProbe: {height: 220, width: 700},
  screen: {flex: 1, padding: 60, gap: 24, backgroundColor: '#eeeeee'},
  title: {fontSize: 32, color: '#111111'},
  row: {flexDirection: 'row', gap: 80, alignItems: 'flex-end'},
  column: {width: 280, gap: 24},
  slot: {height: 70, justifyContent: 'center'},
});
