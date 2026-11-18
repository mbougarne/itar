import React, { useCallback, useContext, useMemo, useState } from 'react';
import { Platform, Text, View, useWindowDimensions } from 'react-native';
import { FocusVirtualizedRails, occurrenceKey } from 'itar/react';
import type { ProviderMode } from './catalog-types';
import type { VirtualizedFocusItem, VirtualizedFocusRail } from 'itar/react';
import { useDesign } from './theme';
import { BrowserNavigation } from './browser-navigation';

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
    navigation,
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
