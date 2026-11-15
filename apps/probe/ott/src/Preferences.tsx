import React, { useCallback, useMemo, useState } from 'react';
import { Image, Platform, Text, View, useWindowDimensions } from 'react-native';
import {
  Focusable,
  FocusScope,
  FocusVirtualizedRails,
  occurrenceKey,
} from 'itar/react';
import { art, icons, Picture } from './ui';
import type { ProviderMode } from './tmdb';
import type { VirtualizedFocusItem, VirtualizedFocusRail } from 'itar/react';
import { useDesign } from './theme';

const supportsCheckedState = Platform.OS === 'android' || Platform.OS === 'web';

export function Profiles({
  id,
  profile,
  onSelect,
  highContrast,
}: {
  id: string;
  profile: string;
  onSelect: (name: string) => void;
  highContrast: boolean;
}) {
  const { s, u } = useDesign();
  const names = ['Explorer', 'Stargazer'];
  const focusStyle = { accentColor: highContrast ? '#FFFFFF' : '#26D9F2' };

  return (
    <View style={s.profilePage}>
      <Text style={s.chooserTitle}>Who’s exploring?</Text>
      <Text style={[s.subtitle, s.centered]}>
        Choose a local profile. Session only.
      </Text>
      <FocusScope id="choices" layout="row" boundary="stop" style={s.profiles}>
        {[...names, 'Add a New Profile'].map((name, index) => (
          <View key={name}>
            <View style={s.chooserCard}>
              {index < 2 ? (
                <Picture
                  source={art[index === 0 ? 0 : 3]}
                  style={s.profilePicture}
                  fallback="Profile artwork unavailable"
                />
              ) : (
                <View style={s.addProfileImage}>
                  <Image source={icons.Profile} style={s.addProfileIcon} />
                </View>
              )}
              <Focusable
                order={index}
                occurrenceKey={occurrenceKey(id, name)}
                accessibilityLabel={
                  index === 2
                    ? 'Add a New Profile, unavailable in this showcase'
                    : name === profile
                    ? `${name}, current profile`
                    : name
                }
                displayLabel={name}
                labelPlacement="bottom-center"
                labelSize={24 * u}
                outlineInsetBottom={48 * u}
                baseAccentColor="#F4EEE4"
                focusStyle={focusStyle}
                style={s.chooserAction}
                onPress={() => {
                  if (index < 2) {
                    onSelect(name);
                  }
                }}
              />
            </View>
            {name === profile && (
              <View style={s.currentProfile}>
                <Image source={icons.check} style={s.check} />
                <Text style={s.muted}>Current profile</Text>
              </View>
            )}
          </View>
        ))}
      </FocusScope>
      <Text style={[s.footer, s.centered]}>
        New profiles aren’t available in this demo.
      </Text>
    </View>
  );
}

export function Settings({
  onReady,
  id,
  contrast,
  onContrast,
  slow,
  onSlow,
  armed,
  onArm,
  onOpenProbes,
  mode,
  onMode,
}: {
  onReady?: (initialKey?: string) => void;
  mode: ProviderMode;
  onMode: () => void;
  id: string;
  contrast: boolean;
  onContrast: () => void;
  slow: boolean;
  onSlow: () => void;
  armed: boolean;
  onArm: () => void;
  onOpenProbes?: () => void;
}) {
  const { s, u } = useDesign();
  const { width } = useWindowDimensions();
  const [height, setHeight] = useState(0);
  const viewport = Math.max(200 * u, width - 440 * u);

  const reportReady = useCallback(
    () => onReady?.(occurrenceKey(id, 'contrast')),
    [id, onReady],
  );

  const model = useMemo(() => {
    const values = [
      {
        key: 'contrast',
        title: 'Appearance',
        label: 'White focus accent',
        value: contrast ? 'On' : 'Off',
        checked: contrast,
        press: onContrast,
      },
      {
        key: 'delay',
        title: 'Request scenarios',
        label: 'Slow requests',
        value: slow ? 'On / 650 ms' : 'Off',
        checked: slow,
        press: onSlow,
      },
      {
        key: 'failure',
        title: '',
        label: 'Fail next local fetch',
        value: armed ? 'Armed' : 'Not armed',
        checked: armed,
        press: onArm,
      },
      ...(__DEV__ && onOpenProbes
        ? [
            {
              key: 'probes',
              title: '',
              label: 'Open original Itar probes',
              value: 'Development only',
              press: onOpenProbes,
            },
          ]
        : []),
      {
        key: 'source',
        title: 'Content source',
        label: 'Catalogue',
        value: mode === 'proxy' ? 'TMDB proxy' : 'Offline fixtures',
        press: onMode,
      },
    ];

    const visuals = new Map(
      values.map(value => [occurrenceKey(id, value.key), value]),
    );

    const rails = values.map(value => ({
      id: value.key,
      itemExtent: viewport,
      itemStyle: {
        width: viewport,
        height: 76 * u,
        backgroundColor: 'transparent',
      },
      items: [
        {
          occurrenceKey: occurrenceKey(id, value.key),
          accessibilityLabel:
            supportsCheckedState && 'checked' in value
              ? value.label
              : `${value.label}: ${value.value}`,
          accessibilityRole:
            supportsCheckedState && 'checked' in value
              ? ('switch' as const)
              : undefined,
          accessibilityState:
            supportsCheckedState && 'checked' in value
              ? { checked: value.checked }
              : undefined,
          displayLabel: '',
          labelSize: 24 * u,
          baseAccentColor: '#BDC8D3',
          focusStyle: { accentColor: contrast ? '#FFFFFF' : '#26D9F2' },
          onPress: value.press,
        },
      ],
    }));

    return {
      rails,
      visuals,
      titles: new Map(values.map(value => [value.key, value.title])),
    };
  }, [
    id,
    mode,
    contrast,
    slow,
    armed,
    onMode,
    onContrast,
    onSlow,
    onArm,
    onOpenProbes,
    viewport,
    u,
  ]);

  const header = useCallback(
    (rail: VirtualizedFocusRail) => (
      <Text style={s.virtualHeading}>{model.titles.get(rail.id)}</Text>
    ),
    [model.titles, s.virtualHeading],
  );

  const renderItem = useCallback(
    (item: VirtualizedFocusItem) => {
      const value = model.visuals.get(item.occurrenceKey);

      return (
        <View style={[s.settingContents, { width: viewport }]}>
          <Text style={s.body}>{value?.label}</Text>
          <Text style={s.muted}>{value?.value}</Text>
        </View>
      );
    },
    [model.visuals, viewport, s],
  );

  return (
    <View style={s.fill}>
      <View
        style={s.fill}
        onLayout={event => setHeight(event.nativeEvent.layout.height)}
      >
        {height > 0 && (
          <FocusVirtualizedRails
            id="settings-controls"
            onReady={reportReady}
            rails={model.rails}
            itemExtent={viewport}
            viewportExtent={viewport}
            rowExtent={148 * u}
            headerExtent={48 * u}
            viewportHeight={height}
            renderRailHeader={header}
            renderItem={renderItem}
          />
        )}
      </View>
      <Text style={s.footer}>
        Focus and request settings last for this session. This product uses the
        TMDB API but is not endorsed or certified by TMDB.
      </Text>
    </View>
  );
}
