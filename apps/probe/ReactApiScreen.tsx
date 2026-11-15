import React, { StrictMode, useEffect, useRef, useState } from 'react';
import { Button, Image, StyleSheet, Text, View } from 'react-native';
import {
  FocusProvider,
  FocusScope,
  Focusable,
  occurrenceKey,
  useFocusCommands,
  useFocusReady,
  useFocusState,
  useIsFocused,
  useScreenReaderEnabled,
} from 'itar/react';
import type { Activation, FocusRequest } from 'itar/react';

const rails = [
  {
    id: 'rail-a',
    entries: [
      { id: 'entry-1', movie: 'movie-1' },
      { id: 'entry-2', movie: 'movie-2' },
    ],
  },
  {
    id: 'rail-b',
    entries: [
      { id: 'entry-1', movie: 'movie-1' },
      { id: 'entry-2', movie: 'movie-2' },
    ],
  },
];

const keyFor = (rail: string, entry: string) =>
  occurrenceKey('home', rail, entry);

const focusStyle = { accentColor: '#ff8800' };

function FocusStatus() {
  const state = useFocusState();
  const reader = useScreenReaderEnabled();

  return (
    <Text>
      Observed: {state.kind} {state.occurrenceKey ?? ''}; reader:{' '}
      {String(reader)}
    </Text>
  );
}

function SelectedStatus() {
  const selected = useIsFocused(keyFor('rail-b', 'entry-1'));

  return (
    <Text>Rail B first entry: {selected ? 'focused' : 'not focused'}</Text>
  );
}

function Screen() {
  const commands = useFocusCommands();
  const ready = useFocusReady();
  const request = useRef<FocusRequest | null>(null);
  const restore = useRef(false);
  const alive = useRef(true);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [route, setRoute] = useState<'home' | 'details'>('home');
  const [outcome, setOutcome] = useState('None');
  const [activation, setActivation] = useState('None');
  const [count, setCount] = useState(0);
  const [customContent, setCustomContent] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    alive.current = true;

    return () => {
      alive.current = false;
      request.current?.cancel();

      if (timer.current !== null) {
        clearTimeout(timer.current);
      }
    };
  }, []);

  const follow = (next: FocusRequest) => {
    request.current = next;
    setOutcome(`pending ${next.command}`);

    next.result.then(value => {
      if (alive.current && request.current === next) {
        setOutcome(`${value.status}: ${value.reason}`);
      }
    });
  };

  useEffect(() => {
    if (route === 'home' && ready && restore.current) {
      restore.current = false;

      // Native history chooses the opener; no JS-side global focus service.
      const next = commands.restoreScope(['home']);

      request.current = next;

      next.result.then(value => {
        if (alive.current) {
          setOutcome(`${value.status}: ${value.reason}`);
        }
      });
    }
  }, [route, ready, commands]);

  const pressed = (value: Activation) => {
    setActivation(
      `${value.contentId} at ${value.occurrenceKey} (${value.source})`,
    );

    setCount(current => current + 1);
  };

  return (
    <View style={styles.screen}>
      <View style={styles.controls}>
        <Button
          title={customContent ? 'Use label card' : 'Use custom card'}
          onPress={() => setCustomContent(!customContent)}
        />
        <Button
          title="Focus rail B"
          disabled={!ready}
          onPress={() =>
            follow(commands.focusByKey(keyFor('rail-b', 'entry-1')))
          }
        />
        <Button
          title="Cancel request"
          onPress={() => request.current?.cancel()}
        />
        <Button
          title="Open owned dialog"
          disabled={!ready}
          onPress={commands.showDialog}
        />
        <Button
          title={route === 'home' ? 'Details route' : 'Return home'}
          onPress={() => {
            if (route === 'details') {
              restore.current = true;
            }

            setRoute(route === 'home' ? 'details' : 'home');
          }}
        />
        <Button
          title={busy ? 'JS block scheduled' : 'Block JS after 1 second'}
          disabled={busy}
          onPress={() => {
            setBusy(true);

            timer.current = setTimeout(() => {
              timer.current = null;

              const end = Date.now() + 2000;

              while (Date.now() < end) {
                /* Bounded busy-JS native-feedback fixture. */
              }

              if (alive.current) {
                setBusy(false);
              }
            }, 1000);
          }}
        />
      </View>
      <FocusScope
        id="home"
        active={route === 'home'}
        layout="column"
        style={route === 'home' ? styles.home : styles.hidden}
      >
        {rails.map(rail => (
          <FocusScope
            key={rail.id}
            id={rail.id}
            layout="row"
            boundary="parent"
            style={styles.rail}
          >
            {rail.entries.map((entry, index) => (
              <Focusable
                key={entry.id}
                occurrenceKey={keyFor(rail.id, entry.id)}
                contentId={entry.movie}
                accessibilityLabel={`${entry.movie}, ${rail.id}`}
                order={index}
                focusStyle={focusStyle}
                baseAccentColor="#222222"
                style={styles.card}
                onPress={pressed}
              >
                {customContent && rail.id === 'rail-a' && index === 0 ? (
                  <View style={styles.customCard}>
                    <Image
                      source={require('./ott/assets/1-landscape.png')}
                      style={styles.customImage}
                    />
                    <Text style={styles.customTitle}>Custom movie card</Text>
                  </View>
                ) : null}
              </Focusable>
            ))}
          </FocusScope>
        ))}
      </FocusScope>
      <FocusScope
        id="details"
        active={route === 'details'}
        style={route === 'details' ? styles.details : styles.hidden}
      >
        <Focusable
          occurrenceKey={occurrenceKey('details', 'play')}
          contentId="movie-1"
          accessibilityLabel="Play movie"
          style={styles.card}
          focusStyle={focusStyle}
          onPress={pressed}
        />
      </FocusScope>
      <FocusStatus />
      <SelectedStatus />
      <Text>Request: {outcome}</Text>
      <Text>
        Activations: {count}; {activation}
      </Text>
    </View>
  );
}

export default function ReactApiScreen() {
  return (
    <StrictMode>
      <FocusProvider style={styles.provider}>
        <Screen />
      </FocusProvider>
    </StrictMode>
  );
}

const styles = StyleSheet.create({
  provider: { flex: 1, width: '100%' },
  screen: { gap: 8 },
  controls: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  home: { width: '100%', gap: 12 },
  rail: { flexDirection: 'row', gap: 20, height: 70 },
  customCard: { flex: 1 },
  customImage: { width: '100%', height: 36 },
  customTitle: { color: 'white', fontSize: 12, lineHeight: 20 },
  card: { width: '45%', height: 64 },
  details: { height: 70 },
  hidden: { position: 'absolute', opacity: 0 },
});
