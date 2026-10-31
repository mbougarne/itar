import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { FocusScope, occurrenceKey } from 'itar/react';
import Browse from './Browse';
import { Action, Header } from './ui';
import { useDesign } from './theme';
import type { ProviderMode } from './tmdb';
import type { Film } from './catalog';

const letters = ['ABCDEFG', 'HIJKLMN', 'OPQRSTU', 'VWXYZ'];

export default function Search({
  id,
  active,
  delay,
  failNext,
  highContrast,
  onOpen,
  mode,
  onReady,
}: {
  onReady?: () => void;
  mode: ProviderMode;
  id: string;
  active: boolean;
  delay: number;
  failNext: () => boolean;
  highContrast: boolean;
  onOpen: (film: Film) => void;
}) {
  const { s } = useDesign();
  const [resultsWidth, setResultsWidth] = useState(0);
  const [text, setText] = useState('');
  const [query, setQuery] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setQuery(text), 250);

    return () => clearTimeout(timer);
  }, [text]);

  return (
    <View style={s.search}>
      <View style={s.keyboardPanel}>
        <View style={s.query}>
          <Text style={s.queryText} numberOfLines={2}>
            {text || 'Choose letters below'}
          </Text>
        </View>
        <FocusScope
          id="keyboard"
          layout="spatial"
          boundary="parent"
          style={s.keyboard}
        >
          {letters.map((row, index) => (
            <FocusScope
              key={row}
              id={`keys-${index}`}
              layout="row"
              boundary="parent"
              style={s.keyboardRow}
            >
              {Array.from(row).map((letter, order) => (
                <Action
                  order={order}
                  key={letter}
                  id={occurrenceKey(id, 'key', letter)}
                  label={letter}
                  style={s.key}
                  onPress={() =>
                    setText(value => (value + letter).slice(0, 36))
                  }
                  highContrast={highContrast}
                />
              ))}
            </FocusScope>
          ))}
          <FocusScope
            id="editing"
            layout="row"
            boundary="parent"
            style={s.keyboardRow}
          >
            <Action
              order={0}
              id={occurrenceKey(id, 'space')}
              label="Space"
              style={s.editAction}
              onPress={() => setText(value => (value + ' ').slice(0, 36))}
              highContrast={highContrast}
            />
            <Action
              order={1}
              id={occurrenceKey(id, 'delete')}
              label="Delete"
              style={s.editAction}
              enabled={!!text}
              onPress={() =>
                setText(value => Array.from(value).slice(0, -1).join(''))
              }
              highContrast={highContrast}
            />
            <Action
              order={2}
              id={occurrenceKey(id, 'clear')}
              label="Clear"
              style={s.editAction}
              enabled={!!text}
              onPress={() => setText('')}
              highContrast={highContrast}
            />
          </FocusScope>
        </FocusScope>
        <Text style={s.footer}>
          {text.length === 36
            ? 'Maximum query length reached (36 characters).'
            : 'Choose letters with your remote.'}
        </Text>
      </View>
      <View
        style={s.searchResults}
        onLayout={event => setResultsWidth(event.nativeEvent.layout.width)}
      >
        <Header>
          {query.trim()
            ? `Results for “${query}”`
            : 'Suggested titles · Discover something new'}
        </Header>
        <Browse
          onReady={onReady}
          viewportWidth={resultsWidth}
          mode={mode}
          id={id}
          kind="all"
          query={query}
          active={active}
          delay={delay}
          failNext={failNext}
          highContrast={highContrast}
          onOpen={onOpen}
          searchResults
        />
      </View>
    </View>
  );
}
