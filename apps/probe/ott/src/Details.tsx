import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { FocusScope, FocusVirtualizedRails, occurrenceKey } from 'itar/react';
import type { VirtualizedFocusItem, VirtualizedFocusRail } from 'itar/react';
import { cast, films, type CastMember, type Film } from './catalog';
import {
  Action,
  IconAction,
  icons,
  Backdrop,
  filmArtwork,
  portraits,
  Picture,
} from './ui';
import { fetchBiography, fetchDetails } from './tmdb';
import { Metadata } from './Hero';
import { useDesign } from './theme';

const tabs = ['More like this', 'Cast & crew', 'Information'] as const;

export default function Details({
  film,
  active,
  onPlay,
  onOpen,
  highContrast,
  onReady,
}: {
  film: Film;
  active: boolean;
  onPlay: () => void;
  onOpen: (film: Film) => void;
  highContrast: boolean;
  onReady?: () => void;
}) {
  const { s, u } = useDesign();
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const [info, setInfo] = useState(film);

  const [people, setPeople] = useState<readonly CastMember[]>(
    film.source ? [] : cast,
  );

  const [related, setRelated] = useState<readonly Film[]>(
    film.source ? [] : films.filter(value => value.id !== film.id).slice(0, 8),
  );

  const [tab, setTab] = useState<(typeof tabs)[number]>('More like this');
  const [person, setPerson] = useState<CastMember | null>(null);
  const [bio, setBio] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(!!film.source);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!film.source) {
      return;
    }

    const request = new AbortController();

    setLoading(true);
    setError('');

    fetchDetails(film, request.signal).then(
      result => {
        if (!request.signal.aborted) {
          setInfo(result.film);
          setPeople(result.cast);
          setRelated(result.related);
          setLoading(false);
        }
      },
      reason => {
        if (!request.signal.aborted) {
          setError(
            reason instanceof Error
              ? reason.message
              : 'Details could not load.',
          );

          setLoading(false);
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

  useEffect(() => {
    if (active && tab === 'Information') {
      onReady?.();
    }
  }, [active, tab, onReady]);

  const cardWidth = Math.max(160 * u, (viewport.width - 72 * u) / 4);

  const model = useMemo(() => {
    const visuals = new Map<string, { film?: Film; person?: CastMember }>();

    const make = (
      key: string,
      label: string,
      onPress: () => void,
    ): VirtualizedFocusItem => ({
      occurrenceKey: key,
      accessibilityLabel: label,
      displayLabel: '',
      labelSize: 22 * u,
      baseAccentColor: '#F4EEE4',
      focusStyle: { accentColor: highContrast ? '#FFFFFF' : '#26D9F2' },
      onPress,
    });

    const castTab = tab === 'Cast & crew';

    const items = castTab
      ? people.map(member => {
          const key = occurrenceKey('details', film.id, 'cast', member.id);

          visuals.set(key, { person: member });

          return {
            ...make(key, `${member.name}, ${member.role}`, () =>
              setPerson(member),
            ),
            displayLabel: member.name,
            labelPlacement: 'bottom' as const,
            outlineInsetBottom: 40 * u,
          };
        })
      : related.map(value => {
          const key = occurrenceKey('details', film.id, 'related', value.id);

          visuals.set(key, { film: value });

          return make(key, value.title, () => onOpen(value));
        });

    const rails: VirtualizedFocusRail[] = [
      {
        id: tab,
        overlayTarget: true,
        itemExtent: castTab ? 204 * u : cardWidth + 24 * u,
        itemStyle: {
          width: castTab ? 180 * u : cardWidth,
          height: castTab ? 220 * u : (cardWidth * 9) / 16,
          backgroundColor: 'transparent',
        },
        items,
      },
    ];

    return { rails, visuals };
  }, [tab, people, related, film.id, cardWidth, onOpen, highContrast, u]);

  const decoration = useCallback(
    (item: VirtualizedFocusItem) => {
      const visual = model.visuals.get(item.occurrenceKey);

      if (visual?.person) {
        const member = visual.person;

        return (
          <Picture
            source={
              film.source
                ? member.portraitUrl
                  ? { uri: member.portraitUrl }
                  : undefined
                : portraits[member.id]
            }
            style={{ width: 180 * u, height: 180 * u, borderRadius: 8 * u }}
            fallback="Portrait unavailable"
          />
        );
      }

      return visual?.film ? (
        <Picture
          source={filmArtwork(visual.film)}
          style={{
            width: cardWidth,
            height: (cardWidth * 9) / 16,
            borderRadius: 8 * u,
          }}
          fallback="Artwork unavailable"
        />
      ) : null;
    },
    [model.visuals, film.source, u, cardWidth],
  );

  return (
    <View style={s.fill}>
      <View style={s.pageBackdrop} pointerEvents="none">
        <Backdrop film={info} details />
      </View>
      <View style={s.detailTop}>
        <View style={s.heroCopy}>
          <Text numberOfLines={2} style={s.heroTitle}>
            {info.title}
          </Text>
          <Metadata film={info} />
          <Text style={s.muted}>
            {info.category}
            {info.tagline ? ` · ${info.tagline}` : ''}
          </Text>
          <Text numberOfLines={3} style={s.body}>
            {info.synopsis}
          </Text>
          <FocusScope
            id="detail-actions"
            layout="row"
            boundary="parent"
            style={s.heroActions}
          >
            <Action
              id={occurrenceKey('details', 'play')}
              label="▶  Play demo"
              onPress={onPlay}
              highContrast={highContrast}
              style={s.primaryCta}
            />
            <Action
              order={1}
              id={occurrenceKey('details', 'list')}
              label="＋  My list"
              onPress={() => {}}
              highContrast={highContrast}
              style={s.primaryCta}
            />
            <IconAction
              order={2}
              id={occurrenceKey('details', 'like')}
              label="Like"
              icon={icons.like}
              onPress={() => {}}
              highContrast={highContrast}
            />
          </FocusScope>
          <Text style={s.footer}>
            Big Buck Bunny demo playback · My list and Like are focus-only
            controls
          </Text>
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
            displayLabel={name}
            onPress={() => {
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
          <Text style={s.muted}>{error}</Text>
          <Action
            id={occurrenceKey('details', 'retry')}
            label="Retry details"
            onPress={() => setAttempt(value => value + 1)}
          />
        </View>
      ) : (
        loading && <Text style={s.muted}>Loading title information…</Text>
      )}
      <View
        style={s.fill}
        onLayout={event => setViewport(event.nativeEvent.layout)}
      >
        {tab === 'Information' ? (
          <View style={s.information}>
            <Text style={s.body}>
              {info.status || 'Status unavailable'}
              {info.seasons
                ? ` · ${info.seasons} seasons · ${
                    info.episodes ?? '—'
                  } episodes`
                : ''}
            </Text>
            <Text style={s.muted}>
              Languages: {info.languages || 'Not provided'} · Countries:{' '}
              {info.countries || 'Not provided'}
            </Text>
            <Text style={s.muted}>
              Studios: {info.studios || 'Not provided'}
            </Text>
            <Text style={s.muted}>
              TMDB rating:{' '}
              {info.votes
                ? `${info.rating?.toFixed(
                    1,
                  )} / 10 from ${info.votes.toLocaleString()} votes`
                : 'Not yet rated'}
            </Text>
            <Text style={s.muted}>
              Subtitles: availability not provided · Audio description:
              availability not provided
            </Text>
            <Text style={s.footer}>
              Title metadata does not describe the tracks available in the demo
              video.
            </Text>
          </View>
        ) : (
          <>
            {viewport.width > 0 && viewport.height > 0 && (
              <FocusVirtualizedRails
                id="title-content"
                active={active}
                rails={model.rails}
                onReady={onReady}
                rowExtent={240 * u}
                itemExtent={cardWidth + 24 * u}
                viewportExtent={viewport.width}
                viewportHeight={Math.min(viewport.height, 250 * u)}
                renderDecoration={decoration}
              />
            )}
            {!loading && !error && !model.rails[0].items.length && (
              <Text style={s.muted}>
                No {tab.toLowerCase()} available for this title.
              </Text>
            )}
            {person && (
              <View style={s.biographyPanel}>
                <Text style={s.body}>
                  {person.name} · {person.role}
                </Text>
                <Text numberOfLines={3} style={s.muted}>
                  {bio}
                </Text>
              </View>
            )}
          </>
        )}
      </View>
    </View>
  );
}
