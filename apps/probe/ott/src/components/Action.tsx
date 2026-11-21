import React from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { Focusable } from 'itar/react';
import { useDesign } from '../theme';

const accents = {
  cyan: { accentColor: '#FFFFFF', backgroundColor: '#176B7B' },
  white: { accentColor: '#FFFFFF', backgroundColor: '#334B60' },
};

export function Action({
  id,
  label,
  onPress,
  enabled = true,
  highContrast = false,
  contentId,
  style,
  order = 0,
  displayLabel,
  children,
}: {
  displayLabel?: string;
  children?: React.ReactNode;
  order?: number;
  id: string;
  label: string;
  onPress: () => void;
  enabled?: boolean;
  highContrast?: boolean;
  contentId?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const { s, u } = useDesign();

  return (
    <Focusable
      displayLabel={displayLabel ?? label}
      labelSize={24 * u}
      order={order}
      occurrenceKey={id}
      contentId={contentId}
      accessibilityLabel={label}
      enabled={enabled}
      onPress={onPress}
      baseAccentColor="#BDC8D3"
      focusStyle={highContrast ? accents.white : accents.cyan}
      style={[s.action, style]}
    >
      {children}
    </Focusable>
  );
}
