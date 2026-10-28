import React, {useCallback, useEffect, useRef, useState} from 'react';
import {BackHandler, Image, Platform, Text, View} from 'react-native';
import {FocusProvider, FocusScope, occurrenceKey, useFocusCommands, useFocusReady, useFocusState} from 'itar/react';
import Browse from './src/Browse';
import Search from './src/Search';
import Details from './src/Details';
import Player from './src/Player';
import {Profiles, Settings} from './src/Preferences';
import {Action, art, icons, Picture} from './src/ui';
import {DesignTheme, useDesign} from './src/theme';
import type {ProviderMode} from './src/tmdb';
import type {Film} from './src/catalog';
const screens = ['Home', 'Movies', 'Series', 'Search', 'Profile', 'Settings'] as const;
type Screen = typeof screens[number];
const subtitles = {Home: '', Movies: 'Find your next story.', Series: 'Stories worth staying with.', Search: 'Find a title or genre.', Profile: '', Settings: 'Make the demo yours.'};
function Cinema({onOpenProbes}: {onOpenProbes?: () => void}) {
  const {s} = useDesign();
  const [mode, setMode] = useState<ProviderMode>('proxy');
  const [screen, setScreen] = useState<Screen>('Profile');
  const [film, setFilm] = useState<Film | null>(null);
  const [playing, setPlaying] = useState(false);
  const [profile, setProfile] = useState('Explorer');
  const [contrast, setContrast] = useState(false);
  const [slow, setSlow] = useState(false);
  const [notice, setNotice] = useState('');
  const fail = useRef(false);const [failureArmed, setFailureArmed] = useState(false);
  const takeFailure = useCallback(() => { const next = fail.current;fail.current = false;setFailureArmed(false);return next; }, []);
  const commands = useFocusCommands();const ready = useFocusReady();const focus = useFocusState();
  const focusRef = useRef(focus);const filmRef = useRef(film);
  useEffect(() => { focusRef.current = focus;if (focus.kind === 'managed') { setNotice(''); } }, [focus]);
  useEffect(() => { filmRef.current = film; }, [film]);
  const returning = useRef(false);const bookmark = useRef<string | null>(null);const entered = useRef('');
  const openPlayer = useCallback(() => setPlaying(true), []);
  const closeFilm = useCallback(() => { entered.current = '';setFilm(null); }, []);
  const closePlayer = useCallback(() => { entered.current = '';setPlaying(false); }, []);
  const openFilm = useCallback((value: Film) => {
    if (!filmRef.current) { bookmark.current = focusRef.current.occurrenceKey; }
    entered.current = '';setNotice('');setFilm(value);
  }, []);
  const page = `${profile}:${mode}:${screen}`;
  useEffect(() => {
    const handler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (playing) { closePlayer();return true; }
      if (film) { closeFilm();return true; }
      if (screen !== 'Home') { setScreen('Home');return true; }
      return false;
    });return () => handler.remove();
  }, [film, playing, screen, closeFilm, closePlayer]);
  useEffect(() => {
    if (!ready || film || playing || returning.current) { return; }
    const key = screen === 'Profile' ? occurrenceKey('profiles', profile) : occurrenceKey('nav', screen);
    const request = commands.focusByKey(key);return () => request.cancel();
  }, [commands, ready, film, playing, screen, profile, page]);
  const collectionReady = useCallback(() => {
    if (playing) { return; }
    const route = film ? `details:${film.id}` : page;
    if (entered.current === route) { return; }
    entered.current = route;
    if (!film && !returning.current) { return; }
    const key = film ? occurrenceKey('details', 'play') : bookmark.current;
    returning.current = !!film;
    if (key) { commands.focusByKey(key).result.then(result => {
      if (result.status !== 'applied' && result.status !== 'cancelled') { setNotice('Continue with your remote.'); }
    }); }
  }, [commands, film, page, playing]);
  const navigate = (name: Screen) => { returning.current = false;setNotice('');setScreen(name); };
  const options = {mode, id: page, active: !film && !playing, delay: slow ? 650 : 180, failNext: takeFailure, highContrast: contrast, onOpen: openFilm, onReady: collectionReady};
  if (screen === 'Profile' && !film) {
    return <FocusScope id="profile-chooser" layout="spatial" style={s.fill}>
      <Profiles id="profiles" profile={profile} highContrast={contrast} onSelect={name => { returning.current = false;setProfile(name);setScreen('Home'); }} />
    </FocusScope>;
  }
  return <View style={s.fill}><View style={[s.shell, playing && s.hidden]}>
    <FocusScope id="navigation" active={!film && !playing} layout="column" boundary="parent" style={[s.sidebar, film && s.inactiveSidebar]}>
      <Text style={s.brand}><Text style={s.brandStrong}>ITAR</Text> CINEMA</Text>
      <View style={s.nav}>{screens.map((name, index) => <View key={name} style={s.navRow}>
        {name === screen && <View accessible={false} style={s.routeMarker} />}
        <Action id={occurrenceKey('nav', name)} order={index} label={name} onPress={() => navigate(name)} highContrast={contrast} style={s.navAction} />
        <View pointerEvents="none" style={s.navIconSlot}><Image accessible={false} source={icons[name]} style={s.navIcon} /></View>
      </View>)}</View>
      <View style={s.sidebarBottom}>
        <View style={s.profileTag}><Action order={6} id={occurrenceKey('nav', 'profile-switcher')} label={`${profile}, switch profile`} displayLabel={profile}
          onPress={() => navigate('Profile')} highContrast={contrast} style={s.profileSwitcher} />
          <View pointerEvents="none" style={s.switcherAvatar}><Picture source={art[profile === 'Explorer' ? 0 : 3]} style={s.avatar} fallback="" /></View>
        </View>
        <Text style={s.fixtureLabel}>{mode === 'proxy' ? 'TMDB CATALOGUE' : 'FIXTURE CATALOGUE'}</Text>
      </View>
    </FocusScope>
    <View style={s.content}>
      <FocusScope id="page" active={!film && !playing} boundary="parent" style={[s.fill, film && s.hidden]}>
        <FocusScope key={page} id={page} layout="column" boundary="parent" style={s.fill}>
          {screen !== 'Home' && <><Text accessibilityRole="header" style={s.pageTitle}>{screen}</Text><Text style={s.subtitle}>{subtitles[screen]}</Text></>}
          {screen === 'Home' && <Browse {...options} kind="all" featured />}
          {screen === 'Movies' && <Browse {...options} kind="movie" />}
          {screen === 'Series' && <Browse {...options} kind="series" />}
          {screen === 'Search' && <Search {...options} />}
          {screen === 'Settings' && <Settings mode={mode} onMode={() => { returning.current = false;setMode(value => value === 'proxy' ? 'fixture' : 'proxy'); }} id={page} contrast={contrast} onContrast={() => setContrast(value => !value)}
            slow={slow} onSlow={() => setSlow(value => !value)} armed={failureArmed} onArm={() => { fail.current = !fail.current;setFailureArmed(fail.current); }} onOpenProbes={onOpenProbes} />}
        </FocusScope>
      </FocusScope>
      <FocusScope id="details" active={!!film && !playing} style={[s.fill, !film && s.hidden]}>
        {film && <Details active={!playing} onReady={collectionReady} key={film.id} film={film} onOpen={openFilm} onPlay={openPlayer} highContrast={contrast} />}
      </FocusScope>
      {!!notice && <Text style={s.footer}>{notice}</Text>}
    </View>
  </View>{playing && film && <View style={s.hiddenPlayer}><Player title={film.title} onClose={closePlayer} /></View>}</View>;
}
function TVApp({onOpenProbes}: {onOpenProbes?: () => void}) {
  const {s} = useDesign();
  if (!Platform.isTV || !['ios', 'android'].includes(Platform.OS)) { return <View style={s.shell}><Text style={s.body}>This consumer requires the Itar native adapter on tvOS or Android TV.</Text></View>; }
  return <FocusProvider style={s.fill}><Cinema onOpenProbes={onOpenProbes} /></FocusProvider>;
}
function Launch({onOpenProbes}: {onOpenProbes?: () => void}) {
  const {s} = useDesign();const [splash, setSplash] = useState(true);
  useEffect(() => { const timer = setTimeout(() => setSplash(false), 1200);return () => clearTimeout(timer); }, []);
  return splash ? <View style={s.splash}><Text style={s.splashBrand}><Text style={s.brandStrong}>ITAR</Text> CINEMA</Text><Text style={s.muted}>Stories worth exploring.</Text></View> : <TVApp onOpenProbes={onOpenProbes} />;
}
export default function OttApp({onOpenProbes}: {onOpenProbes?: () => void}) {
  return <DesignTheme><Launch onOpenProbes={onOpenProbes} /></DesignTheme>;
}
