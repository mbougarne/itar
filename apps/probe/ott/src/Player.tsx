import React from 'react';
import { FocusProvider } from 'itar/react';
import Playback from './Playback';
import { useDesign } from './theme';

export default function Player(props: { title: string; onClose: () => void }) {
  const { s } = useDesign();

  return (
    <FocusProvider style={s.fill}>
      <Playback {...props} />
    </FocusProvider>
  );
}
