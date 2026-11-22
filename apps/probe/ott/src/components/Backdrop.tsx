import React, { useState } from 'react';
import { Image, View } from 'react-native';
import { art } from '../artwork';
import type { Film } from '../catalog-types';
import { useDesign } from '../theme';

export function Backdrop({
  film,
  catalogueFilm,
  details = false,
  highContrast = false,
}: {
  film: Film;
  catalogueFilm?: Film;
  details?: boolean;
  highContrast?: boolean;
}) {
  const { s } = useDesign();
  const [failedUrls, setFailedUrls] = useState<readonly string[]>([]);

  // The details response can omit an image that was present in the catalogue.
  const uri = [
    film.backdropUrl,
    catalogueFilm?.backdropUrl,
    film.posterUrl,
    catalogueFilm?.posterUrl,
  ].find(url => url && !failedUrls.includes(url));

  const source = film.source ? (uri ? { uri } : undefined) : art[film.art];

  return (
    <View pointerEvents="none" accessible={false} style={s.backdrop}>
      {source && (
        <Image
          key={uri}
          accessible={false}
          source={source}
          style={s.heroImage}
          resizeMode="cover"
          onError={
            uri
              ? () =>
                  setFailedUrls(previous =>
                    previous.includes(uri) ? previous : [...previous, uri],
                  )
              : undefined
          }
        />
      )}
      <Image
        accessible={false}
        source={require('../../assets/cinematic/scrim.png')}
        style={[s.scrim, details && !highContrast && s.detailScrim]}
        resizeMode="stretch"
      />
    </View>
  );
}
