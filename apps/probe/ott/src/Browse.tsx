import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Text, View, useWindowDimensions } from 'react-native';
import { FocusVirtualizedRails, occurrenceKey, useIsFocused } from 'itar/react';
import type { VirtualizedFocusItem, VirtualizedFocusRail } from 'itar/react';
import { hero, type Category, type Film, type Kind } from './catalog';
import { useCatalogue } from './useCatalogue';
import { Backdrop, Picture, filmArtwork } from './ui';
import Hero from './Hero';
import { layoutRows } from './browse-layout';
import { useGuide, guideTime, type Programme } from './guide';
import type { ProviderMode } from './tmdb';
import { useDesign } from './theme';

function EndObserver({
  id,
  active,
  blocked,
  onEnd,
}: {
  id: string;
  active: boolean;
  blocked: boolean;
  onEnd: () => void;
}) {
  const focused = useIsFocused(id);

  useEffect(() => {
    if (focused && active && !blocked) {
      onEnd();
    }
  }, [focused, active, blocked, onEnd]);

  return null;
}

type Visual = {
  film?: Film;
  poster?: boolean;
  programme?: Programme;
  channel?: string;
  guide?: boolean;
  feedback?: boolean;
};

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
}: {
  grid?: boolean;
  category?: Category;
  onGuide?: () => void;
  onReady?: () => void;
  viewportWidth?: number;
  mode: ProviderMode;
  id: string;
  kind: Kind;
  query?: string;
  active: boolean;
  delay: number;
  failNext: () => boolean;
  onOpen: (film: Film) => void;
  highContrast: boolean;
  featured?: boolean;
  searchResults?: boolean;
}) {
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

  const viewport = Math.max(
    200 * u,
    viewportWidth || measuredWidth || width - 192 * u,
  );

  const columns = grid ? 5 : 4;
  const landscapeWidth = (viewport - (columns - 1) * 24 * u) / columns;

  const rowExtent = grid
    ? (landscapeWidth * 9) / 16 + 32 * u
    : (searchResults ? 280 : 420) * u;

  const headerExtent = grid ? 0 : 50 * u;

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
    const visuals = new Map<string, Visual>();
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
    const rows = [...displayedRows];

    for (const rail of rows) {
      const poster = !grid && !searchResults && rail.format === 'poster';
      const cardWidth = poster ? 220 * u : landscapeWidth;
      const imageHeight = poster ? 330 * u : (cardWidth * 9) / 16;

      titles.set(
        rail.id,
        searchResults
          ? rail === rows[0]
            ? query.trim()
              ? 'Matching titles'
              : 'Trending this week'
            : 'More to explore'
          : rail.title,
      );

      rails.push({
        id: rail.id,
        overlayTarget: true,
        itemExtent: cardWidth + 24 * u,
        itemStyle: {
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
              () => onOpen(film),
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
        itemExtent: landscapeWidth + 24 * u,
        itemStyle: s.primaryCta,
        items: (programmes.length ? programmes : [null]).map(channel => {
          const key = occurrenceKey(id, 'guide', channel?.id ?? 'open');

          visuals.set(key, {
            guide: true,
            channel: channel?.name,
            programme: channel?.programmes.find(
              p => p.stop > Date.now() / 1000,
            ),
          });

          return make(key, 'Open TV guide', onGuide);
        }),
      });
    }

    if (!featured || initial || state.error) {
      const key = occurrenceKey(id, 'load-more');

      visuals.set(key, { feedback: true });

      rails.push({
        id: 'pagination',
        itemExtent: viewport,
        itemStyle: s.pill,
        items: [
          make(
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
            state.limitReached ? nextWindow : state.ended ? reload : loadMore,
          ),
        ],
      });
    }

    return { rails, visuals, titles };
  }, [
    displayedRows,
    grid,
    query,
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
    landscapeWidth,
    state.rows,
    state.error,
    state.ended,
    state.limitReached,
    pending,
    reload,
    nextWindow,
    loadMore,
    searchResults,
    onOpen,
  ]);

  const decoration = useCallback(
    (item: VirtualizedFocusItem) => {
      const visual = model.visuals.get(item.occurrenceKey);

      if (visual?.guide) {
        return (
          <View style={s.guidePreview}>
            <Text style={s.eyebrow}>{visual.channel || 'EPGTALK'}</Text>
            <Text numberOfLines={2} style={s.heading}>
              {visual.programme?.title || 'What’s on now and next'}
            </Text>
            <Text style={s.muted}>
              {visual.programme
                ? `${guideTime(visual.programme.start)}–${guideTime(
                    visual.programme.stop,
                  )}`
                : 'Browse channels and programme times'}
            </Text>
          </View>
        );
      }

      if (visual?.feedback) {
        return (
          <View
            style={[s.feedback, { height: (searchResults ? 116 : 270) * u }]}
          >
            {!!state.error && (
              <>
                <Text numberOfLines={1} style={s.heading}>
                  {initial
                    ? 'Couldn’t load stories'
                    : 'Couldn’t load more stories'}
                </Text>
                <Text numberOfLines={2} style={s.muted}>
                  {state.error}
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
            {!pending && !state.error && initial && (
              <>
                <Text style={s.heading}>No matching stories</Text>
                <Text style={s.muted}>Try a different title or genre.</Text>
              </>
            )}
            {!pending && !state.error && !initial && (
              <Text style={s.body}>
                {state.limitReached
                  ? 'Continue browsing the next selection'
                  : state.ended
                  ? 'End of this catalogue'
                  : 'More stories are available'}
              </Text>
            )}
          </View>
        );
      }

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
    [
      model.visuals,
      s,
      u,
      landscapeWidth,
      state.error,
      state.limitReached,
      state.ended,
      initial,
      pending,
      searchResults,
    ],
  );

  const railHeader = useCallback(
    (rail: VirtualizedFocusRail) => (
      <Text style={s.virtualHeading}>{model.titles.get(rail.id) || ''}</Text>
    ),
    [model.titles, s.virtualHeading],
  );

  return (
    <View style={s.fill}>
      {featured && featuredFilm && <Backdrop film={featuredFilm} />}
      {featured && featuredFilm && (
        <Hero
          onGuide={onGuide}
          film={featuredFilm}
          id={id}
          onOpen={onOpen}
          highContrast={highContrast}
        />
      )}
      <View
        style={featured ? s.homeRails : s.fill}
        onLayout={event => {
          setHeight(event.nativeEvent.layout.height);
          setWidth(event.nativeEvent.layout.width - (featured ? 80 * u : 0));
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
            onReady={onReady}
            id="catalogue"
            rails={model.rails}
            rowExtent={rowExtent}
            itemExtent={landscapeWidth + 24 * u}
            viewportExtent={viewport}
            viewportRows={1}
            viewportHeight={height}
            headerExtent={headerExtent}
            renderRailHeader={grid ? undefined : railHeader}
            renderDecoration={decoration}
          />
        )}
      </View>
    </View>
  );
}
