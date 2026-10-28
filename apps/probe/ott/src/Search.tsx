import React, {useEffect, useState} from 'react';
import {Text, View} from 'react-native';
import {FocusScope, occurrenceKey} from 'itar/react';
import Browse from './Browse';
import {Action, css} from './ui';
import type {Film} from './catalog';
const letters = ['ABCDEFG', 'HIJKLMN', 'OPQRSTU', 'VWXYZ'];
export default function Search({id, active, delay, failNext, highContrast, onOpen}: {
  id: string; active: boolean; delay: number; failNext: () => boolean; highContrast: boolean; onOpen: (film: Film) => void;
}) {
  const [text, setText] = useState('');
  const [query, setQuery] = useState('');
  useEffect(() => { const timer = setTimeout(() => setQuery(text), 250); return () => clearTimeout(timer); }, [text]);
  return <View style={css.fill}>
    <Text style={css.textEntry}>Search: {text || 'Choose letters below'}{text.length === 36 ? ' (maximum length)' : ''}</Text>
    <FocusScope id="keyboard" layout="column" boundary="parent" style={css.keyboard}>
      {letters.map((row, index) => <FocusScope key={row} id={`keys-${index}`} layout="row" boundary="parent" style={css.row}>
        {Array.from(row).map(letter => <Action key={letter} compact id={occurrenceKey(id, 'key', letter)} label={letter}
          onPress={() => setText(value => (value + letter).slice(0, 36))} highContrast={highContrast} />)}
      </FocusScope>)}
      <FocusScope id="editing" layout="row" boundary="parent" style={css.row}>
        <Action id={occurrenceKey(id, 'space')} label="Space" onPress={() => setText(value => (value + ' ').slice(0, 36))} highContrast={highContrast} />
        <Action id={occurrenceKey(id, 'delete')} label="Delete letter" enabled={!!text} onPress={() => setText(value => Array.from(value).slice(0, -1).join(''))} highContrast={highContrast} />
        <Action id={occurrenceKey(id, 'clear')} label="Clear search" enabled={!!text} onPress={() => setText('')} highContrast={highContrast} />
      </FocusScope>
    </FocusScope>
    {query.trim() ? <Browse id={id} kind="all" query={query} active={active} delay={delay} failNext={failNext} highContrast={highContrast} onOpen={onOpen} />
      : <Text style={css.footer}>Search local fictional titles and genres. This is not a live service.</Text>}
  </View>;
}
