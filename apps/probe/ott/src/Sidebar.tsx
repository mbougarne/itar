import React from 'react';
import { Platform, Text, View } from 'react-native';
import { FocusScope, occurrenceKey } from 'itar/react';
import { art, icons } from './artwork';
import { SidebarButton } from './components/SidebarButton';
import { useDesign } from './theme';
import { screens, type Screen } from './navigation';
import type { ProviderMode } from './catalog-types';
import { androidVerticalBoundary } from './android-focus-boundary';

export function Sidebar({
  active,
  expanded,
  reserveWidth,
  readerEntry,
  profile,
  contrast,
  mode,
  screen,
  onNavigate,
  onSignOut,
}: {
  active: boolean;
  expanded: boolean;
  reserveWidth: boolean;
  readerEntry: boolean;
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
        // Keep both panes visible and stationary as VoiceOver explores them.
        reserveWidth && { width: 360 * u },
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
        accessibilityPaneTitle={readerEntry ? 'Navigation' : undefined}
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
        <Text
          accessible={reserveWidth ? false : undefined}
          accessibilityElementsHidden={reserveWidth}
          numberOfLines={1}
          style={s.brand}
        >
          <Text style={s.brandStrong}>{expanded ? 'ITAR' : 'I'}</Text>
          {expanded ? ' CINEMA' : ''}
        </Text>
        <View style={s.nav}>
          {screens.map((name, index) => (
            <View key={name} style={s.navRow}>
              {name === screen && (
                <View accessible={false} style={s.routeMarker} />
              )}
              <SidebarButton
                id={occurrenceKey('nav', name)}
                order={index}
                title={name}
                icon={icons[name]}
                expanded={expanded}
                onPress={() => onNavigate(name)}
                highContrast={contrast}
              />
            </View>
          ))}
        </View>
        <View style={s.sidebarBottom}>
          <SidebarButton
            order={screens.length}
            id={occurrenceKey('nav', 'profile-switcher')}
            title={profile}
            label={`${profile}, switch profile`}
            icon={art[profile === 'Explorer' ? 0 : 3]}
            avatar
            expanded={expanded}
            onPress={() => onNavigate('Profile')}
            highContrast={contrast}
          />
          <SidebarButton
            order={screens.length + 1}
            id={occurrenceKey('nav', 'signout')}
            title="Sign out"
            icon={icons.signOut}
            expanded={expanded}
            onPress={onSignOut}
            highContrast={contrast}
          />
          {expanded && (
            <Text
              accessible={reserveWidth ? false : undefined}
              accessibilityElementsHidden={reserveWidth}
              style={s.fixtureLabel}
            >
              {mode === 'proxy' ? 'TMDB CATALOGUE' : 'FIXTURE CATALOGUE'}
            </Text>
          )}
        </View>
      </FocusScope>
    </View>
  );
}
