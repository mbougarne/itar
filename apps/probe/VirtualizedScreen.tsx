import React from 'react';
import { StyleSheet } from 'react-native';
import { FocusProvider } from 'itar/react';
import { VirtualizedDemo } from './diagnostics/VirtualizedDemo';

export default function VirtualizedScreen() {
  return (
    <FocusProvider style={styles.surface} testID="virtualized-surface">
      <VirtualizedDemo />
    </FocusProvider>
  );
}

const styles = StyleSheet.create({
  surface: { flex: 1 },
});
