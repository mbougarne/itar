import React from 'react';
import { Text } from 'react-native';
import { useDesign } from '../theme';

export function Header({ children }: { children: React.ReactNode }) {
  const { s } = useDesign();

  return (
    <Text accessibilityRole="header" style={s.heading}>
      {children}
    </Text>
  );
}
