import React from 'react';
import { View } from 'react-native';
import {
  FocusProvider,
  FocusScope,
  Focusable,
  occurrenceKey,
} from '@bougarnem/itar/react';
import { columns, gridStyles, rows, targetLabel } from './validation-grid';

const focusStyle = { accentColor: '#ff8800' };

export function ItarValidationGrid() {
  return (
    <FocusProvider style={gridStyles.grid}>
      <FocusScope id="validation" layout="column" style={gridStyles.grid}>
        <View style={gridStyles.grid}>
          {rows.map(row => (
            <FocusScope
              key={row}
              id={`row-${row}`}
              layout="row"
              style={gridStyles.row}
            >
              {columns.map(column => (
                <Focusable
                  key={column}
                  occurrenceKey={occurrenceKey(
                    'validation',
                    String(row),
                    String(column),
                  )}
                  accessibilityLabel={targetLabel(row, column)}
                  order={column}
                  focusStyle={focusStyle}
                  baseAccentColor="#222222"
                  style={gridStyles.card}
                />
              ))}
            </FocusScope>
          ))}
        </View>
      </FocusScope>
    </FocusProvider>
  );
}
