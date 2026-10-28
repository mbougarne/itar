import React, {useEffect, useState} from 'react';
import {Image, Text, View, type StyleProp, type ViewStyle, type ImageSourcePropType} from 'react-native';
import {Focusable} from 'itar/react';
import type {Film} from './catalog';
import {useDesign} from './theme';
export const art = [
  require('../assets/cinematic/atlas.jpg'), require('../assets/cinematic/night.jpg'),
  require('../assets/cinematic/tide.jpg'), require('../assets/cinematic/signal.jpg'),
  require('../assets/cinematic/glass.jpg'), require('../assets/cinematic/letters.jpg'),
  require('../assets/cinematic/lights.jpg'), require('../assets/cinematic/home.jpg'),
];
export const portraits: Readonly<Partial<Record<string, ImageSourcePropType>>> = {
  aya: require('../assets/cinematic/cast-aya.jpg'), sami: require('../assets/cinematic/cast-sami.jpg'),
  lina: require('../assets/cinematic/cast-lina.jpg'), noor: require('../assets/cinematic/cast-noor.jpg'),
};
export const icons = {
  Home: require('../assets/cinematic/icons/home.png'), Movies: require('../assets/cinematic/icons/film.png'),
  Series: require('../assets/cinematic/icons/monitor.png'), Search: require('../assets/cinematic/icons/search.png'),
  Profile: require('../assets/cinematic/icons/user.png'), Settings: require('../assets/cinematic/icons/settings.png'),
  check: require('../assets/cinematic/icons/check.png'),
};
const accents = {cyan: {accentColor: '#26D9F2'}, white: {accentColor: '#FFFFFF'}};
export function Action({id, label, onPress, enabled = true, highContrast = false, contentId, style, order = 0, displayLabel}: {
  displayLabel?: string; order?: number; id: string; label: string; onPress: () => void; enabled?: boolean; highContrast?: boolean; contentId?: string; style?: StyleProp<ViewStyle>;
}) {
  const {s, u} = useDesign();
  return <Focusable displayLabel={displayLabel ?? label} labelSize={24 * u} order={order} occurrenceKey={id} contentId={contentId} accessibilityLabel={label} enabled={enabled} onPress={onPress}
    baseAccentColor="#BDC8D3" focusStyle={highContrast ? accents.white : accents.cyan} style={[s.action, style]} />;
}
export function Picture({source, style, fallback}: {source?: ImageSourcePropType; style: StyleProp<Pick<ViewStyle, 'width' | 'height' | 'borderRadius'>>; fallback: string}) {
  const {s} = useDesign();
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [source]);
  return !source || failed ? <View accessible={false} style={[style, s.fallback]}><Text accessible={false} style={s.muted}>{fallback}</Text></View>
    : <Image accessible={false} source={source} resizeMode="cover" style={style} onError={() => setFailed(true)} />;
}
export function filmArtwork(film: Film, poster = false): ImageSourcePropType | undefined {
  if (film.source) {
    const uri = poster ? film.posterUrl : film.backdropUrl || film.posterUrl;
    return uri ? {uri} : undefined;
  }
  return art[film.art];
}
export function Artwork({film, poster = false}: {film: Film; poster?: boolean}) {
  const {s} = useDesign();
  return <Picture source={filmArtwork(film, poster)} style={poster ? s.poster : s.landscape} fallback="Artwork unavailable" />;
}
export function Backdrop({film, details = false}: {film: Film; details?: boolean}) {
  const {s} = useDesign();
  const source = filmArtwork(film);
  return <View pointerEvents="none" accessible={false} style={s.backdrop}>
    {source && <Image accessible={false} source={source} style={s.heroImage} resizeMode="cover" />}
    <Image accessible={false} source={require('../assets/cinematic/scrim.png')} style={s.scrim} resizeMode="stretch" />
    {details && <View style={s.detailShade} />}
  </View>;
}
export function Header({children}: {children: React.ReactNode}) {
  const {s} = useDesign();
  return <Text accessibilityRole="header" style={s.heading}>{children}</Text>;
}
export function Card({film, id, poster, onPress, highContrast}: {
  film: Film; id: string; poster: boolean; onPress: () => void; highContrast: boolean;
}) {
  const {s} = useDesign();
  return <View style={poster ? s.posterCard : s.landscapeCard}>
    <Artwork film={film} poster={poster} />
    <Action id={id} contentId={film.id} label={`${film.title}, ${film.kind === 'movie' ? 'Movie' : 'Series'}`}
      onPress={onPress} highContrast={highContrast} style={s.cardAction} />
    <Text style={s.muted}>{film.year} · {film.kind === 'movie' ? 'Movie' : 'Series'}</Text>
  </View>;
}
