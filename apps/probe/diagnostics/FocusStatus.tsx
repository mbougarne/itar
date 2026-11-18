import React from 'react';
import { Text } from 'react-native';
import { useFocusState, useScreenReaderEnabled } from 'itar/react';

export function FocusStatus() {
  const state = useFocusState();
  const reader = useScreenReaderEnabled();

  return (
    <Text>
      Observed: {state.kind} {state.occurrenceKey ?? ''}; reader:{' '}
      {String(reader)}
    </Text>
  );
}
