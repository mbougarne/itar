import React, {useState} from 'react';
import {Button, StyleSheet, Text, View} from 'react-native';
import {packageStage} from 'itar';

// Host controls only. Native probes add observations and ownership later.
export default function App() {
  const [showB, setShowB] = useState(true);
  const [activation, setActivation] = useState('None');
  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Itar: {packageStage}</Text>
      <Text>Host navigation only; Itar adapters are not installed.</Text>
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
      <Text>Last JS activation: {activation}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {flex: 1, padding: 60, gap: 24, backgroundColor: '#eeeeee'},
  title: {fontSize: 32, color: '#111111'},
  row: {flexDirection: 'row', gap: 80, alignItems: 'flex-end'},
  column: {width: 280, gap: 24},
  slot: {height: 70, justifyContent: 'center'},
});
