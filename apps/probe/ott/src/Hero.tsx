import React, {useEffect, useState} from 'react';
import {Text, View} from 'react-native';
import {FocusScope, occurrenceKey} from 'itar/react';
import type {Film} from './catalog';
import {fetchDetails} from './tmdb';
import {Action} from './ui';
import {useDesign} from './theme';
export function Metadata({film}: {film: Film}) {
  const {s} = useDesign();
  const values = [film.year || '', film.kind === 'series' ? 'Series' : 'Movie', film.runtime ? `${film.runtime} min` : '',
    film.rating !== undefined && film.votes ? `★ ${film.rating.toFixed(1)} / 10` : '',
    film.certification ? `${film.certification} (${film.certificationRegion})` : 'Age rating unavailable'];
  return <View style={s.badges}>{values.filter(Boolean).map(value => <Text key={value} style={s.badge}>{value}</Text>)}</View>;
}
export default function Hero({film, id, onOpen, highContrast, onGuide}: {onGuide?: () => void; film: Film; id: string; onOpen: (film: Film) => void; highContrast: boolean}) {
  const {s} = useDesign();const [details, setDetails] = useState(film);
  useEffect(() => {
    setDetails(film);
    if (!film.source) { return; }
    const request = new AbortController();
    fetchDetails(film, request.signal).then(result => { if (!request.signal.aborted) { setDetails(result.film); } }, () => {});
    return () => request.abort();
  }, [film]);
  return <View style={s.homeHero}>
    <View style={s.heroCopy}>
      <Text style={s.eyebrow}>THE WEEK’S SPOTLIGHT</Text>
      <Text numberOfLines={2} style={s.heroTitle}>{details.title}</Text>
      <Metadata film={details} />
      <Text style={s.muted}>{details.category}</Text>
      <Text numberOfLines={3} style={s.body}>{details.synopsis}</Text>
      <FocusScope id="hero-actions" layout="row" boundary="parent" style={s.heroActions}>
        <Action id={occurrenceKey(id, 'hero', film.id)} label="Explore title" onPress={() => onOpen(details)} highContrast={highContrast} style={s.primaryCta} />
        {onGuide && <Action order={1} id={occurrenceKey(id, 'hero-guide')} label="TV guide" onPress={onGuide} highContrast={highContrast} style={s.primaryCta} />}
      </FocusScope>
    </View>
  </View>;
}
