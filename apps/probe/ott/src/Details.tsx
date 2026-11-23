import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AccessibilityInfo,
  Platform,
  Text,
  View,
  type ImageSourcePropType,
} from 'react-native';
import {
  FocusScope,
  FocusVirtualizedRails,
  occurrenceKey,
  useScreenReaderEnabled,
} from 'itar/react';
import type { VirtualizedFocusItem, VirtualizedFocusRail } from 'itar/react';
import { captionAccessible, tvControlLabel } from './tv-accessibility';
import { cast, films } from './catalog';
import type { CastMember, Film } from './catalog-types';
import { Action } from './components/Action';
import { IconAction } from './components/IconAction';
import { Backdrop } from './components/Backdrop';
import { Picture } from './components/Picture';
import { icons, filmArtwork, portraits } from './artwork';
import { fetchBiography } from './tmdb';
import { cachedDetails, loadDetails } from './detail-data';
import { detailTabs as tabs } from './navigation';
import { Metadata } from './components/Metadata';
import { RecommendationsPlaceholder } from './components/RecommendationsPlaceholder';
import { useDesign } from './theme';

const emptyCast: readonly CastMember[] = [];

export default function Details({
  film,
  active,
  onPlay,
  saved,
  listReady,
  listError,
  onToggleSaved,
  resumeAvailable,
  onOpen,
  highContrast,
  onReady,
  waitForRecommendations = false,
}: {
  film: Film;
  active: boolean;
  onPlay: (film: Film) => void;
  saved: boolean;
  listReady: boolean;
  listError: string;
  onToggleSaved: (film: Film) => void;
  resumeAvailable: boolean;
  onOpen: (film: Film, openerKey: string) => void;
  highContrast: boolean;
  onReady?: () => void;
  waitForRecommendations?: boolean;
}) {
  const { s, u } = useDesign();
  const reader = useScreenReaderEnabled();
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const [data, setData] = useState(() => cachedDetails(film));
  const info = data?.film ?? film;

  const people: readonly CastMember[] =
    data?.cast ?? (film.source ? emptyCast : cast);

  const related = useMemo(
    () =>
      data?.related ??
      (film.source
        ? []
        : films.filter(value => value.id !== film.id).slice(0, 8)),
    [data, film],
  );

  const [tab, setTab] = useState<(typeof tabs)[number]>('More like this');
  const [person, setPerson] = useState<CastMember | null>(null);
  const [bio, setBio] = useState('');
  const [error, setError] = useState('');
  const loading = !!film.source && !data && !error;
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!film.source) {
      return;
    }

    const request = new AbortController();

    loadDetails(film, request.signal).then(
      result => {
        if (!request.signal.aborted) {
          setData(result);
        }
      },
      reason => {
        if (!request.signal.aborted) {
          setError(
            reason instanceof Error
              ? reason.message
              : 'Details could not load.',
          );
        }
      },
    );

    return () => request.abort();
  }, [film, attempt]);

  useEffect(() => {
    if (!person) {
      return;
    }

    if (!film.source) {
      setBio(person.bio || 'No biography available.');

      return;
    }

    const request = new AbortController();

    setBio('Loading biography…');

    fetchBiography(person, request.signal).then(
      value => {
        if (!request.signal.aborted) {
          setBio(value);
        }
      },
      () => {
        if (!request.signal.aborted) {
          setBio('Biography could not load.');
        }
      },
    );

    return () => request.abort();
  }, [person, film.source]);

  // The static controls can receive focus as soon as the screen has layout.
  // Only restoring a recommendation needs the virtualized rail's acceptance.
  const laidOut = viewport.width > 0 && viewport.height > 0;

  useEffect(() => {
    if (active && laidOut && !waitForRecommendations) onReady?.();
  }, [active, laidOut, waitForRecommendations, onReady]);

  const castTab = tab === 'Cast & crew';

  const loadingRecommendations =
    tab === 'More like this' && loading && related.length === 0;

  const cardGap = 24 * u;

  const cardWidth = castTab
    ? 180 * u
    : Math.max(160 * u, (viewport.width - 3 * cardGap) / 4);

  const imageHeight = castTab ? cardWidth : (cardWidth * 9) / 16;
  const captionHeight = 48 * u;
  const cardHeight = imageHeight + captionHeight;

  const model = useMemo(() => {
    const visuals = new Map<
      string,
      { title: string; source?: ImageSourcePropType }
    >();

    const make = (
      key: string,
      label: string,
      onPress: () => void,
    ): VirtualizedFocusItem => ({
      occurrenceKey: key,
      accessibilityLabel: label,
      displayLabel: '',
      outlineInsetBottom: captionHeight,
      baseAccentColor: '#F4EEE4',
      focusStyle: { accentColor: highContrast ? '#FFFFFF' : '#26D9F2' },
      onPress,
    });

    const items = castTab
      ? people.map(member => {
          const key = occurrenceKey('details', film.id, 'cast', member.id);

          visuals.set(key, {
            title: member.name,
            source: member.portraitUrl
              ? { uri: member.portraitUrl }
              : film.source
              ? undefined
              : portraits[member.id],
          });

          return make(
            key,
            tvControlLabel(
              `${member.name}, ${member.role}`,
              person?.id === member.id ? bio : undefined,
            ),
            () => {
              if (
                person?.id === member.id &&
                bio &&
                reader &&
                captionAccessible === false
              ) {
                AccessibilityInfo.announceForAccessibility(bio);
              } else if (person?.id !== member.id) {
                setBio('');
                setPerson(member);
              }
            },
          );
        })
      : related.map(value => {
          const key = occurrenceKey('details', film.id, 'related', value.id);

          visuals.set(key, { title: value.title, source: filmArtwork(value) });

          return make(key, value.title, () => onOpen(value, key));
        });

    const rails: VirtualizedFocusRail[] = [
      {
        id: tab,
        itemExtent: cardWidth + cardGap,
        itemStyle: {
          width: cardWidth,
          height: cardHeight,
          marginEnd: cardGap,
          borderRadius: 8 * u,
          backgroundColor: 'transparent',
        },
        items,
      },
    ];

    return { rails, visuals };
  }, [
    tab,
    castTab,
    person,
    bio,
    reader,
    people,
    related,
    film.id,
    film.source,
    cardWidth,
    cardGap,
    cardHeight,
    captionHeight,
    onOpen,
    highContrast,
    u,
  ]);

  const renderItem = useCallback(
    (item: VirtualizedFocusItem) => {
      const visual = model.visuals.get(item.occurrenceKey);

      if (!visual) return null;

      return (
        <View>
          <Picture
            source={visual.source}
            style={{
              width: cardWidth,
              height: imageHeight,
              borderRadius: 8 * u,
            }}
            fallback={castTab ? 'Portrait unavailable' : 'Artwork unavailable'}
          />
          <Text
            accessible={captionAccessible}
            numberOfLines={1}
            style={[s.detailCardCaption, s.detailText]}
          >
            {visual.title}
          </Text>
        </View>
      );
    },
    [
      model.visuals,
      castTab,
      u,
      cardWidth,
      imageHeight,
      s.detailCardCaption,
      s.detailText,
    ],
  );

  const information = [
    (info.status || 'Status unavailable') +
      (info.seasons
        ? ` · ${info.seasons} seasons · ${info.episodes ?? '—'} episodes`
        : ''),
    `Languages: ${info.languages || 'Not provided'} · Countries: ${
      info.countries || 'Not provided'
    }`,
    `Studios: ${info.studios || 'Not provided'}`,
    `TMDB rating: ${
      info.votes
        ? `${info.rating?.toFixed(
            1,
          )} / 10 from ${info.votes.toLocaleString()} votes`
        : 'Not yet rated'
    }`,
    'Subtitles: availability not provided · Audio description: availability not provided',
    'Title metadata does not describe the tracks available in the demo video.',
  ].filter(Boolean);

  const playAction = (
    <Action
      id={occurrenceKey('details', 'play')}
      label={resumeAvailable ? 'Resume demo' : 'Play demo'}
      tvDescription={`${info.title}. Big Buck Bunny demo playback.`}
      displayLabel={resumeAvailable ? '▶  Resume demo' : '▶  Play demo'}
      onPress={() => onPlay(info)}
      highContrast={highContrast}
      style={s.primaryCta}
    />
  );

  return (
    <View style={s.detailContent}>
      <View style={s.pageBackdrop} pointerEvents="none">
        <Backdrop
          film={info}
          catalogueFilm={film}
          details
          highContrast={highContrast}
        />
      </View>
      <View style={s.detailTop}>
        <View style={s.heroCopy}>
          <Text
            accessible={captionAccessible}
            accessibilityRole="header"
            numberOfLines={2}
            style={[s.heroTitle, s.detailText]}
          >
            {info.title}
          </Text>
          <Metadata film={info} />
          <Text accessible={captionAccessible} style={s.muted}>
            {info.category}
            {info.tagline ? ` · ${info.tagline}` : ''}
          </Text>
          <Text
            accessible={captionAccessible}
            numberOfLines={3}
            style={[s.body, s.detailText]}
          >
            {info.synopsis}
          </Text>
          <FocusScope
            id="detail-actions"
            layout="row"
            boundary="parent"
            style={s.heroActions}
          >
            {playAction}
            <Action
              order={1}
              id={occurrenceKey('details', 'list')}
              label={saved ? 'Remove from My List' : 'Add to My List'}
              displayLabel={saved ? '✓  In My List' : '＋  My List'}
              tvDescription={listError}
              enabled={listReady}
              onPress={() => onToggleSaved(info)}
              highContrast={highContrast}
              style={s.primaryCta}
            />
            <IconAction
              order={2}
              id={occurrenceKey('details', 'like')}
              label="Like"
              tvDescription="Focus-only demo control."
              icon={icons.like}
              onPress={() => {}}
              highContrast={highContrast}
            />
          </FocusScope>
          <Text accessible={captionAccessible} style={s.footer}>
            Big Buck Bunny{Platform.OS === 'web' ? ' 4K UHD' : ''} demo playback
            · Like is a focus-only control
          </Text>
          {!!listError && (
            <Text
              accessible={captionAccessible}
              accessibilityLiveRegion="polite"
              style={s.muted}
            >
              {listError}
            </Text>
          )}
        </View>
      </View>
      <FocusScope
        id="detail-tabs"
        layout="row"
        boundary="parent"
        style={s.tabs}
      >
        {tabs.map((name, index) => (
          <Action
            key={name}
            order={index}
            id={occurrenceKey('details', 'tab', name)}
            label={`${name}${tab === name ? ', selected' : ''}`}
            tvDescription={
              name === 'Information'
                ? 'Select to read the synopsis and title information.'
                : tab === name
                ? loading
                  ? 'Loading title information'
                  : !model.rails[0].items.length
                  ? `No ${name.toLowerCase()} available for this title.`
                  : undefined
                : undefined
            }
            displayLabel={name}
            onPress={() => {
              if (
                name === 'Information' &&
                captionAccessible === false &&
                reader
              ) {
                AccessibilityInfo.announceForAccessibility(
                  [
                    info.title,
                    info.year,
                    info.kind,
                    info.category,
                    info.tagline,
                    info.runtime && `${info.runtime} minutes`,
                    info.certification || 'Age rating unavailable',
                    info.synopsis,
                    ...information,
                    'Demo video: Big Buck Bunny, Blender Foundation. Creative Commons Attribution 3.0. Stream hosted by Mux.',
                  ]
                    .filter(Boolean)
                    .join('. '),
                );
              }

              setTab(name);
              setPerson(null);
            }}
            highContrast={highContrast}
            style={[s.tab, tab === name && s.selectedTab]}
          />
        ))}
      </FocusScope>
      {error ? (
        <View style={s.row}>
          <Text accessible={captionAccessible} style={s.muted}>
            {error}
          </Text>
          <Action
            id={occurrenceKey('details', 'retry')}
            label="Retry details"
            tvDescription={error}
            onPress={() => {
              setError('');
              setAttempt(value => value + 1);
            }}
          />
        </View>
      ) : (
        loading &&
        !loadingRecommendations && (
          <Text accessible={captionAccessible} style={s.muted}>
            Loading title information…
          </Text>
        )
      )}
      <View
        style={s.fill}
        onLayout={event => setViewport(event.nativeEvent.layout)}
      >
        {tab === 'Information' ? (
          <View style={s.information}>
            {information.map((line, index) => (
              <Text
                accessible={captionAccessible}
                key={line}
                style={
                  index === 0
                    ? s.body
                    : index === information.length - 1
                    ? s.footer
                    : s.muted
                }
              >
                {line}
              </Text>
            ))}
          </View>
        ) : (
          <View
            style={
              tab === 'More like this' && {
                marginTop: Math.max(0, (viewport.height - cardHeight) / 2),
              }
            }
          >
            {viewport.width > 0 && viewport.height > 0 && (
              <FocusVirtualizedRails
                id="title-content"
                active={active}
                rails={model.rails}
                horizontalAlignment={castTab ? 'nearest' : 'pinned'}
                onReady={
                  waitForRecommendations && !loading ? onReady : undefined
                }
                rowExtent={cardHeight}
                itemExtent={cardWidth + cardGap}
                viewportExtent={viewport.width}
                viewportHeight={Math.min(viewport.height, cardHeight)}
                renderItem={renderItem}
              />
            )}
            {loadingRecommendations && <RecommendationsPlaceholder />}
            {!loading && !error && !model.rails[0].items.length && (
              <Text accessible={captionAccessible} style={s.muted}>
                No {tab.toLowerCase()} available for this title.
              </Text>
            )}
            {person && (
              <View style={s.biographyPanel}>
                <Text accessible={captionAccessible} style={s.body}>
                  {person.name} · {person.role}
                </Text>
                <Text
                  accessible={captionAccessible}
                  numberOfLines={3}
                  style={s.muted}
                >
                  {bio}
                </Text>
              </View>
            )}
          </View>
        )}
      </View>
    </View>
  );
}
