import React, { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { FocusScope, occurrenceKey } from 'itar/react';
import { captionAccessible } from './tv-accessibility';
import type { Film } from './catalog-types';
import { cachedDetails, loadDetails } from './detail-data';
import { Action } from './components/Action';
import { Backdrop } from './components/Backdrop';
import { useDesign } from './theme';

import { Metadata } from './components/Metadata';

export default function Hero({
  film,
  id,
  onOpen,
  highContrast,
  onGuide,
}: {
  onGuide?: (openerKey: string) => void;
  film: Film;
  id: string;
  onOpen: (film: Film, openerKey: string) => void;
  highContrast: boolean;
}) {
  const { s } = useDesign();

  const [details, setDetails] = useState(
    () => cachedDetails(film)?.film ?? film,
  );

  useEffect(() => {
    setDetails(cachedDetails(film)?.film ?? film);

    if (!film.source) {
      return;
    }

    const request = new AbortController();

    loadDetails(film, request.signal).then(
      result => {
        if (!request.signal.aborted) {
          setDetails(result.film);
        }
      },
      () => {},
    );

    return () => request.abort();
  }, [film]);

  return (
    <View style={s.homeHero}>
      <Backdrop film={film} />
      <View style={[s.heroCopy, s.homeInset]}>
        <Text accessible={captionAccessible} style={s.eyebrow}>
          THE WEEK’S SPOTLIGHT
        </Text>
        <Text
          accessible={captionAccessible}
          numberOfLines={2}
          style={s.heroTitle}
        >
          {details.title}
        </Text>
        <Metadata film={details} />
        <Text accessible={captionAccessible} style={s.muted}>
          {details.category}
        </Text>
        <Text accessible={captionAccessible} numberOfLines={3} style={s.body}>
          {details.synopsis}
        </Text>
        <FocusScope id="hero-actions" layout="row" boundary="parent">
          <ScrollView
            horizontal
            style={s.heroActionsViewport}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.heroActions}
          >
            <Action
              id={occurrenceKey(id, 'hero', film.id)}
              label="Explore title"
              tvDescription={details.title}
              onPress={() =>
                onOpen(details, occurrenceKey(id, 'hero', film.id))
              }
              highContrast={highContrast}
              style={s.primaryCta}
            />
            {onGuide && (
              <Action
                order={1}
                id={occurrenceKey(id, 'hero-guide')}
                label="TV guide"
                onPress={() => onGuide(occurrenceKey(id, 'hero-guide'))}
                highContrast={highContrast}
                style={s.primaryCta}
              />
            )}
          </ScrollView>
        </FocusScope>
      </View>
    </View>
  );
}
