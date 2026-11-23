import React from 'react';
import { Text, View } from 'react-native';
import { captionAccessible } from '../tv-accessibility';
import type { Film } from '../catalog-types';
import { useDesign } from '../theme';

export function Metadata({ film }: { film: Film }) {
  const { s } = useDesign();

  const values = [
    film.year || '',
    film.kind === 'series' ? 'Series' : 'Movie',
    film.runtime ? `${film.runtime} min` : '',
    film.rating !== undefined && film.votes
      ? `★ ${film.rating.toFixed(1)} / 10`
      : '',
    film.certification
      ? `${film.certification} (${film.certificationRegion})`
      : 'Age rating unavailable',
  ];

  return (
    <View style={s.badges}>
      {values.filter(Boolean).map(value => (
        <Text accessible={captionAccessible} key={value} style={s.badge}>
          {value}
        </Text>
      ))}
    </View>
  );
}
