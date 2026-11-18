import React, { useEffect, useRef, useState } from 'react';
import { Button, StyleSheet, Text, View } from 'react-native';
import { blockJavaScript } from './diagnostics/blockJavaScript';
import { NativeValidationGrid } from './diagnostics/NativeValidationGrid';
import { ItarValidationGrid } from './diagnostics/ItarValidationGrid';
import { ComparisonUnavailable } from './diagnostics/ComparisonUnavailable';

// The pinned comparison bundles React 18 JSX internals. Keep an optional probe
// load failure from preventing the React 19 consumer and other probes starting.
const ComparisonLibrary = React.lazy(() =>
  import('./ComparisonLibrary').catch(() => ({
    default: ComparisonUnavailable,
  })),
);

// Mounted-only comparison. Record input/host/visible timing with native tools;
// JS callbacks cannot timestamp native progress while JS itself is stalled.
export default function ValidationScreen() {
  const [mode, setMode] = useState<'native' | 'itar' | 'library'>('itar');
  const [scheduled, setScheduled] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current !== null) {
        clearTimeout(timer.current);
      }
    },
    [],
  );

  const schedule = (duration: number) => {
    setScheduled(true);

    console.info(
      `ItarValidation mode=${mode} mounted=8 stall_ms=${duration} scheduled_delay_ms=1000`,
    );

    timer.current = setTimeout(() => {
      timer.current = null;

      const elapsed = blockJavaScript(duration);

      console.info(`ItarValidation actual_stall_ms=${elapsed}`);
      setScheduled(false);
    }, 1000);
  };

  return (
    <View style={styles.screen}>
      <Text>Mounted validation: {mode}; 8 targets; native timing required</Text>
      <View style={styles.controls}>
        <Button
          title="Native baseline"
          disabled={scheduled}
          onPress={() => setMode('native')}
        />
        <Button
          title="Library 5.2.0"
          disabled={scheduled}
          onPress={() => setMode('library')}
        />
        <Button
          title="Itar"
          disabled={scheduled}
          onPress={() => setMode('itar')}
        />
        {[0, 750, 2000].map(duration => (
          <Button
            key={duration}
            title={`Schedule ${duration}ms JS load`}
            disabled={scheduled}
            onPress={() => schedule(duration)}
          />
        ))}
      </View>
      {mode === 'library' ? (
        <React.Suspense fallback={<Text>Loading comparison…</Text>}>
          <ComparisonLibrary />
        </React.Suspense>
      ) : mode === 'itar' ? (
        <ItarValidationGrid />
      ) : (
        <NativeValidationGrid />
      )}
      <Text>
        Focus the first target before load. Alternate Right/Left 20 times with
        the same remote cadence.
      </Text>
      <Text>
        New rendering, React visuals and activation callbacks are outside this
        mounted-only scenario.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, gap: 12 },
  controls: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
