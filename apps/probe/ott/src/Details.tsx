import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {Text, View, useWindowDimensions} from 'react-native';
import {FocusVirtualizedRails, occurrenceKey, useFocusCommands} from 'itar/react';
import {cast, films, type CastMember, type Film} from './catalog';
import type {VirtualizedFocusItem, VirtualizedFocusRail} from 'itar/react';
import {Backdrop, filmArtwork, portraits, Picture} from './ui';
import {fetchBiography, fetchDetails} from './tmdb';
import {useDesign} from './theme';
export default function Details({film, active, onPlay, onOpen, highContrast, onReady}: {
  film: Film; active: boolean; onPlay: () => void; onOpen: (film: Film) => void; highContrast: boolean; onReady?: () => void;
}) {
  const {s, u} = useDesign();const {width} = useWindowDimensions();const commands = useFocusCommands();
  const [height, setHeight] = useState(0);const [info, setInfo] = useState(film);
  const [people, setPeople] = useState<readonly CastMember[]>(film.source ? [] : cast);
  const [related, setRelated] = useState<readonly Film[]>(film.source ? [] : films.filter(value => value.id !== film.id).slice(0, 8));
  const [person, setPerson] = useState<CastMember | null>(null);const [bio, setBio] = useState('');
  const [error, setError] = useState('');const [loading, setLoading] = useState(!!film.source);const [attempt, setAttempt] = useState(0);
  const biography = useRef<AbortController | null>(null);
  useEffect(() => {
    if (!film.source) { return; }
    const request = new AbortController();setLoading(true);setError('');
    fetchDetails(film, request.signal).then(result => {
      if (!request.signal.aborted) { setInfo(result.film);setPeople(result.cast);setRelated(result.related);setLoading(false); }
    }, reason => { if (!request.signal.aborted) { setError(reason instanceof Error ? reason.message : 'Details could not load.');setLoading(false); } });
    return () => request.abort();
  }, [film, attempt]);
  useEffect(() => () => biography.current?.abort(), []);
  const choose = useCallback((member: CastMember) => {
    biography.current?.abort();setPerson(member);
    if (!film.source) { setBio(member.bio || 'No biography available.');return; }
    const request = new AbortController();biography.current = request;setBio('Loading biography…');
    fetchBiography(member, request.signal).then(value => { if (!request.signal.aborted && biography.current === request) { setBio(value); } },
      () => { if (!request.signal.aborted && biography.current === request) { setBio('Biography could not load. Select the cast member again to retry.'); } });
  }, [film.source]);
  const closeBiography = useCallback(() => {
    if (!person) { return; }
    const request = commands.focusByKey(occurrenceKey('details', film.id, 'cast', person.id));
    request.result.then(result => { if (result.status === 'applied') { biography.current?.abort();setPerson(null);setBio(''); } });
  }, [commands, film.id, person]);
  const viewport = Math.max(200 * u, width - 440 * u);const relatedWidth = Math.min(480 * u, (viewport - 48 * u) / 3);
  const model = useMemo(() => {
    const accent = {accentColor: highContrast ? '#FFFFFF' : '#26D9F2'};
    const make = (key: string, label: string, onPress: () => void): VirtualizedFocusItem => ({occurrenceKey: key, accessibilityLabel: label,
      labelSize: 24 * u, baseAccentColor: '#F4EEE4', focusStyle: accent, onPress});
    const play = occurrenceKey('details', 'play');
    const rails: VirtualizedFocusRail[] = [{id: 'story', itemExtent: viewport, itemStyle: [s.pill, {marginLeft: 228 * u}], items: [make(play, 'Play', onPlay)]}];
    const members = new Map<string, CastMember>();const recommendations = new Map<string, Film>();
    if (people.length) { rails.push({id: 'cast', overlayTarget: true, itemExtent: 204 * u, itemStyle: {width: 180 * u, height: 220 * u, backgroundColor: 'transparent'},
      items: people.map(member => { const key = occurrenceKey('details', film.id, 'cast', member.id);members.set(key, member);
        return {...make(key, `${member.name}, ${member.role}`, () => choose(member)), displayLabel: member.name, labelPlacement: 'bottom', outlineInsetBottom: 40 * u}; })}); }
    if (related.length) { rails.push({id: 'related', overlayTarget: true, itemExtent: relatedWidth + 24 * u,
      itemStyle: {width: relatedWidth, height: relatedWidth * 9 / 16 + 40 * u, backgroundColor: 'transparent'},
      items: related.map(value => { const key = occurrenceKey('details', film.id, 'related', value.id);recommendations.set(key, value);
        return {...make(key, value.title, () => onOpen(value)), displayLabel: value.title, labelPlacement: 'bottom', outlineInsetBottom: 40 * u}; })}); }
    if (!related.length && !loading && !error) { rails.push({id: 'related-empty', itemExtent: viewport, itemStyle: s.pill,
      items: [make(occurrenceKey('details', 'related-empty'), 'Refresh related titles', () => setAttempt(value => value + 1))]}); }
    if (person) { rails.push({id: 'biography', itemExtent: viewport, itemStyle: s.pill, items: [make(occurrenceKey('details', 'biography-close'), 'Close biography', closeBiography)]}); }
    if (loading || error || (!people.length && !related.length)) { rails.push({id: 'information', itemExtent: viewport, itemStyle: s.pill,
      items: [make(occurrenceKey('details', 'retry'), error ? 'Retry details' : 'Play demo', error ? () => setAttempt(value => value + 1) : onPlay)]}); }
    return {rails, members, recommendations, play};
  }, [highContrast, viewport, u, s.pill, onPlay, onOpen, people, related, film.id, choose, relatedWidth, person, closeBiography, loading, error]);
  const decoration = useCallback((item: VirtualizedFocusItem) => {
    if (item.occurrenceKey === model.play) {
      return <View style={[s.virtualHero, s.row]}>
        <Picture source={filmArtwork(info, true)} style={s.poster} fallback="Artwork unavailable" />
        <View style={s.detailCopy}><Text accessibilityRole="header" numberOfLines={2} style={s.heroTitle}>{info.title}</Text>
          <Text numberOfLines={1} style={s.body}>{info.year || 'Year unavailable'} / {info.category}</Text>
          <Text numberOfLines={3} style={s.body}>{info.synopsis}</Text>
          <Text style={s.footer}>Demo playback: Big Buck Bunny for every title.</Text>
        </View>
      </View>;
    }
    const member = model.members.get(item.occurrenceKey);
    if (member) { return <Picture source={film.source ? member.portraitUrl ? {uri: member.portraitUrl} : undefined : portraits[member.id]}
      style={{width: 180 * u, height: 180 * u, borderRadius: 8 * u}} fallback="Portrait unavailable" />; }
    const recommendation = model.recommendations.get(item.occurrenceKey);
    if (recommendation) { return <Picture source={filmArtwork(recommendation)} style={{width: relatedWidth, height: relatedWidth * 9 / 16, borderRadius: 8 * u}} fallback="Artwork unavailable" />; }
    if (item.occurrenceKey === occurrenceKey('details', 'related-empty')) { return <View style={s.virtualHero}><Text style={s.body}>No related titles are available for this title.</Text></View>; }
    return <View style={s.virtualHero}><Text style={s.messageTitle}>{person ? person.name : error ? 'Couldn’t load details' : 'Cast & crew'}</Text>
      <Text numberOfLines={7} style={s.body}>{person ? bio : error || (loading ? 'Loading details…' : 'No additional cast or related titles available.')}</Text></View>;
  }, [model, s, u, relatedWidth, info, film.source, person, bio, error, loading]);
  const heading = useCallback((rail: VirtualizedFocusRail) => <Text style={s.virtualHeading}>{rail.id === 'cast' ? 'Cast & crew' : (rail.id === 'related' || rail.id === 'related-empty') ? 'More like this' : rail.id === 'biography' ? 'Biography' : ''}</Text>, [s.virtualHeading]);
  return <View style={s.fill} onLayout={event => setHeight(event.nativeEvent.layout.height)}>
    <View style={[s.pageBackdrop, {width: viewport + 80 * u}]} pointerEvents="none"><Backdrop film={info} details /></View>
    {height > 0 && <FocusVirtualizedRails active={active} onReady={onReady} id="title-content" rails={model.rails} rowExtent={400 * u} itemExtent={204 * u}
      viewportExtent={viewport} viewportRows={1} viewportHeight={Math.max(400 * u, height)} headerExtent={40 * u}
      renderDecoration={decoration} renderRailHeader={heading} />}
  </View>;
}
