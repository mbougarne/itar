import React, { useState } from 'react';
import { Button, Platform, StyleSheet, Text, View } from 'react-native';
import { AppleHostProbe } from './diagnostics/AppleHostProbe';
import { blockJavaScript } from './diagnostics/blockJavaScript';
import { packageStage } from '@bougarnem/itar';
import AndroidAdapterScreen from './AndroidAdapterScreen';
import AppleAdapterScreen from './AppleAdapterScreen';
import ReactApiScreen from './ReactApiScreen';
import VirtualizedScreen from './VirtualizedScreen';
import ValidationScreen from './ValidationScreen';

const screens = {
  validation: ValidationScreen,
  virtualized: VirtualizedScreen,
  reactApi: ReactApiScreen,
  appleAdapter: AppleAdapterScreen,
};

export default function ProbeApp() {
  const [showB, setShowB] = useState(true);
  const [activation, setActivation] = useState('None');
  const [screen, setScreen] = useState<keyof typeof screens | null>(null);

  if (screen !== null) {
    const Screen = screens[screen];

    return (
      <View style={styles.screen}>
        <Button
          title={
            screen === 'appleAdapter'
              ? 'Return to host probes'
              : 'Return to carrier probes'
          }
          onPress={() => setScreen(null)}
        />
        <Screen />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>
        Itar:{' '}
        {Platform.OS === 'android' ? 'Android adapter preview' : packageStage}
      </Text>
      {Platform.OS !== 'android' && (
        <Text>Native adapter work; unrun acceptance remains explicit.</Text>
      )}
      {Platform.OS === 'android' && <AndroidAdapterScreen />}
      <Button
        title="Release validation"
        onPress={() => setScreen('validation')}
      />
      <Button title="React API preview" onPress={() => setScreen('reactApi')} />
      <Button
        title="Virtualized list preview"
        onPress={() => setScreen('virtualized')}
      />
      {Platform.OS === 'ios' && (
        <Button
          title="Apple adapter preview"
          onPress={() => setScreen('appleAdapter')}
        />
      )}
      {AppleHostProbe && (
        <>
          <Button
            title="Busy JS for 2 seconds"
            onPress={() => {
              console.info('ItarProbe JS busy start');

              blockJavaScript(2000);

              console.info('ItarProbe JS busy end');
            }}
          />
          <AppleHostProbe
            style={styles.nativeProbe}
            onNativeActivation={event =>
              setActivation(
                event.nativeEvent.targetAlias ?? event.nativeEvent.target,
              )
            }
          />
        </>
      )}
      {!AppleHostProbe && Platform.OS !== 'android' && (
        <>
          <View style={styles.row}>
            <View style={styles.column}>
              <View style={styles.slot}>
                {showB && (
                  <Button
                    title="B: destination"
                    accessibilityLabel="B: destination"
                    onPress={() => setActivation('B')}
                  />
                )}
              </View>
              <Button
                title="A: source"
                accessibilityLabel="A: source"
                onPress={() => setActivation('A')}
              />
            </View>
            <Button
              title="D: unrelated control"
              accessibilityLabel="D: unrelated control"
              onPress={() => setActivation('D')}
            />
          </View>
          <Button
            title={showB ? 'Hide B' : 'Mount B'}
            onPress={() => setShowB(!showB)}
          />
        </>
      )}
      {Platform.OS !== 'android' && (
        <Text>Last JS activation: {activation}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  nativeProbe: { height: Platform.OS === 'ios' ? 300 : 220, width: 700 },
  screen: {
    flex: 1,
    padding: Platform.OS === 'android' ? 16 : 60,
    gap: Platform.OS === 'android' ? 8 : 24,
    backgroundColor: '#eeeeee',
  },
  title: { fontSize: Platform.OS === 'android' ? 22 : 32, color: '#111111' },
  row: { flexDirection: 'row', gap: 80, alignItems: 'flex-end' },
  column: { width: 280, gap: 24 },
  slot: { height: 70, justifyContent: 'center' },
});
