import React from 'react';
import { Text } from 'react-native';
import { useIsFocused } from 'itar/react';
import { keyFor } from './react-api-data';

export function SelectedStatus() {
  const selected = useIsFocused(keyFor('rail-b', 'entry-1'));

  return (
    <Text>Rail B first entry: {selected ? 'focused' : 'not focused'}</Text>
  );
}
