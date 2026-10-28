import React, {useEffect, useMemo} from 'react';
import {ScrollView, Text, View} from 'react-native';
import {FocusScope, occurrenceKey, useFocusState} from 'itar/react';
import {hero, type Film, type Kind} from './catalog';
import {useCatalogue} from './useCatalogue';
import {Action, Artwork, Card, Header, css} from './ui';
export default function Browse({id, kind, query = '', active, delay, failNext, onOpen, highContrast, featured = false}: {
  id: string; kind: Kind; query?: string; active: boolean; delay: number; failNext: () => boolean;
  onOpen: (film: Film) => void; highContrast: boolean; featured?: boolean;
}) {
  const {state, loadMore, reload} = useCatalogue(kind, query, delay, failNext);
  const observed = useFocusState();
  const lastKeys = useMemo(() => {
    const last = state.rows[state.rows.length - 1];
    return new Set(last?.entries.slice(-2).map(film => occurrenceKey(id, last.id, film.id)));
  }, [id, state.rows]);
  useEffect(() => {
    if (active && !state.error && observed.kind === 'managed' && observed.occurrenceKey && lastKeys.has(observed.occurrenceKey)) { loadMore(); }
  }, [active, state.error, observed, lastKeys, loadMore]);
  return <ScrollView style={css.viewport} removeClippedSubviews={false} scrollEnabled={active}
    scrollEventThrottle={100} onScroll={({nativeEvent: {contentOffset, layoutMeasurement, contentSize}}) => {
      if (active && !state.error && contentOffset.y + layoutMeasurement.height >= contentSize.height - 100) { loadMore(); }
    }}>
    {featured && <View style={css.hero}>
      <View style={css.fill}><Text style={css.title}>{hero.title}</Text>
        <Text style={css.body}>{hero.synopsis}</Text>
        <Action id={occurrenceKey(id, 'hero', hero.id)} label="Explore featured story" onPress={() => onOpen(hero)} highContrast={highContrast} />
      </View><Artwork film={hero} />
    </View>}
    {state.rows.map(rail => <FocusScope key={rail.id} id={rail.id} layout="row" boundary="parent">
      <Header>{rail.title} · {rail.format === 'poster' ? 'Posters' : 'Thumbnails'}</Header>
      <ScrollView horizontal removeClippedSubviews={false} scrollEnabled={active}>
        {rail.entries.map(film => <Card key={film.id} film={film} id={occurrenceKey(id, rail.id, film.id)}
          poster={rail.format === 'poster'} onPress={() => onOpen(film)} highContrast={highContrast} />)}
      </ScrollView>
    </FocusScope>)}
    {state.loading && <Text style={css.footer}>Fetching local fixtures… simulated delay {delay} ms</Text>}
    {!!state.error && <Text accessibilityRole="alert" style={css.body}>{state.error}</Text>}
    {!state.loading && !state.error && state.rows.length === 0 && <Text style={css.body}>No fictional titles match this search. Try “Atlas” or “Mystery”.</Text>}
    <Action id={occurrenceKey(id, 'load-more')}
      label={state.error ? 'Retry local fetch' : state.loading ? 'Fetching local fixtures…' : state.ended ? 'Reload local catalogue' : 'Load more stories'}
      onPress={state.ended ? reload : loadMore} highContrast={highContrast} />
    {state.ended && state.rows.length > 0 && <Text style={css.footer}>End of this bounded fixture catalogue · {state.rows.length} rows</Text>}
  </ScrollView>;
}
