import React from 'react';
import { Button, View } from 'react-native';
import { columns, gridStyles, rows, targetLabel } from './validation-grid';

export function NativeValidationGrid() {
  return (
    <View style={gridStyles.grid}>
      {rows.map(row => (
        <View key={row} style={gridStyles.row}>
          {columns.map(column => (
            <View key={column} style={gridStyles.card}>
              <Button title={targetLabel(row, column)} onPress={() => {}} />
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}
