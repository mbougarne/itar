import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Button, Platform, StyleSheet, Text, View } from 'react-native';
import {
  FocusProvider,
  FocusScope,
  Focusable,
  FocusVirtualizedList,
  FocusVirtualizedRails,
  occurrenceKey,
  useFocusCommands,
  useFocusState,
  useScreenReaderEnabled,
} from 'itar/react';
import type { FocusRequest, VirtualizedFocusItem } from 'itar/react';

const keyFor = (row: number, item: number) =>
  occurrenceKey('virtualized', `row-${row}`, `entry-${item}`);

function Screen() {
  const commands = useFocusCommands();
  const focus = useFocusState();
  const reader = useScreenReaderEnabled();
  const request = useRef<FocusRequest | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [nested, setNested] = useState(false);
  const [firstEntry, setFirstEntry] = useState(false);
  const [leading, setLeading] = useState(false);
  const [reverse, setReverse] = useState(false);
  const [removed, setRemoved] = useState(false);
  const [active, setActive] = useState(true);
  const [outcome, setOutcome] = useState('None');
  const [activation, setActivation] = useState('None');
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;

    return () => {
      alive.current = false;
      request.current?.cancel();

      if (timer.current) {
        clearTimeout(timer.current);
      }
    };
  }, []);

  const rails = useMemo(
    () =>
      Array.from({ length: 8 }, (_rowValue, row) => {
        const items: VirtualizedFocusItem[] = Array.from(
          { length: row === 0 ? 40 : 12 },
          (_itemValue, item) => ({
            occurrenceKey: keyFor(row, item),
            contentId: `movie-${item % 3}`,
            accessibilityLabel: `Rail ${row + 1}, item ${item + 1}`,
            testID: `virtual-${row}-${item}`,
            focusStyle: { accentColor: '#ff8800' },
            onPress: value => setActivation(value.occurrenceKey),
          }),
        );

        const visible = removed
          ? items.filter(item => item.occurrenceKey !== keyFor(row, 1))
          : items;

        return {
          id: `row-${row}`,
          items: reverse ? [...visible].reverse() : visible,
        };
      }),
    [reverse, removed],
  );

  const follow = (key: string, cancel = false, stall = false) => {
    const next = commands.focusByKey(key);

    request.current = next;
    setOutcome('Pending');

    next.result.then(value => {
      if (alive.current && request.current === next) {
        setOutcome(`${value.status}: ${value.reason}`);
      }
    });

    if (cancel) {
      timer.current = setTimeout(() => next.cancel(), 10);
    }

    if (stall) {
      const end = Date.now() + 750;

      while (Date.now() < end) {
        /* Deliberate bounded reference load. */
      }
    }
  };

  return (
    <View style={styles.content}>
      <Text>
        Observed: {focus.kind} {focus.occurrenceKey ?? ''}; reader:{' '}
        {String(reader)}
      </Text>
      <Text>
        Request: {outcome}; activation: {activation}
      </Text>
      <View style={styles.controls}>
        <Button title="Focus start" onPress={() => follow(keyFor(0, 0))} />
        <Button
          title="Reveal distant item"
          onPress={() => follow(keyFor(nested ? 7 : 0, nested ? 10 : 30))}
        />
        <Button
          title="Cancel delayed reveal"
          onPress={() => follow(keyFor(nested ? 7 : 0, nested ? 10 : 30), true)}
        />
        <Button
          title="Reveal with busy JS"
          onPress={() =>
            follow(keyFor(nested ? 7 : 0, nested ? 10 : 30), false, true)
          }
        />
      </View>
      <View style={styles.controls}>
        <Button
          title={nested ? 'Single list' : 'Nested rails'}
          onPress={() => setNested(!nested)}
        />
        <Button title="Reorder dataset" onPress={() => setReverse(!reverse)} />
        {nested &&
          Platform.isTV &&
          (Platform.OS === 'ios' || Platform.OS === 'android') && (
            <Button
              title={`Row entry: ${firstEntry ? 'first' : 'nearest'}`}
              onPress={() => setFirstEntry(!firstEntry)}
            />
          )}
        <Button
          title={`Horizontal alignment: ${leading ? 'leading' : 'nearest'}`}
          onPress={() => setLeading(!leading)}
        />
        <Button
          title={removed ? 'Restore item 2' : 'Remove item 2'}
          onPress={() => setRemoved(!removed)}
        />
        <Button
          title={active ? 'Suspend route' : 'Resume route'}
          onPress={() => setActive(!active)}
        />
        <Button title="Present dialog" onPress={commands.showDialog} />
      </View>
      <View style={styles.collections}>
        <FocusScope
          id="catalog"
          active={active}
          style={nested ? styles.rails : styles.list}
        >
          {nested ? (
            <FocusVirtualizedRails
              key="rails"
              id="rails"
              rails={rails}
              horizontalAlignment={leading ? 'leading' : 'nearest'}
              rowEntry={firstEntry ? 'first' : 'nearest'}
              itemExtent={160}
              rowExtent={120}
              viewportExtent={680}
              viewportRows={2}
              testID="virtualized-rails"
            />
          ) : (
            <FocusVirtualizedList
              horizontalAlignment={leading ? 'leading' : 'nearest'}
              key="list"
              id="list"
              data={rails[0].items}
              itemExtent={160}
              viewportExtent={680}
              testID="virtualized-list"
            />
          )}
        </FocusScope>
        <Focusable
          occurrenceKey={occurrenceKey('virtualized', 'default')}
          accessibilityLabel="D: unrelated default"
          testID="virtual-default"
          style={styles.defaultTarget}
        />
      </View>
    </View>
  );
}

export default function VirtualizedScreen() {
  return (
    <FocusProvider style={styles.surface} testID="virtualized-surface">
      <Screen />
    </FocusProvider>
  );
}

const styles = StyleSheet.create({
  surface: { flex: 1 },
  content: { gap: 8 },
  controls: { flexDirection: 'row', gap: 12 },
  collections: { flexDirection: 'row', gap: 20 },
  rails: { width: 700, height: 240 },
  list: { width: 700, height: 110 },
  defaultTarget: { width: 200, height: 80 },
});
