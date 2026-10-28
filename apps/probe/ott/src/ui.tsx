import React from 'react';
import {Image, StyleSheet, Text, View} from 'react-native';
import {Focusable} from 'itar/react';
import type {Film} from './catalog';
const art = [
  {landscape: require('../assets/0-landscape.png'), poster: require('../assets/0-poster.png')},
  {landscape: require('../assets/1-landscape.png'), poster: require('../assets/1-poster.png')},
  {landscape: require('../assets/2-landscape.png'), poster: require('../assets/2-poster.png')},
  {landscape: require('../assets/3-landscape.png'), poster: require('../assets/3-poster.png')},
  {landscape: require('../assets/4-landscape.png'), poster: require('../assets/4-poster.png')},
  {landscape: require('../assets/5-landscape.png'), poster: require('../assets/5-poster.png')},
  {landscape: require('../assets/6-landscape.png'), poster: require('../assets/6-poster.png')},
  {landscape: require('../assets/7-landscape.png'), poster: require('../assets/7-poster.png')},
];
export const css = StyleSheet.create({
  screen: {flex: 1, backgroundColor: '#0d141d', padding: 28},
  white: {color: '#f4eee4'}, muted: {color: '#bdc8d3'}, title: {color: '#f4eee4', fontSize: 28, fontWeight: '700'},
  heading: {color: '#f4eee4', fontSize: 21, fontWeight: '600', marginVertical: 10},
  body: {color: '#bdc8d3', fontSize: 17, lineHeight: 25},
  row: {flexDirection: 'row', gap: 12}, column: {gap: 12}, fill: {flex: 1},
  button: {height: 48, minWidth: 116, backgroundColor: '#1d2c3c', borderRadius: 6},
  landscape: {width: 230, height: 128, borderRadius: 6}, poster: {width: 154, height: 216, borderRadius: 6},
  landscapeCard: {width: 230, gap: 5, marginRight: 16}, posterCard: {width: 154, gap: 5, marginRight: 16},
  hero: {flexDirection: 'row', gap: 24, paddingVertical: 16}, heroArt: {width: 320, height: 180},
  hidden: {position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, opacity: 0},
  viewport: {flex: 1}, textEntry: {color: '#f4eee4', fontSize: 24, paddingVertical: 8},
  key: {width: 82, height: 42, backgroundColor: '#1d2c3c'}, keyboard: {gap: 5},
  footer: {color: '#bdc8d3', fontSize: 13, marginVertical: 8},
});
const accents = {gold: {accentColor: '#ffd58a'}, white: {accentColor: '#ffffff'}};
export function Action({id, label, onPress, enabled = true, highContrast = false, compact = false, contentId}: {
  id: string; label: string; onPress: () => void; enabled?: boolean; highContrast?: boolean; compact?: boolean; contentId?: string;
}) {
  return <Focusable occurrenceKey={id} contentId={contentId} accessibilityLabel={label} enabled={enabled} onPress={onPress}
    baseAccentColor="#bdc8d3" focusStyle={highContrast ? accents.white : accents.gold}
    style={compact ? css.key : css.button} />;
}
export function Artwork({film, poster = false}: {film: Film; poster?: boolean}) {
  return <Image accessible={false} source={art[film.art][poster ? 'poster' : 'landscape']} style={poster ? css.poster : css.landscape} />;
}
export function Header({children}: {children: React.ReactNode}) {
  return <Text accessibilityRole="header" style={css.heading}>{children}</Text>;
}
export function Card({film, id, poster, onPress, highContrast}: {
  film: Film; id: string; poster: boolean; onPress: () => void; highContrast: boolean;
}) {
  return <View style={poster ? css.posterCard : css.landscapeCard}>
    <Artwork film={film} poster={poster} />
    <Action id={id} contentId={film.id} label={film.title} onPress={onPress} highContrast={highContrast} />
    <Text style={css.muted}>{film.year} · {film.kind === 'movie' ? 'Movie' : 'Series'}</Text>
  </View>;
}
