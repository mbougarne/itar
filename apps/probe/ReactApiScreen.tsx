import React, { StrictMode } from 'react';
import { StyleSheet } from 'react-native';
import { FocusProvider } from 'itar/react';
import { ReactApiDemo } from './diagnostics/ReactApiDemo';

export default function ReactApiScreen() {
  return (
    <StrictMode>
      <FocusProvider style={styles.provider}>
        <ReactApiDemo />
      </FocusProvider>
    </StrictMode>
  );
}

const styles = StyleSheet.create({
  provider: { flex: 1, width: '100%' },
});
