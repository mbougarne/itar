import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {Text, View, useWindowDimensions} from 'react-native';
import {FocusVirtualizedRails, occurrenceKey, useIsFocused} from 'itar/react';
import type {VirtualizedFocusItem, VirtualizedFocusRail} from 'itar/react';
import {hero, type Film, type Kind} from './catalog';
import {useCatalogue} from './useCatalogue';
import {Backdrop, Picture, filmArtwork} from './ui';
import type {ProviderMode} from './tmdb';
import {useDesign} from './theme';
function EndObserver({id, active, blocked, onEnd}: {id: string; active: boolean; blocked: boolean; onEnd: () => void}) {
  const focused = useIsFocused(id);
  useEffect(() => { if (focused && active && !blocked) { onEnd(); } }, [focused, active, blocked, onEnd]);
  return null;
}
type Visual = {film?: Film; poster?: boolean; hero?: boolean; feedback?: boolean};
export default function Browse({id, kind, query = '', active, delay, failNext, onOpen, highContrast, featured = false, searchResults = false, mode, onReady, viewportWidth}: {
  onReady?: () => void; viewportWidth?: number; mode: ProviderMode; id: string; kind: Kind; query?: string; active: boolean; delay: number;
  failNext: () => boolean; onOpen: (film: Film) => void; highContrast: boolean; featured?: boolean; searchResults?: boolean;
}) {
  const {s, u} = useDesign();
  const {width} = useWindowDimensions();
  const [height, setHeight] = useState(0);
  const {state, loadMore, reload} = useCatalogue(kind, query, delay, failNext, mode);
  const featuredFilm = mode === 'fixture' ? hero : state.rows[0]?.entries[0];
  const initial = state.rows.length === 0;
  const pending = state.loading || (initial && !state.error && !state.ended);
  const viewport = Math.max(200 * u, viewportWidth ?? width - 440 * u);
  const landscapeWidth = Math.min(480 * u, (viewport - 48 * u) / 3);
  const rowExtent = (searchResults ? 300 : 400) * u;
  const headerExtent = 34 * u;
  const last = state.rows[state.rows.length - 1];
  const endKeys = last?.entries.slice(-2).map(film => occurrenceKey(id, last.id, film.id)) ?? [];
  const model = useMemo(() => {
    const visuals = new Map<string, Visual>();
    const accent = {accentColor: highContrast ? '#FFFFFF' : '#26D9F2'};
    const make = (key: string, label: string, onPress: () => void, contentId?: string): VirtualizedFocusItem => ({
      occurrenceKey: key, contentId, accessibilityLabel: label, labelSize: 24 * u,
      baseAccentColor: '#F4EEE4', focusStyle: accent, onPress,
    });
    const rails: VirtualizedFocusRail[] = [];
    const titles = new Map<string, string>();
    if (featured && featuredFilm) {
      const key = occurrenceKey(id, 'hero', featuredFilm.id);visuals.set(key, {film: featuredFilm, hero: true});
      rails.push({id: 'featured-hero', itemExtent: viewport, itemStyle: s.pill,
        items: [make(key, 'Explore story', () => onOpen(featuredFilm), featuredFilm.id)]});
    }
    const rows = [...state.rows];
    if (rows.length >= 4) { [rows[1], rows[2]] = [rows[2], rows[1]]; }
    if (featured && rows.length >= 2) { [rows[0], rows[1]] = [rows[1], rows[0]]; }
    for (const rail of rows) {
      const poster = !searchResults && rail.format === 'poster';
      const cardWidth = poster ? 220 * u : landscapeWidth;
      const imageHeight = poster ? 330 * u : cardWidth * 9 / 16;
      titles.set(rail.id, rail.title);
      rails.push({id: rail.id, overlayTarget: true, itemExtent: cardWidth + 24 * u,
        itemStyle: {width: cardWidth, height: imageHeight + 36 * u, backgroundColor: 'transparent'},
        items: rail.entries.map(film => {
          const key = occurrenceKey(id, rail.id, film.id);visuals.set(key, {film, poster});
          return {...make(key, `${film.title}, ${film.kind === 'movie' ? 'Movie' : 'Series'}`, () => onOpen(film), film.id),
            displayLabel: film.title, labelPlacement: 'bottom', outlineInsetBottom: 36 * u};
        })});
    }
    const key = occurrenceKey(id, 'load-more');visuals.set(key, {feedback: true});
    rails.push({id: 'pagination', itemExtent: viewport, itemStyle: s.pill, items: [make(key,
      state.error ? 'Retry fetch' : pending ? 'Fetching stories…' : state.ended ? 'Reload catalogue' : 'Load more stories', state.ended ? reload : loadMore)]});
    return {rails, visuals, titles};
  }, [id, highContrast, featured, featuredFilm, viewport, u, s.pill, landscapeWidth, state.rows, state.error, state.ended, pending, reload, loadMore, searchResults, onOpen]);
  const decoration = useCallback((item: VirtualizedFocusItem) => {
    const visual = model.visuals.get(item.occurrenceKey);
    if (visual?.hero && visual.film) {
      const film = visual.film;
      return <View style={s.browseHero}><View style={s.heroCopy}><Text style={s.eyebrow}>FEATURED STORY</Text><Text numberOfLines={2} style={s.heroTitle}>{film.title}</Text>
          <Text style={s.body}>{film.year || 'Year unavailable'} / {film.category}</Text><Text numberOfLines={2} style={s.body}>{film.synopsis}</Text></View>
      </View>;
    }
    if (visual?.feedback) {
      return <View style={[s.browseHero, searchResults && {height: 210 * u}]}>
        {!!state.error && <><Text style={s.messageTitle}>{initial ? 'Couldn’t load stories' : 'Couldn’t load more stories'}</Text><Text style={s.body}>{state.error}</Text></>}
        {pending && <><View style={s.loadingRow}>{[0, 1, 2].map(key => <View key={key} style={[s.skeleton, {width: landscapeWidth, height: landscapeWidth * 9 / 16, borderRadius: 8 * u}]} />)}</View><Text style={s.body}>{searchResults ? 'Searching stories…' : 'Loading stories…'}</Text></>}
        {!pending && !state.error && initial && <><Text style={s.messageTitle}>No matching stories</Text><Text style={s.body}>Try a different title or genre.</Text></>}
        {!pending && !state.error && !initial && <Text style={s.body}>{state.limitReached ? '48-title viewing window reached' : state.ended ? 'End of this catalogue' : 'More stories are available'}</Text>}
      </View>;
    }
    if (!visual?.film) { return null; }
    const cardWidth = visual.poster ? 220 * u : landscapeWidth;
    return <Picture source={filmArtwork(visual.film, visual.poster)} style={{width: cardWidth, height: visual.poster ? 330 * u : cardWidth * 9 / 16, borderRadius: 8 * u}} fallback="Artwork unavailable" />;
  }, [model.visuals, s, u, landscapeWidth, state.error, state.limitReached, state.ended, initial, pending, searchResults]);
  const railHeader = useCallback((rail: VirtualizedFocusRail) => <Text style={s.virtualHeading}>{model.titles.get(rail.id) || ''}</Text>, [model.titles, s.virtualHeading]);
  return <View style={s.fill} onLayout={event => { const next = event.nativeEvent.layout.height;setHeight(value => Math.abs(value - next) > 0.5 ? next : value); }}>
    {featured && featuredFilm && <View style={[s.pageBackdrop, {width: viewport + 80 * u}]} pointerEvents="none"><Backdrop film={featuredFilm} /></View>}
    {endKeys.map(key => <EndObserver key={key} id={key} active={active} blocked={!!state.error} onEnd={loadMore} />)}
    {height > 0 && <FocusVirtualizedRails active={active} onReady={onReady} id="catalogue" rails={model.rails} rowExtent={rowExtent} itemExtent={landscapeWidth + 24 * u}
      viewportExtent={viewport} viewportRows={1} viewportHeight={Math.max(rowExtent, height)} headerExtent={headerExtent}
      renderRailHeader={railHeader} renderDecoration={decoration} />}
  </View>;
}
