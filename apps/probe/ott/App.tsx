import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, BackHandler, Image, Platform, Text, View } from 'react-native';
import {
  FocusProvider,
  FocusScope,
  occurrenceKey,
  useFocusCommands,
  useFocusReady,
  useFocusState,
} from 'itar/react';
import Auth from './src/Auth';
import Epg from './src/Epg';
import Browse from './src/Browse';
import Catalogue from './src/Catalogue';
import Search from './src/Search';
import Details from './src/Details';
import Player from './src/Player';
import { Profiles, Settings } from './src/Preferences';
import { Action, art, icons, Picture } from './src/ui';
import { DesignTheme, useDesign } from './src/theme';
import type { ProviderMode } from './src/tmdb';
import type { Film } from './src/catalog';
import { readBrowserSession, saveBrowserSession } from './src/browser-session';

const screens = [
  'Home',
  'Movies',
  'Series',
  'Search',
  'Profile',
  'Settings',
] as const;

type Screen = (typeof screens)[number];

const subtitles = {
  Home: '',
  Movies: 'Find your next story.',
  Series: 'Stories worth staying with.',
  Search: 'Find a title or genre.',
  Profile: '',
  Settings: 'Make the demo yours.',
};

function Cinema({ onOpenProbes }: { onOpenProbes?: () => void }) {
  const { s, u } = useDesign();
  const [savedSession] = useState(readBrowserSession);
  const [authenticated, setAuthenticated] = useState(!!savedSession);
  const [guideOpen, setGuideOpen] = useState(false);

  const [mode, setMode] = useState<ProviderMode>(
    savedSession?.mode ?? (Platform.OS === 'web' ? 'fixture' : 'proxy'),
  );

  const [screen, setScreen] = useState<Screen>(
    savedSession ? 'Home' : 'Profile',
  );

  const [film, setFilm] = useState<Film | null>(null);
  const [playing, setPlaying] = useState(false);
  const [profile, setProfile] = useState(savedSession?.profile ?? 'Explorer');
  const [contrast, setContrast] = useState(false);
  const [slow, setSlow] = useState(false);
  const [notice, setNotice] = useState('');
  const [entryVersion, setEntryVersion] = useState(0);
  const [entering, setEntering] = useState(true);
  const [pendingEntry, setPendingEntry] = useState<(() => void) | null>(null);
  const exitPrompt = useRef(false);
  const fail = useRef(false);
  const [failureArmed, setFailureArmed] = useState(false);

  useEffect(() => {
    saveBrowserSession(authenticated ? { mode, profile } : null);
  }, [authenticated, mode, profile]);

  const takeFailure = useCallback(() => {
    const next = fail.current;

    fail.current = false;
    setFailureArmed(false);

    return next;
  }, []);

  const commands = useFocusCommands();
  const ready = useFocusReady();
  const focus = useFocusState();

  const expanded =
    focus.kind === 'managed' &&
    [...screens, 'profile-switcher', 'signout'].some(
      name => focus.occurrenceKey === occurrenceKey('nav', name),
    );

  const focusRef = useRef(focus);
  const filmRef = useRef(film);

  useEffect(() => {
    focusRef.current = focus;

    if (focus.kind === 'managed') {
      setNotice('');
    }
  }, [focus]);

  useEffect(() => {
    filmRef.current = film;
  }, [film]);

  const returning = useRef(false);
  const bookmark = useRef<string | null>(null);
  const entered = useRef('');

  const entryRequest = useRef<ReturnType<typeof commands.focusByKey> | null>(
    null,
  );

  const beginEntry = useCallback((change: () => void) => {
    // Keep Android's temporary fallback focus out of sidebar history while
    // the previous content unmounts and the next target becomes ready.
    entryRequest.current?.cancel();
    entryRequest.current = null;
    entered.current = '';
    setEntering(true);
    setPendingEntry(() => change);
  }, []);

  useEffect(() => {
    // Commit the sidebar and page entry guards before removing focused content.
    if (pendingEntry) {
      pendingEntry();
      setPendingEntry(null);
    }
  }, [pendingEntry]);

  const openPlayer = useCallback(
    () => beginEntry(() => setPlaying(true)),
    [beginEntry],
  );

  const closeFilm = useCallback(() => {
    beginEntry(() => setFilm(null));
  }, [beginEntry]);

  const closePlayer = useCallback(() => {
    beginEntry(() => setPlaying(false));
  }, [beginEntry]);

  const openFilm = useCallback(
    (value: Film) => {
      if (!filmRef.current) {
        bookmark.current = focusRef.current.occurrenceKey;
      }

      beginEntry(() => setFilm(value));
      setNotice('');
    },
    [beginEntry],
  );

  const page = `${profile}:${mode}:${screen}`;

  const restoreNavigation = useCallback(() => {
    commands.restoreScope(['navigation']).result.then(result => {
      if (result.status !== 'applied' && result.status !== 'cancelled') {
        setNotice('Navigation focus could not be restored.');
      }
    });
  }, [commands]);

  useEffect(() => {
    const handler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!authenticated || guideOpen) {
        return false;
      }

      if (playing) {
        closePlayer();

        return true;
      }

      if (film) {
        closeFilm();

        return true;
      }

      if (screen === 'Profile' || screen === 'Settings') {
        returning.current = false;
        beginEntry(() => setScreen('Home'));

        return true;
      }

      if (!expanded) {
        entryRequest.current?.cancel();
        entryRequest.current = null;
        entered.current = `${page}:${entryVersion}`;
        setEntering(false);
        restoreNavigation();

        return true;
      }

      if (!exitPrompt.current) {
        exitPrompt.current = true;

        const cancelExit = () => {
          exitPrompt.current = false;
          restoreNavigation();
        };

        Alert.alert(
          'Exit Itar?',
          Platform.OS === 'android'
            ? 'Would you like to exit the application?'
            : 'Use the Home button on your remote to leave Itar.',
          Platform.OS === 'android'
            ? [
                { text: 'Cancel', style: 'cancel', onPress: cancelExit },
                { text: 'Exit', onPress: () => BackHandler.exitApp() },
              ]
            : [{ text: 'Cancel', onPress: cancelExit }],
          {
            cancelable: true,
            onDismiss: cancelExit,
          },
        );
      }

      return true;
    });

    return () => handler.remove();
  }, [
    authenticated,
    guideOpen,
    film,
    playing,
    screen,
    expanded,
    closeFilm,
    closePlayer,
    restoreNavigation,
    beginEntry,
    page,
    entryVersion,
  ]);

  useEffect(() => {
    if (
      !ready ||
      !authenticated ||
      guideOpen ||
      film ||
      playing ||
      screen !== 'Profile'
    ) {
      return;
    }

    const request = commands.focusByKey(occurrenceKey('profiles', profile));

    return () => request.cancel();
  }, [
    commands,
    ready,
    authenticated,
    guideOpen,
    film,
    playing,
    screen,
    profile,
    page,
  ]);

  const collectionReady = useCallback(
    (initialKey?: string) => {
      if (playing || guideOpen || pendingEntry) {
        return;
      }

      const route = film ? `details:${film.id}` : `${page}:${entryVersion}`;

      if (entered.current === route) {
        return;
      }

      const key = film
        ? occurrenceKey('details', 'play')
        : returning.current
        ? bookmark.current
        : initialKey;

      if (!key) {
        return;
      }

      entered.current = route;
      returning.current = !!film;

      const request = commands.focusByKey(key);

      entryRequest.current = request;

      request.result.then(result => {
        if (entryRequest.current !== request) {
          return;
        }

        entryRequest.current = null;
        setEntering(false);

        if (result.status !== 'applied' && result.status !== 'cancelled') {
          setNotice('Continue with your remote.');
        }
      });
    },
    [commands, film, page, playing, guideOpen, entryVersion, pendingEntry],
  );

  const navigate = (name: Screen) => {
    returning.current = false;

    beginEntry(() => {
      setEntryVersion(value => value + 1);
      setFilm(null);
      setScreen(name);
    });

    setNotice('');
  };

  const closeGuide = useCallback(() => {
    beginEntry(() => setGuideOpen(false));
  }, [beginEntry]);

  const openGuide = () => {
    bookmark.current = focusRef.current.occurrenceKey;
    returning.current = true;
    beginEntry(() => setGuideOpen(true));
  };

  if (!authenticated) {
    return (
      <Auth
        onSignIn={() => {
          setAuthenticated(true);
          setScreen('Profile');
        }}
      />
    );
  }

  const options = {
    mode,
    id: page,
    active: !film && !playing && !guideOpen,
    delay: slow ? 650 : 180,
    failNext: takeFailure,
    highContrast: contrast,
    onOpen: openFilm,
    onReady: collectionReady,
  };

  if (screen === 'Profile' && !film) {
    return (
      <FocusScope id="profile-chooser" layout="spatial" style={s.fill}>
        <Profiles
          id="profiles"
          profile={profile}
          highContrast={contrast}
          onSelect={name => {
            returning.current = false;

            beginEntry(() => {
              setProfile(name);
              setScreen('Home');
            });
          }}
        />
      </FocusScope>
    );
  }

  return (
    <View style={s.fill}>
      <View style={[s.shell, (playing || guideOpen) && s.hidden]}>
        <View style={s.sidebarSlot}>
          <FocusScope
            id={screen === 'Settings' ? 'account-navigation' : 'navigation'}
            active={!playing && !guideOpen && !entering}
            layout="column"
            boundary="parent"
            preferredKey={occurrenceKey('nav', screen)}
            restoreOnEntry
            style={[
              s.sidebar,
              s.sidebarOverlay,
              { width: (expanded ? 360 : 112) * u },
            ]}
          >
            <Text numberOfLines={1} style={s.brand}>
              <Text style={s.brandStrong}>{expanded ? 'ITAR' : 'I'}</Text>
              {expanded ? ' CINEMA' : ''}
            </Text>
            <View style={s.nav}>
              {screens.map((name, index) => (
                <View key={name} style={s.navRow}>
                  {name === screen && (
                    <View accessible={false} style={s.routeMarker} />
                  )}
                  <Action
                    id={occurrenceKey('nav', name)}
                    order={index}
                    label={name}
                    displayLabel={expanded ? name : ''}
                    onPress={() => navigate(name)}
                    highContrast={contrast}
                    style={[s.navAction, expanded && s.expandedNav]}
                  />
                  <View pointerEvents="none" style={s.navIconSlot}>
                    <Image
                      accessible={false}
                      source={icons[name]}
                      style={s.navIcon}
                    />
                  </View>
                </View>
              ))}
            </View>
            <View style={s.sidebarBottom}>
              <View style={s.profileTag}>
                <Action
                  order={6}
                  id={occurrenceKey('nav', 'profile-switcher')}
                  label={`${profile}, switch profile`}
                  displayLabel={expanded ? profile : ''}
                  onPress={() => navigate('Profile')}
                  highContrast={contrast}
                  style={[
                    s.profileSwitcher,
                    { width: (expanded ? 312 : 64) * u },
                  ]}
                />
                <View pointerEvents="none" style={s.switcherAvatar}>
                  <Picture
                    source={art[profile === 'Explorer' ? 0 : 3]}
                    style={s.avatar}
                    fallback=""
                  />
                </View>
              </View>
              <View style={s.navRow}>
                <Action
                  order={7}
                  id={occurrenceKey('nav', 'signout')}
                  label="Sign out"
                  displayLabel={expanded ? 'Sign out' : ''}
                  onPress={() => {
                    saveBrowserSession(null);
                    returning.current = false;
                    bookmark.current = null;
                    entered.current = '';
                    setFilm(null);
                    setPlaying(false);
                    setScreen('Profile');
                    setAuthenticated(false);
                  }}
                  style={[s.navAction, { width: (expanded ? 312 : 64) * u }]}
                />
                <View pointerEvents="none" style={s.navIconSlot}>
                  <Image
                    source={require('./assets/cinematic/icons/arrow-left.png')}
                    style={s.navIcon}
                  />
                </View>
              </View>
              {expanded && (
                <Text style={s.fixtureLabel}>
                  {mode === 'proxy' ? 'TMDB CATALOGUE' : 'FIXTURE CATALOGUE'}
                </Text>
              )}
            </View>
          </FocusScope>
        </View>
        <View style={[s.content, screen === 'Home' && !film && s.homeContent]}>
          <FocusScope
            id="page"
            active={!film && !playing && !guideOpen}
            entryReady={!entering}
            boundary="parent"
            style={[s.fill, film && s.hidden]}
          >
            <FocusScope
              key={page}
              id={page}
              layout="spatial"
              boundary="parent"
              style={s.fill}
            >
              {screen !== 'Home' && (
                <>
                  <Text accessibilityRole="header" style={s.pageTitle}>
                    {screen}
                  </Text>
                  <Text style={s.subtitle}>{subtitles[screen]}</Text>
                </>
              )}
              {screen === 'Home' && (
                <Browse {...options} kind="all" featured onGuide={openGuide} />
              )}
              {screen === 'Movies' && <Catalogue {...options} kind="movie" />}
              {screen === 'Series' && <Catalogue {...options} kind="series" />}
              {screen === 'Search' && <Search {...options} />}
              {screen === 'Settings' && (
                <Settings
                  onReady={collectionReady}
                  mode={mode}
                  onMode={() => {
                    returning.current = false;

                    beginEntry(() =>
                      setMode(value =>
                        value === 'proxy' ? 'fixture' : 'proxy',
                      ),
                    );
                  }}
                  id={page}
                  contrast={contrast}
                  onContrast={() => setContrast(value => !value)}
                  slow={slow}
                  onSlow={() => setSlow(value => !value)}
                  armed={failureArmed}
                  onArm={() => {
                    fail.current = !fail.current;
                    setFailureArmed(fail.current);
                  }}
                  onOpenProbes={onOpenProbes}
                />
              )}
            </FocusScope>
          </FocusScope>
          <FocusScope
            id="details"
            boundary="parent"
            active={!!film && !playing}
            entryReady={!entering}
            style={[s.fill, !film && s.hidden]}
          >
            {film && (
              <Details
                active={!playing}
                onReady={collectionReady}
                key={film.id}
                film={film}
                onOpen={openFilm}
                onPlay={openPlayer}
                highContrast={contrast}
              />
            )}
          </FocusScope>
          {!!notice && <Text style={s.footer}>{notice}</Text>}
        </View>
      </View>
      {guideOpen && (
        <View style={s.hiddenPlayer}>
          <Epg onClose={closeGuide} />
        </View>
      )}
      {playing && film && (
        <View style={s.hiddenPlayer}>
          <Player title={film.title} onClose={closePlayer} />
        </View>
      )}
    </View>
  );
}

function TVApp({ onOpenProbes }: { onOpenProbes?: () => void }) {
  const { s } = useDesign();

  if (
    Platform.OS !== 'web' &&
    (!Platform.isTV || !['ios', 'android'].includes(Platform.OS))
  ) {
    return (
      <View style={s.shell}>
        <Text style={s.body}>
          This consumer requires the Itar native adapter on tvOS or Android TV.
        </Text>
      </View>
    );
  }

  return (
    <FocusProvider style={s.fill}>
      <Cinema onOpenProbes={onOpenProbes} />
    </FocusProvider>
  );
}

function Launch({ onOpenProbes }: { onOpenProbes?: () => void }) {
  const { s } = useDesign();
  const [splash, setSplash] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setSplash(false), 1200);

    return () => clearTimeout(timer);
  }, []);

  return splash ? (
    <View style={s.splash}>
      <Text style={s.splashBrand}>
        <Text style={s.brandStrong}>ITAR</Text> CINEMA
      </Text>
      <Text style={s.muted}>Stories worth exploring.</Text>
    </View>
  ) : (
    <TVApp onOpenProbes={onOpenProbes} />
  );
}

export default function OttApp({
  onOpenProbes,
}: {
  onOpenProbes?: () => void;
}) {
  return (
    <DesignTheme>
      <Launch onOpenProbes={onOpenProbes} />
    </DesignTheme>
  );
}
