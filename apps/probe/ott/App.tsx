import React from 'react';
import { DesignTheme } from './src/theme';
import Launch from './src/Launch';

export default function OttApp({
  onOpenProbes,
}: {
  onOpenProbes?: () => void;
}) {
  return (
    <DesignTheme>
      <Launch onOpenProbes={onOpenProbes} />
    </DesignTheme>
  );
}
