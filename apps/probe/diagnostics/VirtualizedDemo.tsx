import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Button, Platform, StyleSheet, Text, View } from 'react-native';
import {
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

import { blockJavaScript } from './blockJavaScript';
import { createVirtualizedRails, virtualizedKey } from './virtualized-data';

export function VirtualizedDemo() {
  const commands = useFocusCommands();
  const focus = useFocusState();
  const reader = useScreenReaderEnabled();
  const request = useRef<FocusRequest | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [nested, setNested] = useState(false);
  const [firstEntry, setFirstEntry] = useState(false);
  const [leading, setLeading] = useState(false);
  const [alternate, setAlternate] = useState(false);
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
    () => createVirtualizedRails(reverse, removed, setActivation),
    [reverse, removed],
  );

  const renderItem = useCallback(
    (item: VirtualizedFocusItem, index: number) => (
      <View style={styles.cardContent}>
        <Text style={styles.cardText}>
          {alternate ? 'Alternate' : 'Card'} {index + 1}
        </Text>
        <Text style={styles.cardText}>{item.accessibilityLabel}</Text>
      </View>
    ),
    [alternate],
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
      blockJavaScript(750);
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
        <Button
          title="Focus start"
          onPress={() => follow(virtualizedKey(0, 0))}
        />
        <Button
          title="Reveal distant item"
          onPress={() =>
            follow(virtualizedKey(nested ? 7 : 0, nested ? 10 : 30))
          }
        />
        <Button
          title="Cancel delayed reveal"
          onPress={() =>
            follow(virtualizedKey(nested ? 7 : 0, nested ? 10 : 30), true)
          }
        />
        <Button
          title="Reveal with busy JS"
          onPress={() =>
            follow(
              virtualizedKey(nested ? 7 : 0, nested ? 10 : 30),
              false,
              true,
            )
          }
        />
      </View>
      <View style={styles.controls}>
        <Button
          title={nested ? 'Single list' : 'Nested rails'}
          onPress={() => setNested(!nested)}
        />
        <Button
          title="Change card content"
          onPress={() => setAlternate(!alternate)}
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
              renderItem={renderItem}
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
              renderItem={renderItem}
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

const styles = StyleSheet.create({
  cardContent: { flex: 1, justifyContent: 'center', padding: 8 },
  cardText: { color: '#F4EEE4', fontSize: 12 },
  content: { gap: 8 },
  controls: { flexDirection: 'row', gap: 12 },
  collections: { flexDirection: 'row', gap: 20 },
  rails: { width: 700, height: 240 },
  list: { width: 700, height: 110 },
  defaultTarget: { width: 200, height: 80 },
});
