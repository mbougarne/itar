import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Platform, Text, View, useWindowDimensions } from 'react-native';
import {
  FocusVirtualizedRails,
  occurrenceKey,
  useIsFocused,
  useFocusCommands,
} from 'itar/react';
import type { VirtualizedFocusItem, VirtualizedFocusRail } from 'itar/react';
import { hero } from './catalog';
import { useCatalogue } from './useCatalogue';
import { Picture } from './components/Picture';
import { filmArtwork } from './artwork';
import Hero from './Hero';
import { layoutRows } from './browse-layout';
import { useGuide } from './guide';
import { useDesign } from './theme';

import { CatalogueFeedback } from './components/CatalogueFeedback';
import { GuidePreview } from './components/GuidePreview';
import { EndObserver } from './components/EndObserver';
import type { BrowseProps, BrowseVisual } from './browse-types';

export default function Browse({
  id,
  kind,
  query = '',
  active,
  delay,
  failNext,
  onOpen,
  highContrast,
  featured = false,
  searchResults = false,
  mode,
  onReady,
  viewportWidth,
  onGuide,
  grid = false,
  category = 'All',
}: BrowseProps) {
  const { s, u } = useDesign();
  const { width } = useWindowDimensions();
  const { guide } = useGuide(featured);
  const [measuredWidth, setWidth] = useState(0);
  const [height, setHeight] = useState(0);

  const { state, loadMore, reload, nextWindow } = useCatalogue(
    kind,
    query,
    delay,
    failNext,
    mode,
    featured ? 80 : 160,
    category,
  );

  useEffect(() => {
    if (
      featured &&
      active &&
      !state.loading &&
      !state.ended &&
      !state.error &&
      new Set(state.rows.flatMap(row => row.entries.map(film => film.id)))
        .size < 60
    ) {
      loadMore();
    }
  }, [
    featured,
    active,
    state.rows,
    state.loading,
    state.ended,
    state.error,
    loadMore,
  ]);

  const featuredFilm = mode === 'fixture' ? hero : state.rows[0]?.entries[0];
  const initial = state.rows.length === 0;
  const pending = state.loading || (initial && !state.error && !state.ended);
  const retryInitial = useRef(false);
  const commands = useFocusCommands();
  const retryFocused = useIsFocused(occurrenceKey(id, 'load-more'));

  const retry = useCallback(() => {
    retryInitial.current = Platform.OS === 'web' && initial && retryFocused;
    loadMore();
  }, [initial, retryFocused, loadMore]);

  const viewport = Math.max(
    200 * u,
    viewportWidth || measuredWidth || width - 192 * u,
  );

  const columns = grid ? 5 : 4;
  const cardGap = 24 * u;
  const homeInset = featured ? cardGap : 0;

  const landscapeWidth =
    (viewport - 2 * homeInset - (columns - 1) * cardGap) / columns;

  const landscapeRowExtent = (landscapeWidth * 9) / 16 + 32 * u;

  // Search feedback takes 116 units above its 56-unit pagination button.
  const rowExtent = searchResults
    ? Math.max(landscapeRowExtent, 172 * u)
    : grid
    ? landscapeRowExtent
    : 420 * u;

  const headerExtent = grid || searchResults ? 0 : 58 * u;

  const displayedRows = useMemo(
    () =>
      featured || grid
        ? layoutRows(state.rows, featured ? 'home' : 'grid')
        : state.rows,
    [state.rows, featured, grid],
  );

  const last = displayedRows[displayedRows.length - 1];

  const endKeys =
    last?.entries.slice(-2).map(film => occurrenceKey(id, last.id, film.id)) ??
    [];

  const model = useMemo(() => {
    const visuals = new Map<string, BrowseVisual>();
    const accent = { accentColor: highContrast ? '#FFFFFF' : '#26D9F2' };

    const make = (
      key: string,
      label: string,
      onPress: () => void,
      contentId?: string,
    ): VirtualizedFocusItem => ({
      occurrenceKey: key,
      contentId,
      accessibilityLabel: label,
      labelSize: 24 * u,
      baseAccentColor: '#F4EEE4',
      focusStyle: accent,
      onPress,
    });

    const rails: VirtualizedFocusRail[] = [];
    const titles = new Map<string, string>();

    for (const rail of displayedRows) {
      const poster = !grid && !searchResults && rail.format === 'poster';
      const cardWidth = poster ? 220 * u : landscapeWidth;
      const imageHeight = poster ? 330 * u : (cardWidth * 9) / 16;

      titles.set(rail.id, rail.title);

      rails.push({
        id: rail.id,
        itemExtent: cardWidth + cardGap,
        itemStyle: {
          marginStart: homeInset,
          width: cardWidth,
          height: imageHeight,
          borderRadius: 8 * u,
          backgroundColor: 'transparent',
        },
        items: rail.entries.map(film => {
          const key = occurrenceKey(id, rail.id, film.id);

          visuals.set(key, { film, poster });

          return {
            ...make(
              key,
              `${film.title}, ${film.kind === 'movie' ? 'Movie' : 'Series'}`,
              () => onOpen(film, key),
              film.id,
            ),
            displayLabel: '',
          };
        }),
      });
    }

    if (featured && state.rows.length && onGuide) {
      const programmes = guide?.channels.slice(0, 3) ?? [];

      titles.set('guide-preview', 'On TV · Explore the programme guide');

      rails.push({
        id: 'guide-preview',
        itemExtent: landscapeWidth + cardGap,
        itemStyle: [s.primaryCta, s.homeInset],
        items: (programmes.length ? programmes : [null]).map(channel => {
          const key = occurrenceKey(id, 'guide', channel?.id ?? 'open');

          visuals.set(key, {
            guide: true,
            channel: channel?.name,
            programme: channel?.programmes.find(
              p => p.stop > Date.now() / 1000,
            ),
          });

          return make(key, 'Open TV guide', () => onGuide(key));
        }),
      });
    }

    if (!featured || initial || state.error) {
      const key = occurrenceKey(id, 'load-more');

      visuals.set(key, { feedback: true });

      const action = make(
        key,
        state.error
          ? 'Retry fetch'
          : pending
          ? 'Fetching stories…'
          : state.limitReached
          ? 'Continue to next titles'
          : state.ended
          ? 'Reload catalogue'
          : 'Load more stories',
        state.error
          ? retry
          : state.limitReached
          ? nextWindow
          : state.ended
          ? reload
          : loadMore,
      );

      rails.push({
        id: 'pagination',
        itemExtent: viewport,
        itemStyle: [s.pill, featured && s.homeInset],
        items: [
          {
            ...action,
            // Keep a filter focused during the first fetch. A focused retry
            // stays mounted and eligible until its result is ready.
            enabled: !grid || !initial || !pending || retryFocused,
          },
        ],
      });
    }

    return { rails, visuals, titles };
  }, [
    displayedRows,
    grid,
    cardGap,
    homeInset,
    guide,
    onGuide,
    initial,
    id,
    highContrast,
    featured,
    viewport,
    u,
    s.pill,
    s.primaryCta,
    s.homeInset,
    landscapeWidth,
    state.rows,
    state.error,
    state.ended,
    state.limitReached,
    pending,
    reload,
    nextWindow,
    loadMore,
    retry,
    retryFocused,
    searchResults,
    onOpen,
  ]);

  const decoration = useCallback(
    (item: VirtualizedFocusItem) => {
      const visual = model.visuals.get(item.occurrenceKey);

      if (visual?.guide) {
        return (
          <GuidePreview channel={visual.channel} programme={visual.programme} />
        );
      }

      if (visual?.feedback) {
        return (
          <View style={featured && s.homeInset}>
            <CatalogueFeedback
              searchResults={searchResults}
              landscapeWidth={landscapeWidth}
              error={state.error}
              ended={state.ended}
              limitReached={state.limitReached}
              initial={initial}
              pending={pending}
            />
          </View>
        );
      }

      return null;
    },
    [
      model.visuals,
      landscapeWidth,
      state.error,
      state.limitReached,
      state.ended,
      initial,
      pending,
      searchResults,
      featured,
      s.homeInset,
    ],
  );

  const renderItem = useCallback(
    (item: VirtualizedFocusItem) => {
      const visual = model.visuals.get(item.occurrenceKey);

      if (!visual?.film) {
        return null;
      }

      const cardWidth = visual.poster ? 220 * u : landscapeWidth;

      return (
        <Picture
          source={filmArtwork(visual.film, visual.poster)}
          style={{
            width: cardWidth,
            height: visual.poster ? 330 * u : (cardWidth * 9) / 16,
            borderRadius: 8 * u,
          }}
          fallback="Artwork unavailable"
        />
      );
    },
    [model.visuals, u, landscapeWidth],
  );

  const railHeader = useCallback(
    (rail: VirtualizedFocusRail) => {
      const title = model.titles.get(rail.id);

      return title ? (
        <Text
          accessibilityRole="header"
          style={[s.virtualHeading, featured && s.homeInset]}
        >
          {title}
        </Text>
      ) : null;
    },
    [model.titles, s.virtualHeading, featured, s.homeInset],
  );

  const reportReady = useCallback(() => {
    if (featured && !featuredFilm && state.loading) {
      return;
    }

    if (retryInitial.current && !pending) {
      retryInitial.current = false;

      const row = displayedRows.find(value => value.entries.length > 0);
      const first = row?.entries[0];

      if (active && retryFocused && !state.error && row && first) {
        commands.focusByKey(
          featured && featuredFilm
            ? occurrenceKey(id, 'hero', featuredFilm.id)
            : occurrenceKey(id, row.id, first.id),
        );
      }
    }

    onReady?.(
      featured && featuredFilm
        ? occurrenceKey(id, 'hero', featuredFilm.id)
        : occurrenceKey(id, 'load-more'),
    );
  }, [
    featured,
    featuredFilm,
    state.loading,
    onReady,
    id,
    pending,
    displayedRows,
    active,
    retryFocused,
    state.error,
    commands,
  ]);

  return (
    <View style={s.fill}>
      {Platform.OS === 'web' && !!state.error && (
        <View accessibilityRole="alert">
          <Text style={s.heading}>
            {initial ? 'Couldn’t load stories' : 'Couldn’t load more stories'}
          </Text>
          <Text style={s.muted}>{state.error}</Text>
        </View>
      )}
      <View
        style={s.fill}
        onLayout={event => {
          setHeight(event.nativeEvent.layout.height);
          setWidth(event.nativeEvent.layout.width);
        }}
      >
        {!featured &&
          endKeys.map(key => (
            <EndObserver
              key={key}
              id={key}
              active={active}
              blocked={!!state.error}
              onEnd={loadMore}
            />
          ))}
        {height > 0 && (
          <FocusVirtualizedRails
            active={active}
            onEndReached={!featured && !state.error ? loadMore : undefined}
            onReady={reportReady}
            id="catalogue"
            rails={model.rails}
            rowEntry={featured ? 'first' : 'nearest'}
            horizontalAlignment={featured ? 'leading' : 'nearest'}
            rowExtent={rowExtent}
            itemExtent={landscapeWidth + cardGap}
            viewportExtent={viewport}
            viewportRows={1}
            viewportHeight={height}
            listHeader={
              featured && featuredFilm ? (
                <Hero
                  onGuide={onGuide}
                  film={featuredFilm}
                  id={id}
                  onOpen={onOpen}
                  highContrast={highContrast}
                />
              ) : undefined
            }
            listHeaderExtent={featured && featuredFilm ? 624 * u : 0}
            listHeaderScope={
              featured && featuredFilm ? 'hero-actions' : undefined
            }
            listHeaderItems={
              featured && featuredFilm
                ? [
                    {
                      occurrenceKey: occurrenceKey(id, 'hero', featuredFilm.id),
                      accessibilityLabel: 'Explore title',
                    },
                    ...(onGuide
                      ? [
                          {
                            occurrenceKey: occurrenceKey(id, 'hero-guide'),
                            accessibilityLabel: 'TV guide',
                          },
                        ]
                      : []),
                  ]
                : undefined
            }
            headerExtent={headerExtent}
            renderRailHeader={headerExtent > 0 ? railHeader : undefined}
            renderDecoration={decoration}
            renderItem={renderItem}
          />
        )}
      </View>
    </View>
  );
}
