import type { ImageSourcePropType } from 'react-native';
import type { Film } from './catalog-types';

export const art = [
  require('../assets/cinematic/atlas.jpg'),
  require('../assets/cinematic/night.jpg'),
  require('../assets/cinematic/tide.jpg'),
  require('../assets/cinematic/signal.jpg'),
  require('../assets/cinematic/glass.jpg'),
  require('../assets/cinematic/letters.jpg'),
  require('../assets/cinematic/lights.jpg'),
  require('../assets/cinematic/home.jpg'),
];

export const portraits: Readonly<Partial<Record<string, ImageSourcePropType>>> =
  {
    aya: require('../assets/cinematic/cast-aya.jpg'),
    sami: require('../assets/cinematic/cast-sami.jpg'),
    lina: require('../assets/cinematic/cast-lina.jpg'),
    noor: require('../assets/cinematic/cast-noor.jpg'),
  };

export const icons = {
  Home: require('../assets/cinematic/icons/home.png'),
  Movies: require('../assets/cinematic/icons/film.png'),
  Series: require('../assets/cinematic/icons/monitor.png'),
  Search: require('../assets/cinematic/icons/search.png'),
  Profile: require('../assets/cinematic/icons/user.png'),
  Settings: require('../assets/cinematic/icons/settings.png'),
  check: require('../assets/cinematic/icons/check.png'),
  play: require('../assets/cinematic/icons/play.png'),
  pause: require('../assets/cinematic/icons/pause.png'),
  restart: require('../assets/cinematic/icons/rotate-ccw.png'),
  rewind: require('../assets/cinematic/icons/rewind.png'),
  forward: require('../assets/cinematic/icons/fast-forward.png'),
  volume: require('../assets/cinematic/icons/volume-2.png'),
  muted: require('../assets/cinematic/icons/volume-x.png'),
  close: require('../assets/cinematic/icons/x.png'),
  like: require('../assets/cinematic/icons/heart.png'),
};

export function filmArtwork(
  film: Film,
  poster = false,
): ImageSourcePropType | undefined {
  if (film.source) {
    const uri = poster ? film.posterUrl : film.backdropUrl || film.posterUrl;

    return uri ? { uri } : undefined;
  }

  return art[film.art];
}
