import React from 'react';
import {StyleSheet, Text, TVFocusGuideView, useTVEventHandler, View} from 'react-native';
import {DefaultFocus, SpatialNavigation, SpatialNavigationDeviceTypeProvider,
  SpatialNavigationFocusableView, SpatialNavigationRoot, SpatialNavigationView} from 'react-tv-space-navigation';

type RemoteCallback = Parameters<Parameters<typeof SpatialNavigation.configureRemoteControl>[0]['remoteControlSubscriber']>[0];
const listeners = new Set<RemoteCallback>();
SpatialNavigation.configureRemoteControl({
  remoteControlSubscriber: callback => { listeners.add(callback); return callback; },
  remoteControlUnsubscriber: (subscriber: unknown) => {
    for (const callback of listeners) { if (callback === subscriber) { listeners.delete(callback); } }
  },
});
// Pinned comparison only: one trapped native focus anchor receives remote keys;
// the library chooses logical destinations and renders its focus highlight in JS.
export default function ComparisonLibrary() {
  useTVEventHandler(event => {
    if (event.eventKeyAction === 1) { return; }
    const direction = event.eventType;
    if (direction === 'left' || direction === 'right' || direction === 'up' || direction === 'down') {
      for (const listener of listeners) { listener(direction); }
    }
  });
  return <TVFocusGuideView trapFocusLeft trapFocusRight trapFocusUp trapFocusDown autoFocus style={styles.grid}>
    <View focusable hasTVPreferredFocus accessible={false} style={styles.grid}>
      <SpatialNavigationDeviceTypeProvider><SpatialNavigationRoot>
        <DefaultFocus><SpatialNavigationView direction="vertical" style={styles.grid}>
          {[0, 1].map(row => <SpatialNavigationView key={row} direction="horizontal" style={styles.row}>
            {[0, 1, 2, 3].map(column => <SpatialNavigationFocusableView key={column} style={styles.card}
              viewProps={{focusable: false, accessible: false}}>
              {({isFocused}) => <Text style={[styles.label, isFocused && styles.selected]}>
                Target {row * 4 + column + 1}
              </Text>}
            </SpatialNavigationFocusableView>)}
          </SpatialNavigationView>)}
        </SpatialNavigationView></DefaultFocus>
      </SpatialNavigationRoot></SpatialNavigationDeviceTypeProvider>
    </View>
  </TVFocusGuideView>;
}
const styles = StyleSheet.create({
  grid: {width: 760, height: 180}, row: {height: 80, flexDirection: 'row', gap: 12},
  card: {width: 170, height: 72, justifyContent: 'center'},
  label: {color: '#222222', borderWidth: 1, padding: 8}, selected: {color: '#ff8800', borderWidth: 5},
});
