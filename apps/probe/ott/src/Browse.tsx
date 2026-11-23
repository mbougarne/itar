import React, {
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Platform, Text, View, useWindowDimensions } from 'react-native';
import {
  FocusVirtualizedRails,
  occurrenceKey,
  useIsFocused,
  useScreenReaderEnabled,
  useFocusCommands,
} from '@bougarnem/itar/react';
import type {
  VirtualizedFocusItem,
  VirtualizedFocusRail,
} from '@bougarnem/itar/react';
import { tvControlLabel } from './tv-accessibility';
import { hero } from './catalog';
import { useCatalogue } from './useCatalogue';
import { Picture } from './components/Picture';
import { filmArtwork } from './artwork';
import Hero from './Hero';
import { BrowserNavigation } from './browser-navigation';
import { layoutRows } from './browse-layout';
import { useDesign } from './theme';

import { CatalogueFeedback } from './components/CatalogueFeedback';
import { GuidePreview } from './components/GuidePreview';
import { EndObserver } from './components/EndObserver';
import { ContentBelowCue } from './components/ContentBelowCue';
import { ContinueWatchingCard } from './components/ContinueWatchingCard';
import {
  HomePreviewProvider,
  HomePreviewCard,
} from './components/HomePreviewCard';
import type { BrowseProps, BrowseVisual } from './browse-types';
import type { Rail } from './catalog-types';

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
  continueWatching,
  searchResults = false,
  mode,
  onReady,
  onHomeLoading,
  viewportWidth,
  onGuide,
  grid = false,
  category = 'All',
}: BrowseProps) {
  const { s, u } = useDesign();
  const { width } = useWindowDimensions();
  const [measuredWidth, setWidth] = useState(0);
  const [height, setHeight] = useState(0);
  const [homePresented, setHomePresented] = useState(false);

  const { state, loadMore, reload, nextWindow } = useCatalogue(
    kind,
    query,
    delay,
    failNext,
    mode,
    featured ? 80 : 160,
    category,
  );

  // Home shows four rails of up to fifteen distinct titles. Publish the first
  // catalogue once so successive pages cannot recycle the hero during entry.
  const needsHomePage =
    featured &&
    !state.ended &&
    !state.error &&
    new Set(state.rows.flatMap(row => row.entries.map(film => film.id))).size <
      60;

  useEffect(() => {
    if (active && needsHomePage && !state.loading) {
      loadMore();
    }
  }, [active, needsHomePage, state.loading, state.rows, loadMore]);

  const initial = state.rows.length === 0;
  const pending = state.loading || (initial && !state.error && !state.ended);

  const loadingHome =
    (featured && initial && pending) || (!homePresented && needsHomePage);

  const featuredFilm =
    !initial && mode === 'fixture' ? hero : state.rows[0]?.entries[0];

  useLayoutEffect(() => {
    if (active && loadingHome) onHomeLoading?.();
  }, [active, loadingHome, onHomeLoading]);

  const retryInitial = useRef(false);
  const commands = useFocusCommands();
  const retryFocused = useIsFocused(occurrenceKey(id, 'load-more'));

  const retry = useCallback(() => {
    retryInitial.current =
      !featured && Platform.OS === 'web' && initial && retryFocused;

    loadMore();
  }, [featured, initial, retryFocused, loadMore]);

  const viewport = Math.max(
    200 * u,
    viewportWidth || measuredWidth || width - 192 * u,
  );

  const fiveColumns = grid || searchResults;
  // Give the row name to its first card so VoiceOver cannot land on a
  // neighboring row's visual heading while the remote is idle.
  const nameHomeRows = featured && Platform.OS === 'ios' && Platform.isTV;
  const reader = useScreenReaderEnabled();

  const appleGrid =
    Platform.OS === 'ios' && Platform.isTV && fiveColumns && reader === false;

  const browserNavigation = useContext(BrowserNavigation);

  const autoPageGrid =
    appleGrid ||
    (Platform.OS === 'web' &&
      fiveColumns &&
      browserNavigation?.enabled === true);

  const columns = fiveColumns ? 5 : 4;
  const cardGap = 24 * u;
  // Each grid cell owns its gutter. Two half gutters leave the grid flush
  // with its viewport instead of giving a fixed row horizontal scroll range.
  const cardInset = fiveColumns ? cardGap / 2 : featured ? cardGap : 0;

  const landscapeWidth =
    (viewport - 2 * cardInset - (columns - 1) * cardGap) / columns;

  const landscapeRowExtent = (landscapeWidth * 9) / 16 + 32 * u;

  // Search feedback takes 116 units above its 56-unit pagination button.
  const rowExtent = searchResults
    ? Math.max(landscapeRowExtent, 172 * u)
    : grid
    ? landscapeRowExtent
    : 420 * u;

  const headerExtent = grid || searchResults ? 0 : 58 * u;

  const previewWidth = Math.min(landscapeWidth * 2, viewport - cardInset * 2);

  const previewHeight = Math.min(
    (previewWidth * 9) / 16,
    rowExtent - headerExtent - 16 * u,
  );

  const displayedRows = useMemo(() => {
    if (!featured) return grid ? layoutRows(state.rows, 'grid') : state.rows;

    const home = layoutRows(state.rows, 'home');

    if (!home.length) return home;

    const rows: Rail[] = [];

    if (continueWatching?.length) {
      rows.push({
        id: 'continue-watching',
        title: 'Continue watching',
        format: 'landscape',
        entries: continueWatching.slice(0, 15).map(entry => entry.film),
      });
    }

    rows.push(...home);

    rows.push({
      id: 'home-previews',
      title: 'Preview picks',
      format: 'landscape',
      entries: home[0].entries.slice(0, 6),
    });

    return rows;
  }, [state.rows, featured, grid, continueWatching]);

  const last = displayedRows[displayedRows.length - 1];

  const endKeys =
    last?.entries
      .slice(autoPageGrid ? 0 : -2)
      .map(film => occurrenceKey(id, last.id, film.id)) ?? [];

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
      const preview = featured && rail.id === 'home-previews';
      const poster = !grid && !searchResults && rail.format === 'poster';

      const cardWidth = preview
        ? previewWidth
        : poster
        ? 220 * u
        : landscapeWidth;

      const imageHeight = preview
        ? previewHeight
        : poster
        ? 330 * u
        : (cardWidth * 9) / 16;

      titles.set(rail.id, rail.title);

      rails.push({
        id: rail.id,
        itemExtent: cardWidth + cardGap,
        itemStyle: {
          marginStart: cardInset,
          width: cardWidth,
          height: imageHeight,
          borderRadius: 8 * u,
          backgroundColor: 'transparent',
        },
        items: rail.entries.map((film, index) => {
          const watching =
            rail.id === 'continue-watching'
              ? continueWatching?.[index]
              : undefined;

          const key = watching
            ? occurrenceKey(id, rail.id, film.source ?? 'fixture', film.id)
            : occurrenceKey(id, rail.id, film.id);

          visuals.set(key, { film, poster, preview, watching });

          const label =
            `${film.title}, ${film.kind === 'movie' ? 'Movie' : 'Series'}` +
            (watching && watching.duration > 0
              ? `, ${Math.round(
                  (watching.position / watching.duration) * 100,
                )}% watched`
              : '');

          let section: string | undefined;

          if (nameHomeRows && index === 0) section = rail.title;

          if (searchResults && rail === displayedRows[0] && index === 0) {
            section = query.trim()
              ? `Results for ${query}`
              : 'Suggested titles';
          }

          return {
            ...make(
              key,
              tvControlLabel(label, section),
              () => onOpen(film, key),
              film.id,
            ),
            displayLabel: '',
          };
        }),
      });
    }

    if (featured && state.rows.length && onGuide) {
      const key = occurrenceKey(id, 'guide', 'open');

      titles.set('guide-preview', 'On TV · Explore the programme guide');
      visuals.set(key, { guide: true });

      rails.push({
        id: 'guide-preview',
        itemExtent: viewport,
        itemStyle: [s.primaryCta, s.homeInset],
        items: [make(key, 'Open TV guide', () => onGuide(key))],
      });
    }

    // In an automatically paged grid, a focused footer moves down with every
    // append. Keep navigation on the cards until the footer has a user action.
    const needsFooter =
      !autoPageGrid || initial || state.error || state.ended || retryFocused;

    if ((!featured || initial || state.error) && needsFooter) {
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
            displayLabel: action.accessibilityLabel,
            accessibilityLabel: tvControlLabel(
              action.accessibilityLabel,
              state.error ||
                (initial && state.ended
                  ? 'No matching stories. Try a different title or genre.'
                  : undefined),
            ),
            // Keep a filter focused during the first fetch. A focused retry
            // stays mounted and eligible until its result is ready.
            enabled:
              !(grid || autoPageGrid) || !initial || !pending || retryFocused,
          },
        ],
      });
    }

    return { rails, visuals, titles };
  }, [
    displayedRows,
    nameHomeRows,
    autoPageGrid,
    grid,
    cardGap,
    cardInset,
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
    previewWidth,
    previewHeight,
    continueWatching,
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
    query,
    onOpen,
  ]);

  const decoration = useCallback(
    (item: VirtualizedFocusItem) => {
      const visual = model.visuals.get(item.occurrenceKey);

      if (visual?.guide) {
        return <GuidePreview />;
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

      if (visual.preview) {
        return (
          <HomePreviewCard
            film={visual.film}
            occurrence={item.occurrenceKey}
            width={previewWidth}
            height={previewHeight}
          />
        );
      }

      if (visual.watching) {
        return (
          <ContinueWatchingCard
            entry={visual.watching}
            width={landscapeWidth}
            height={(landscapeWidth * 9) / 16}
          />
        );
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
    [model.visuals, u, landscapeWidth, previewWidth, previewHeight],
  );

  const railHeader = useCallback(
    (rail: VirtualizedFocusRail) => {
      const title = model.titles.get(rail.id);

      return title ? (
        <Text
          accessible={nameHomeRows ? false : undefined}
          accessibilityRole="header"
          style={[s.virtualHeading, featured && s.homeInset]}
        >
          {title}
        </Text>
      ) : null;
    },
    [model.titles, s.virtualHeading, featured, s.homeInset, nameHomeRows],
  );

  const reportReady = useCallback(() => {
    if (featured && !initial) setHomePresented(true);

    if (retryInitial.current && !pending) {
      retryInitial.current = false;

      const row = displayedRows.find(value => value.entries.length > 0);
      const first = row?.entries[0];

      if (active && retryFocused && !state.error && row && first) {
        commands.focusByKey(occurrenceKey(id, row.id, first.id));
      }
    }

    onReady?.(
      featured && featuredFilm
        ? occurrenceKey(id, 'hero', featuredFilm.id)
        : occurrenceKey(id, 'load-more'),
    );
  }, [
    featured,
    initial,
    featuredFilm,
    onReady,
    id,
    pending,
    displayedRows,
    active,
    retryFocused,
    state.error,
    commands,
  ]);

  const content = (
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
          const layout = event.nativeEvent.layout;

          // Keep the scroll window mounted while a hidden page has no size.
          if (layout.width > 0 && layout.height > 0) {
            setHeight(layout.height);
            setWidth(layout.width);
          }
        }}
      >
        {!featured && (
          <EndObserver
            keys={endKeys}
            active={active}
            blocked={!!state.error}
            onEnd={loadMore}
          />
        )}
        {height > 0 && !loadingHome && (
          <FocusVirtualizedRails
            active={active}
            onEndReached={
              !featured &&
              !appleGrid &&
              !state.error &&
              !(autoPageGrid && retryFocused)
                ? loadMore
                : undefined
            }
            onReady={reportReady}
            id="catalogue"
            rails={model.rails}
            rowEntry={featured ? 'remembered' : 'nearest'}
            horizontalAlignment={featured ? 'pinned' : 'nearest'}
            rowExtent={rowExtent}
            itemExtent={landscapeWidth + cardGap}
            viewportExtent={viewport}
            viewportRows={1}
            viewportHeight={featured ? Math.max(1, height - 56 * u) : height}
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
                      accessibilityLabel: tvControlLabel(
                        'Explore title',
                        featuredFilm.title,
                      ),
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
        {height > 0 &&
          !loadingHome &&
          !initial &&
          (displayedRows.length * rowExtent > height ||
            featured ||
            !state.ended ||
            state.limitReached) && (
            <ContentBelowCue
              rails={model.rails}
              active={active}
              hasNextPage={
                !featured &&
                !state.error &&
                (!state.ended || state.limitReached)
              }
              heroKey={
                featured && featuredFilm
                  ? occurrenceKey(id, 'hero', featuredFilm.id)
                  : undefined
              }
              guideKey={
                featured && onGuide
                  ? occurrenceKey(id, 'hero-guide')
                  : undefined
              }
            />
          )}
      </View>
    </View>
  );

  return featured ? (
    <HomePreviewProvider active={active}>{content}</HomePreviewProvider>
  ) : (
    content
  );
}
