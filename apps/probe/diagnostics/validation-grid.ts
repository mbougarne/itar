import { StyleSheet } from 'react-native';

// Every implementation uses the same eight targets and visible card positions.
export const rows = [0, 1];

export const columns = [0, 1, 2, 3];

export const targetLabel = (row: number, column: number) =>
  `Target ${row * columns.length + column + 1}`;

export const gridStyles = StyleSheet.create({
  grid: { width: 760, height: 180 },
  row: { height: 80, flexDirection: 'row', gap: 12 },
  card: { width: 170, height: 72, justifyContent: 'center' },
});
