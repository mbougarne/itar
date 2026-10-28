import React, {useState} from 'react';
import {ScrollView, Text, View} from 'react-native';
import {FocusScope, occurrenceKey} from 'itar/react';
import {cast, type Film} from './catalog';
import {Action, Artwork, Header, css} from './ui';
export default function Details({film, onBack, highContrast}: {film: Film; onBack: () => void; highContrast: boolean}) {
  const [person, setPerson] = useState<typeof cast[number] | null>(null);
  return <ScrollView removeClippedSubviews={false} style={css.viewport}>
    <View style={css.hero}><Artwork film={film} poster /><View style={css.fill}>
      <Text style={css.title}>{film.title}</Text>
      <Text style={css.footer}>{film.year} · {film.category} · {film.kind === 'movie' ? 'Movie' : 'Series'}</Text>
      <Text style={css.body}>{film.synopsis}</Text>
      <Text style={css.footer}>Fictional metadata only. No video is attached.</Text>
      <Action id={occurrenceKey('details', 'back')} label="Back to catalogue" onPress={onBack} highContrast={highContrast} />
    </View></View>
    <Header>Cast &amp; crew · fictional people</Header>
    <FocusScope id="cast" layout="row" boundary="parent" style={css.row}>
      {cast.map(member => <View key={member.id} style={css.fill}>
        <Action id={occurrenceKey('details', film.id, 'cast', member.id)} label={member.name}
          onPress={() => setPerson(member)} highContrast={highContrast} />
        <Text style={css.footer}>{member.role}</Text>
      </View>)}
    </FocusScope>
    {person && <View style={css.column}><Header>{person.name}</Header><Text style={css.body}>{person.bio}</Text></View>}
  </ScrollView>;
}
