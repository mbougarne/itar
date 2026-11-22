import React, {
  memo,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  Platform,
  Text,
  View,
} from 'react-native';
import {
  FocusScope,
  occurrenceKey,
  useFocusCommands,
  useFocusReady,
  useFocusState,
  type FocusState,
} from 'itar/react';
import Auth from './Auth';
import Epg from './Epg';
import Browse from './Browse';
import Catalogue from './Catalogue';
import Search from './Search';
import { hasDeviceProxy } from './tmdb';
import Details from './Details';
import Player from './Player';
import MyList from './MyList';
import { libraryId } from './profile-library';
import { useProfileLibrary } from './useProfileLibrary';
import { Profiles } from './Profiles';
import { Settings } from './Settings';
import { Sidebar } from './Sidebar';
import {
  detailControlKeys,
  screens,
  subtitles,
  type Screen,
} from './navigation';
import { androidVerticalBoundary } from './android-focus-boundary';
import { useDesign } from './theme';
import { useAppleTVMenu } from './useAppleTVMenu';
import type { ProviderMode, Film } from './catalog-types';
import { BrowserNavigation } from './browser-navigation';
import { readBrowserSession, saveBrowserSession } from './browser-session';

type DetailsVisit = { film: Film; openerKey: string };

const HomeBrowse = memo(Browse);

const webContentOrder = Platform.OS === 'web' ? { order: 1 } : {};

function CinemaShell(props: React.ComponentProps<typeof View>) {
  if (Platform.OS !== 'web') return <View {...props} />;

  // Overscan can put mounted cards behind the sidebar. The two regions keep
  // their left-to-right order regardless of either rail's scroll offset.
  return (
    <View {...props}>
      <FocusScope id="shell" layout="row" style={props.style}>
        {props.children}
      </FocusScope>
    </View>
  );
}

const sidebarKeys = new Set(
  [...screens, 'profile-switcher', 'signout'].map(name =>
    occurrenceKey('nav', name),
  ),
);

type CinemaProps = { onOpenProbes?: () => void };

type HomeArrival = { key: string; onFocus: () => void };

// Watch host input focus here. The route tree only needs the sidebar boundary,
// and a new managed observation dismisses any outstanding navigation notice.
export default function Cinema(props: CinemaProps) {
  const focus = useFocusState();
  const observedFocus = useRef(focus);
  const homeArrival = useRef<HomeArrival | null>(null);

  useLayoutEffect(() => {
    observedFocus.current = focus;

    const arrival = homeArrival.current;

    if (
      arrival &&
      focus.kind === 'managed' &&
      focus.occurrenceKey === arrival.key
    ) {
      homeArrival.current = null;
      arrival.onFocus();
    }
  }, [focus]);

  const [notice, setNotice] = useState('');

  const expanded =
    focus.kind === 'managed' &&
    focus.occurrenceKey !== null &&
    sidebarKeys.has(focus.occurrenceKey);

  useEffect(() => {
    if (focus.kind === 'managed') setNotice('');
  }, [focus]);

  return (
    <CinemaRoutes
      {...props}
      expanded={expanded}
      observedFocus={observedFocus}
      homeArrival={homeArrival}
      notice={notice}
      setNotice={setNotice}
    />
  );
}

const CinemaRoutes = memo(function RouteTree({
  onOpenProbes,
  expanded,
  observedFocus,
  homeArrival,
  notice,
  setNotice,
}: CinemaProps & {
  expanded: boolean;
  observedFocus: React.RefObject<FocusState>;
  homeArrival: React.RefObject<HomeArrival | null>;
  notice: string;
  setNotice: (value: string) => void;
}) {
  const { s } = useDesign();
  const systemBackAtRoot = useContext(BrowserNavigation)?.systemBackAtRoot;
  const [savedSession] = useState(readBrowserSession);
  const [authenticated, setAuthenticated] = useState(!!savedSession);
  const [guideOpener, setGuideOpener] = useState<string>();
  const guideOpen = !!guideOpener;

  const [mode, setMode] = useState<ProviderMode>(
    savedSession?.mode ??
      (Platform.OS === 'web' && !hasDeviceProxy ? 'fixture' : 'proxy'),
  );

  const [screen, setScreen] = useState<Screen>(
    savedSession ? 'Home' : 'Profile',
  );

  const [detailsHistory, setDetailsHistory] = useState<DetailsVisit[]>([]);
  const visit = detailsHistory[detailsHistory.length - 1];
  const film = visit?.film;
  const [playingFilm, setPlayingFilm] = useState<Film>();
  const playing = !!playingFilm;
  const [profile, setProfile] = useState(savedSession?.profile ?? 'Explorer');
  const { library, store } = useProfileLibrary(profile);
  const [contrast, setContrast] = useState(false);
  const [slow, setSlow] = useState(false);
  const [entryVersion, setEntryVersion] = useState(0);
  const [entering, setEntering] = useState(true);
  const [loadingHome, setLoadingHome] = useState(false);
  const [homeEntryKey, setHomeEntryKey] = useState<string>();
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
  const [returnKey, setReturnKey] = useState<string>();
  const entered = useRef('');
  const focusBeforeEntry = useRef(observedFocus.current);

  const entryRequest = useRef<ReturnType<typeof commands.focusByKey> | null>(
    null,
  );

  const homeLoadingStarted = useCallback(() => {
    homeArrival.current = null;
    setHomeEntryKey(undefined);
    setLoadingHome(true);
    // A retry replaces the failed Home entry with a new set of targets.
    entered.current = '';
    setEntering(true);
  }, [homeArrival]);

  const beginEntry = useCallback(
    (change: () => void, openerKey?: string) => {
      // Keep Android's temporary fallback focus out of sidebar history while
      // the previous content unmounts and the next target becomes ready.
      entryRequest.current?.cancel();
      entryRequest.current = null;
      homeArrival.current = null;
      entered.current = '';
      setEntering(true);
      setReturnKey(openerKey);
      setNotice('');
      setPendingEntry(() => change);
      setHomeEntryKey(undefined);
    },
    [homeArrival, setNotice],
  );

  useEffect(() => {
    // Commit the sidebar and page entry guards before removing focused content.
    if (pendingEntry) {
      focusBeforeEntry.current = observedFocus.current;
      pendingEntry();
      setPendingEntry(null);
    }
  }, [pendingEntry, observedFocus]);

  const page = `${profile}:${mode}:${screen}`;

  const openPlayer = useCallback(
    (value: Film) => beginEntry(() => setPlayingFilm(value)),
    [beginEntry],
  );

  const closeFilm = useCallback(() => {
    if (visit) {
      let opener: string | undefined = visit.openerKey;

      if (detailsHistory.length === 1) {
        const id = libraryId(visit.film);

        const watchingKey = occurrenceKey(
          page,
          'continue-watching',
          visit.film.source ?? 'fixture',
          visit.film.id,
        );

        // An unpinned title or a finished demo may have removed its own opener.
        if (
          (screen === 'My List' &&
            !library.saved.some(saved => libraryId(saved) === id)) ||
          (screen === 'Home' &&
            opener === watchingKey &&
            !library.watching.some(entry => libraryId(entry.film) === id))
        ) {
          opener = undefined;
        }
      }

      beginEntry(
        () => setDetailsHistory(history => history.slice(0, -1)),
        opener,
      );
    }
  }, [
    beginEntry,
    visit,
    detailsHistory.length,
    library.saved,
    library.watching,
    screen,
    page,
  ]);

  const closePlayer = useCallback(() => {
    beginEntry(() => setPlayingFilm(undefined));
  }, [beginEntry]);

  const recordPlayback = useCallback(
    (position: number, duration: number, finished: boolean) => {
      if (playingFilm)
        store.progress(playingFilm, position, duration, finished);
    },
    [playingFilm, store],
  );

  const openFilm = useCallback(
    (value: Film, openerKey: string) => {
      beginEntry(() =>
        setDetailsHistory(history => [...history, { film: value, openerKey }]),
      );
    },
    [beginEntry],
  );

  const restoreNavigation = useCallback(() => {
    commands
      .restoreScope(
        Platform.OS === 'web' ? ['shell', 'navigation'] : ['navigation'],
      )
      .result.then(result => {
        if (result.status !== 'applied' && result.status !== 'cancelled') {
          setNotice('Navigation focus could not be restored.');
        }
      });
  }, [commands, setNotice]);

  // At the top-level sidebar the Siri Remote's Menu button belongs to tvOS.
  // The sign-in form manages its own Menu lifetime before authentication.
  const hasBackRoute =
    authenticated &&
    (guideOpen ||
      playing ||
      !!film ||
      screen === 'Profile' ||
      screen === 'Settings' ||
      !expanded);

  useAppleTVMenu(hasBackRoute);

  useLayoutEffect(() => {
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
        beginEntry(() => setScreen('Home'));

        return true;
      }

      if (!expanded) {
        entryRequest.current?.cancel();
        entryRequest.current = null;
        entered.current = `${page}:${entryVersion}`;
        setEntering(false);
        setLoadingHome(false);
        restoreNavigation();

        return true;
      }

      if (systemBackAtRoot || (Platform.OS === 'ios' && Platform.isTV))
        return false;

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
  }, [authenticated, guideOpen, film, playing, screen, expanded, closeFilm, closePlayer, restoreNavigation, beginEntry, page, entryVersion, systemBackAtRoot]);

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
  }, [commands, ready, authenticated, guideOpen, film, playing, screen, profile, page]);

  const collectionReady = useCallback(
    (initialKey?: string) => {
      if (playing || guideOpen || pendingEntry) {
        return;
      }

      const route = film ? `details:${film.id}` : `${page}:${entryVersion}`;

      if (entered.current === route) {
        return;
      }

      const key =
        returnKey ?? (film ? occurrenceKey('details', 'play') : initialKey);

      if (!key) {
        return;
      }

      entered.current = route;

      // The snapshot changes when the host observes a different key or mount.
      // Keep an early move on this screen, even across two Details visits.
      const focus = observedFocus.current;

      if (
        film &&
        !returnKey &&
        focus !== focusBeforeEntry.current &&
        focus.kind === 'managed' &&
        focus.occurrenceKey &&
        detailControlKeys.has(focus.occurrenceKey)
      ) {
        setEntering(false);

        return;
      }

      const request =
        Platform.OS === 'android' && returnKey
          ? commands.restoreFocusByKey(key)
          : commands.focusByKey(key);

      entryRequest.current = request;

      if (
        Platform.OS === 'ios' &&
        Platform.isTV &&
        screen === 'Home' &&
        !film &&
        !returnKey &&
        key !== occurrenceKey(page, 'load-more')
      ) {
        // Only a fresh input observation of this hero may open the sidebar
        // before its command receipt. UIKit still owns the initial landing.
        homeArrival.current = {
          key,
          onFocus: () => {
            if (entryRequest.current === request) setEntering(false);
          },
        };
      }

      request.result.then(result => {
        if (entryRequest.current !== request) {
          return;
        }

        homeArrival.current = null;
        setReturnKey(undefined);

        entryRequest.current = null;
        setEntering(false);

        if (result.status !== 'applied' && result.status !== 'cancelled') {
          setNotice('Continue with your remote.');
        }
      });
    },
    [
      commands,
      homeArrival,
      observedFocus,
      setNotice,
      film,
      page,
      screen,
      playing,
      guideOpen,
      entryVersion,
      pendingEntry,
      returnKey,
    ],
  );

  const navigate = (name: Screen) => {
    beginEntry(() => {
      setEntryVersion(value => value + 1);
      setDetailsHistory([]);
      setScreen(name);
    });
  };

  const homeReady = useCallback(
    (key?: string) => {
      if (loadingHome) {
        if (!key) return;

        setHomeEntryKey(key);
        setLoadingHome(false);

        return;
      }

      if (!homeEntryKey) collectionReady(key);
    },
    [loadingHome, homeEntryKey, collectionReady],
  );

  useEffect(() => {
    // Dispatch after the loader and the scope preference have committed together.
    if (!loadingHome && homeEntryKey && !film && screen === 'Home') {
      collectionReady(homeEntryKey);
    }
  }, [loadingHome, homeEntryKey, film, screen, collectionReady]);

  const closeGuide = useCallback(() => {
    beginEntry(() => setGuideOpener(undefined), guideOpener);
  }, [beginEntry, guideOpener]);

  const openGuide = useCallback(
    (openerKey: string) => beginEntry(() => setGuideOpener(openerKey)),
    [beginEntry],
  );

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
            beginEntry(() => {
              setProfile(name);
              setScreen('Home');
            });
          }}
        />
      </FocusScope>
    );
  }

  const showHomeLoader =
    loadingHome && screen === 'Home' && !film && !playing && !guideOpen;

  return (
    <View style={s.fill}>
      <CinemaShell
        {...(Platform.OS === 'web' && showHomeLoader
          ? { inert: true, 'aria-hidden': true }
          : {})}
        accessibilityElementsHidden={showHomeLoader}
        importantForAccessibility={
          showHomeLoader ? 'no-hide-descendants' : 'auto'
        }
        style={[s.shell, (playing || guideOpen) && s.hidden]}
      >
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
            setReturnKey(undefined);
            entered.current = '';
            setDetailsHistory([]);
            setPlayingFilm(undefined);
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
            {...webContentOrder}
            restoreOnEntry={Platform.OS === 'web' && screen === 'Home'}
            accessibilityPaneTitle={
              Platform.OS === 'android' && !entering ? screen : undefined
            }
            active={!film && !playing && !guideOpen}
            // During Home entry or a return, only the intended target may
            // receive Android's automatic fallback until the request settles.
            entryReady={
              !showHomeLoader &&
              (!entering ||
                (Platform.OS === 'android' && !returnKey && !homeEntryKey))
            }
            preferredKey={
              Platform.OS === 'android' && entering
                ? returnKey ?? homeEntryKey
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
                <HomeBrowse
                  {...options}
                  kind="all"
                  featured
                  continueWatching={library.watching}
                  onGuide={openGuide}
                  onHomeLoading={homeLoadingStarted}
                  onReady={homeReady}
                />
              )}
              {screen === 'Movies' && <Catalogue {...options} kind="movie" />}
              {screen === 'Series' && <Catalogue {...options} kind="series" />}
              {screen === 'Search' && <Search {...options} />}
              {screen === 'My List' && (
                <MyList
                  {...options}
                  saved={library.saved}
                  error={library.error}
                  ready={library.ready}
                  onBrowse={() => navigate('Home')}
                  onRetry={store.retry}
                />
              )}
              {screen === 'Settings' && (
                <Settings
                  onReady={collectionReady}
                  mode={mode}
                  onMode={() => {
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
            {...webContentOrder}
            accessibilityPaneTitle={
              Platform.OS === 'android' && !entering ? film?.title : undefined
            }
            boundary="parent"
            active={!!film && !playing}
            entryReady={!entering || (Platform.OS === 'android' && !returnKey)}
            preferredKey={
              Platform.OS === 'android' && entering ? returnKey : undefined
            }
            style={[s.detailLayer, !film && s.hidden]}
          >
            {film && (
              <Details
                active={!playing}
                onReady={collectionReady}
                waitForRecommendations={!!returnKey}
                key={film.id}
                film={film}
                onOpen={openFilm}
                onPlay={openPlayer}
                saved={library.saved.some(
                  item => libraryId(item) === libraryId(film),
                )}
                listReady={library.ready}
                listError={library.error}
                onToggleSaved={store.toggle}
                resumeAvailable={library.watching.some(
                  item => libraryId(item.film) === libraryId(film),
                )}
                highContrast={contrast}
              />
            )}
          </FocusScope>
          {!!notice && (
            <Text pointerEvents="none" style={[s.footer, s.navigationNotice]}>
              {notice}
            </Text>
          )}
        </View>
      </CinemaShell>
      {showHomeLoader && (
        <View style={[s.hiddenPlayer, s.splash]}>
          <ActivityIndicator accessible={false} color="#26D9F2" size="large" />
          <Text accessibilityLiveRegion="polite" style={s.body}>
            Loading Home…
          </Text>
        </View>
      )}
      {guideOpen && (
        <View style={s.hiddenPlayer}>
          <Epg onClose={closeGuide} />
        </View>
      )}
      {playingFilm && (
        <View style={s.hiddenPlayer}>
          <Player
            title={playingFilm.title}
            onClose={closePlayer}
            onCheckpoint={recordPlayback}
            startPosition={
              library.watching.find(
                item => libraryId(item.film) === libraryId(playingFilm),
              )?.position
            }
          />
        </View>
      )}
    </View>
  );
});
