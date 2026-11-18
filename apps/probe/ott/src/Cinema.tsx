import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, BackHandler, Platform, Text, View } from 'react-native';
import {
  FocusScope,
  occurrenceKey,
  useFocusCommands,
  useFocusReady,
  useFocusState,
} from 'itar/react';
import Auth from './Auth';
import Epg from './Epg';
import Browse from './Browse';
import Catalogue from './Catalogue';
import Search from './Search';
import Details from './Details';
import Player from './Player';
import { Profiles } from './Profiles';
import { Settings } from './Settings';
import { Sidebar } from './Sidebar';
import { screens, subtitles, type Screen } from './navigation';
import { androidVerticalBoundary } from './android-focus-boundary';
import { useDesign } from './theme';
import type { ProviderMode, Film } from './catalog-types';
import { readBrowserSession, saveBrowserSession } from './browser-session';

export default function Cinema({
  onOpenProbes,
}: {
  onOpenProbes?: () => void;
}) {
  const { s } = useDesign();
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

  const filmRef = useRef(film);

  useEffect(() => {
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
    if (Platform.OS === 'android') returning.current = true;

    beginEntry(() => setFilm(null));
  }, [beginEntry]);

  const closePlayer = useCallback(() => {
    beginEntry(() => setPlaying(false));
  }, [beginEntry]);

  const openFilm = useCallback(
    (value: Film, openerKey: string) => {
      if (!filmRef.current) {
        bookmark.current = openerKey;
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

      const restoring = !film && returning.current;

      const key = film
        ? occurrenceKey('details', 'play')
        : restoring
        ? bookmark.current
        : initialKey;

      if (!key) {
        return;
      }

      entered.current = route;

      if (Platform.OS !== 'android') returning.current = !!film;

      const request =
        Platform.OS === 'android' && restoring
          ? commands.restoreFocusByKey(key)
          : commands.focusByKey(key);

      entryRequest.current = request;

      request.result.then(result => {
        if (entryRequest.current !== request) {
          return;
        }

        if (Platform.OS === 'android') returning.current = !!film;

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

  const openGuide = (openerKey: string) => {
    bookmark.current = openerKey;
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
        <Sidebar
          active={!playing && !guideOpen && !entering}
          expanded={expanded}
          profile={profile}
          contrast={contrast}
          mode={mode}
          screen={screen}
          onNavigate={navigate}
          onSignOut={() => {
            saveBrowserSession(null);
            returning.current = false;
            bookmark.current = null;
            entered.current = '';
            setFilm(null);
            setPlaying(false);
            setScreen('Profile');
            setAuthenticated(false);
          }}
        />
        <View
          // Use the TV fork's native View flags without adding a focus owner.
          {...androidVerticalBoundary}
          style={[s.content, screen === 'Home' && !film && s.homeContent]}
        >
          <FocusScope
            id="page"
            accessibilityPaneTitle={
              Platform.OS === 'android' && !entering ? screen : undefined
            }
            active={!film && !playing && !guideOpen}
            // Native reader entry stays available initially. Hold automatic
            // fallback only during the explicit return, through confirmation.
            entryReady={
              !entering || (Platform.OS === 'android' && !returning.current)
            }
            preferredKey={
              Platform.OS === 'android' && entering && returning.current
                ? bookmark.current ?? undefined
                : undefined
            }
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
            accessibilityPaneTitle={
              Platform.OS === 'android' && !entering ? film?.title : undefined
            }
            boundary="parent"
            active={!!film && !playing}
            entryReady={Platform.OS === 'android' || !entering}
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
