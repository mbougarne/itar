import React from 'react';
import { Image, View, type ImageSourcePropType } from 'react-native';
import { Action } from './Action';
import { useDesign } from '../theme';

// Action owns activation. Keep the decorative icon outside hit testing and reader traversal.
export function IconAction({
  icon,
  size = 72,
  enabled = true,
  ...props
}: Omit<React.ComponentProps<typeof Action>, 'displayLabel' | 'style'> & {
  icon: ImageSourcePropType;
  size?: number;
}) {
  const { s, u } = useDesign();

  return (
    <View style={{ width: size * u, height: size * u }}>
      <Action
        {...props}
        enabled={enabled}
        displayLabel=""
        style={[
          s.iconAction,
          { width: size * u, height: size * u, borderRadius: (size * u) / 2 },
        ]}
      />
      <View
        pointerEvents="none"
        accessible={false}
        importantForAccessibility="no-hide-descendants"
        style={s.iconOverlay}
      >
        <Image
          accessible={false}
          source={icon}
          resizeMode="contain"
          style={[s.controlIcon, !enabled && s.disabledIcon]}
        />
      </View>
    </View>
  );
}
