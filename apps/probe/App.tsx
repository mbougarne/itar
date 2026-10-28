import React, {useState} from 'react';
import {Button, StyleSheet, View} from 'react-native';
import OttApp from './ott/App';
import ProbeApp from './ProbeApp';

export default function App() {
  const [probes, setProbes] = useState(false);
  if (__DEV__ && probes) {
    return <View style={styles.screen}>
      <Button title="Return to Itar Cinema" onPress={() => setProbes(false)} />
      <ProbeApp />
    </View>;
  }
  return <OttApp onOpenProbes={__DEV__ ? () => setProbes(true) : undefined} />;
}
const styles = StyleSheet.create({screen: {flex: 1}});
