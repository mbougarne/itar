import React from 'react';
import { Image, Platform, Text, View } from 'react-native';
import { FocusScope, occurrenceKey } from 'itar/react';
import { art, icons } from './artwork';
import { Action } from './components/Action';
import { Picture } from './components/Picture';
import { useDesign } from './theme';
import { screens, type Screen } from './navigation';
import type { ProviderMode } from './catalog-types';
import { androidVerticalBoundary } from './android-focus-boundary';

export function Sidebar({
  active,
  expanded,
  profile,
  contrast,
  mode,
  screen,
  onNavigate,
  onSignOut,
}: {
  active: boolean;
  expanded: boolean;
  profile: string;
  contrast: boolean;
  mode: ProviderMode;
  screen: Screen;
  onNavigate: (screen: Screen) => void;
  onSignOut: () => void;
}) {
  const { s, u } = useDesign();

  return (
    <View
      {...androidVerticalBoundary}
      style={[
        s.sidebarSlot,
        // Android clips accessibility bounds to this parent even when its
        // child draws outside it. Keep the overlay's full semantic width
        // without shifting the content when the sidebar expands.
        Platform.OS === 'android' &&
          expanded && { width: 360 * u, marginRight: -248 * u },
      ]}
    >
      <FocusScope
        id={screen === 'Settings' ? 'account-navigation' : 'navigation'}
        active={active}
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
                onPress={() => onNavigate(name)}
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
              onPress={() => onNavigate('Profile')}
              highContrast={contrast}
              style={[s.profileSwitcher, { width: (expanded ? 312 : 64) * u }]}
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
              onPress={onSignOut}
              style={[s.navAction, { width: (expanded ? 312 : 64) * u }]}
            />
            <View pointerEvents="none" style={s.navIconSlot}>
              <Image
                source={require('../assets/cinematic/icons/arrow-left.png')}
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
  );
}
