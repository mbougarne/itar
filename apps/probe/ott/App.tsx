import React, {useCallback, useEffect, useRef, useState} from 'react';
import {BackHandler, Platform, Text, View} from 'react-native';
import {FocusProvider, FocusScope, occurrenceKey, useFocusCommands, useFocusReady} from 'itar/react';
import Browse from './src/Browse';
import Search from './src/Search';
import Details from './src/Details';
import {Action, Header, css} from './src/ui';
import type {Film} from './src/catalog';
const screens = ['Home', 'Movies', 'Series', 'Search', 'Profile', 'Settings'] as const;
type Screen = typeof screens[number];
function Cinema({onOpenProbes}: {onOpenProbes?: () => void}) {
  const [screen, setScreen] = useState<Screen>('Home');
  const [film, setFilm] = useState<Film | null>(null);
  const [profile, setProfile] = useState('Explorer');
  const [contrast, setContrast] = useState(false);
  const [slow, setSlow] = useState(false);
  const [notice, setNotice] = useState('');
  const fail = useRef(false);
  const [failureArmed, setFailureArmed] = useState(false);
  const takeFailure = useCallback(() => { const next = fail.current; fail.current = false; setFailureArmed(false); return next; }, []);
  const commands = useFocusCommands();
  const ready = useFocusReady();
  const returning = useRef(false);
  const page = `${profile}:${screen}`;
  useEffect(() => {
    const handler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (film) { setFilm(null); return true; }
      if (screen !== 'Home') { setScreen('Home'); return true; }
      return false;
    });
    return () => handler.remove();
  }, [film, screen]);
  useEffect(() => {
    if (!ready) { return; }
    setNotice('');
    const request = film ? commands.focusByKey(occurrenceKey('details', 'back')) : returning.current
      ? commands.restoreScope(['page', page]) : commands.focusByKey(occurrenceKey('nav', screen));
    returning.current = !!film;
    let current = true;
    request.result.then(result => {
      if (current && result.status !== 'applied' && result.status !== 'cancelled') {
        setNotice('Focus request unavailable. Continue with your remote.');
      }
    });
    return () => { current = false; request.cancel(); };
  }, [commands, ready, film, screen, page]);
  const options = {id: page, active: !film, delay: slow ? 650 : 180, failNext: takeFailure, highContrast: contrast, onOpen: setFilm};
  return <View style={css.screen}>
    <Text style={css.title}>itar / cinema</Text>
    <FocusScope id="navigation" active={!film} layout="row" boundary="parent" style={css.row}>
      {screens.map(name => <Action key={name} id={occurrenceKey('nav', name)} label={name === screen ? `${name} · current` : name}
        onPress={() => { returning.current = false; setScreen(name); }} highContrast={contrast} />)}
    </FocusScope>
    <Text style={css.footer}>{profile} · Local asynchronous fixtures · No live service</Text>
    <View style={css.fill}>
      <FocusScope id="page" active={!film} boundary="parent" style={[css.fill, film && css.hidden]}>
        <FocusScope key={page} id={page} layout="column" boundary="parent" style={css.fill}>
          {screen === 'Home' && <Browse {...options} kind="all" featured />}
          {screen === 'Movies' && <Browse {...options} kind="movie" />}
          {screen === 'Series' && <Browse {...options} kind="series" />}
          {screen === 'Search' && <Search {...options} />}
          {screen === 'Profile' && <View style={css.column}><Header>Choose a local profile</Header>
            <Text style={css.body}>Synthetic profiles, kept only for this session. Switching resets catalogue routes and search.</Text>
            {['Explorer', 'Stargazer'].map(name => <Action key={name} id={occurrenceKey(page, name)} label={name === profile ? `${name} · selected` : `Use ${name}`}
              onPress={() => { returning.current = false; setProfile(name); setNotice(`Using ${name}`); }} highContrast={contrast} />)}
          </View>}
          {screen === 'Settings' && <View style={css.column}><Header>Settings</Header>
            <Action id={occurrenceKey(page, 'contrast')} label={`White focus accent: ${contrast ? 'on' : 'off'}`} onPress={() => setContrast(value => !value)} highContrast={contrast} />
            <Action id={occurrenceKey(page, 'delay')} label={`Slow fixture requests: ${slow ? 'on (650 ms)' : 'off (180 ms)'}`} onPress={() => setSlow(value => !value)} highContrast={contrast} />
            <Header>Fixture scenarios</Header>
            {__DEV__ && onOpenProbes && <Action id={occurrenceKey(page, 'probes')} label="Open original Itar probes" onPress={onOpenProbes} highContrast={contrast} />}
            <Action id={occurrenceKey(page, 'failure')} label={failureArmed ? 'Next request failure armed' : 'Fail the next local fetch'}
              onPress={() => { fail.current = !fail.current; setFailureArmed(fail.current); }} highContrast={contrast} />
            <Text style={css.body}>Visit a catalogue to consume the failure, then Retry. Settings last for this session. No autoplay or motion effects.</Text>
            <Text style={css.footer}>Original fictional titles, people and procedural artwork. No accounts, external assets or playback.</Text>
          </View>}
        </FocusScope>
      </FocusScope>
      <FocusScope id="details" active={!!film} style={[css.fill, !film && css.hidden]}>
        {film && <Details key={film.id} film={film} onBack={() => setFilm(null)} highContrast={contrast} />}
      </FocusScope>
    </View>
    {!!notice && <Text style={css.footer}>{notice}</Text>}
  </View>;
}
export default function OttApp({onOpenProbes}: {onOpenProbes?: () => void}) {
  if (!Platform.isTV || !['ios', 'android'].includes(Platform.OS)) {
    return <View style={css.screen}><Text style={css.white}>This consumer requires the Itar native adapter on tvOS or Android TV.</Text></View>;
  }
  return <FocusProvider style={css.fill}><Cinema onOpenProbes={onOpenProbes} /></FocusProvider>;
}
