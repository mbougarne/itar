import React from 'react';
import { Platform, Text, View } from 'react-native';
import { useDesign } from '../theme';

export function CatalogueFeedback({
  searchResults,
  landscapeWidth,
  error,
  ended,
  limitReached,
  initial,
  pending,
}: {
  searchResults: boolean;
  landscapeWidth: number;
  error: string;
  ended: boolean;
  limitReached: boolean;
  initial: boolean;
  pending: boolean;
}) {
  const { s, u } = useDesign();

  return (
    <View style={[s.feedback, { height: (searchResults ? 116 : 270) * u }]}>
      {!!error && Platform.OS !== 'web' && (
        <>
          <Text numberOfLines={1} style={s.heading}>
            {initial ? 'Couldn’t load stories' : 'Couldn’t load more stories'}
          </Text>
          <Text numberOfLines={2} style={s.muted}>
            {error}
          </Text>
        </>
      )}
      {pending && (
        <>
          {!searchResults && (
            <View style={s.loadingRow}>
              {[0, 1, 2].map(key => (
                <View
                  key={key}
                  style={[
                    s.skeleton,
                    {
                      width: landscapeWidth,
                      height: (landscapeWidth * 9) / 16,
                      borderRadius: 8 * u,
                    },
                  ]}
                />
              ))}
            </View>
          )}
          <Text style={s.muted}>
            {searchResults ? 'Searching stories…' : 'Loading stories…'}
          </Text>
        </>
      )}
      {!pending && !error && initial && (
        <>
          <Text style={s.heading}>No matching stories</Text>
          <Text style={s.muted}>Try a different title or genre.</Text>
        </>
      )}
      {!pending && !error && !initial && (
        <Text style={s.body}>
          {limitReached
            ? 'Continue browsing the next selection'
            : ended
            ? 'End of this catalogue'
            : 'More stories are available'}
        </Text>
      )}
    </View>
  );
}
