import type React from 'react';
import { StyleSheet } from 'react-native';

export const itemStyles = StyleSheet.create({
  cell: { position: 'absolute', top: 0 },
  overlay: { position: 'absolute', top: 0, left: 0 },
});

export const htmlStyles = {
  horizontal: { overflowX: 'auto', overflowY: 'hidden' },
  vertical: { overflowY: 'auto', overflowX: 'hidden', position: 'relative' },
  relative: { position: 'relative' },
  row: { position: 'absolute', left: 0 },
} satisfies Record<string, React.CSSProperties>;
