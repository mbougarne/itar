import React from 'react';
import { StyleSheet, Text, TVFocusGuideView, View } from 'react-native';
import {
  DefaultFocus,
  SpatialNavigationDeviceTypeProvider,
  SpatialNavigationFocusableView,
  SpatialNavigationRoot,
  SpatialNavigationView,
} from 'react-tv-space-navigation';

import { useComparisonRemote } from './diagnostics/useComparisonRemote';
import {
  columns,
  rows,
  gridStyles,
  targetLabel,
} from './diagnostics/validation-grid';

// Pinned comparison only: one trapped native focus anchor receives remote keys;
// the library chooses logical destinations and renders its focus highlight in JS.
export default function ComparisonLibrary() {
  useComparisonRemote();

  return (
    <TVFocusGuideView
      trapFocusLeft
      trapFocusRight
      trapFocusUp
      trapFocusDown
      autoFocus
      style={gridStyles.grid}
    >
      <View
        focusable
        hasTVPreferredFocus
        accessible={false}
        style={gridStyles.grid}
      >
        <SpatialNavigationDeviceTypeProvider>
          <SpatialNavigationRoot>
            <DefaultFocus>
              <SpatialNavigationView
                direction="vertical"
                style={gridStyles.grid}
              >
                {rows.map(row => (
                  <SpatialNavigationView
                    key={row}
                    direction="horizontal"
                    style={gridStyles.row}
                  >
                    {columns.map(column => (
                      <SpatialNavigationFocusableView
                        key={column}
                        style={gridStyles.card}
                        viewProps={{ focusable: false, accessible: false }}
                      >
                        {({ isFocused }) => (
                          <Text
                            style={[styles.label, isFocused && styles.selected]}
                          >
                            {targetLabel(row, column)}
                          </Text>
                        )}
                      </SpatialNavigationFocusableView>
                    ))}
                  </SpatialNavigationView>
                ))}
              </SpatialNavigationView>
            </DefaultFocus>
          </SpatialNavigationRoot>
        </SpatialNavigationDeviceTypeProvider>
      </View>
    </TVFocusGuideView>
  );
}

const styles = StyleSheet.create({
  label: { color: '#222222', borderWidth: 1, padding: 8 },
  selected: { color: '#ff8800', borderWidth: 5 },
});
