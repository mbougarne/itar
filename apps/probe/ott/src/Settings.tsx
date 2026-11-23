import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Platform, Text, View, useWindowDimensions } from 'react-native';
import { FocusVirtualizedRails, occurrenceKey } from '@bougarnem/itar/react';
import type { ProviderMode } from './catalog-types';
import type {
  VirtualizedFocusItem,
  VirtualizedFocusRail,
} from '@bougarnem/itar/react';
import { useDesign } from './theme';
import { BrowserNavigation } from './browser-navigation';
import { DevelopmentSettings } from './development-settings';

const appleTV = Platform.OS === 'ios' && Platform.isTV;

const sessionNote = 'Focus and request settings last for this session.';

const attribution =
  'This product uses the TMDB API but is not endorsed or certified by TMDB.';

const supportsCheckedState = Platform.OS === 'android' || Platform.OS === 'web';

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
  const navigation = useContext(BrowserNavigation);
  const development = useContext(DevelopmentSettings);
  const refresh = development?.refresh;

  useEffect(() => {
    refresh?.();
  }, [refresh]);

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
      ...(development?.actions ?? []),
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
      ...(navigation
        ? [
            {
              key: 'navigation',
              title: 'Keyboard',
              label: 'TV arrow-key navigation',
              value: navigation.enabled ? 'On' : 'Off',
              checked: navigation.enabled,
              press: navigation.toggle,
            },
          ]
        : []),
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
              : [
                  `${value.label}: ${value.value}`,
                  appleTV && value.title,
                  appleTV &&
                    value.key === 'contrast' &&
                    `Settings. ${sessionNote}`,
                  appleTV && value.key === 'source' && attribution,
                ]
                  .filter(Boolean)
                  .join('. '),
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
    navigation,
    development,
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
      <Text accessible={appleTV ? false : undefined} style={s.virtualHeading}>
        {model.titles.get(rail.id)}
      </Text>
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
      <Text accessible={appleTV ? false : undefined} style={s.footer}>
        {sessionNote} {attribution}
      </Text>
    </View>
  );
}
