import React from 'react';
import { Image, View } from 'react-native';
import { filmArtwork } from '../artwork';
import type { Film } from '../catalog-types';
import { useDesign } from '../theme';

export function Backdrop({
  film,
  details = false,
}: {
  film: Film;
  details?: boolean;
}) {
  const { s } = useDesign();
  const source = filmArtwork(film);

  return (
    <View pointerEvents="none" accessible={false} style={s.backdrop}>
      {source && (
        <Image
          accessible={false}
          source={source}
          style={s.heroImage}
          resizeMode="cover"
        />
      )}
      <Image
        accessible={false}
        source={require('../../assets/cinematic/scrim.png')}
        style={s.scrim}
        resizeMode="stretch"
      />
      {details && <View style={s.detailShade} />}
    </View>
  );
}
