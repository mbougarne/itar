import React from 'react';
import { StyleSheet } from 'react-native';
import Video, { ViewType } from 'react-native-video';

const source = {
  uri: require('../../assets/cinematic/big_buck_bunny_preview.mp4'),
};

export type PreviewVideoProps = { onReady: () => void; onFinish: () => void };

export function PreviewVideo({ onReady, onFinish }: PreviewVideoProps) {
  return (
    <Video
      source={source}
      style={StyleSheet.absoluteFill}
      resizeMode="cover"
      controls={false}
      focusable={false}
      disableFocus
      muted
      viewType={ViewType.TEXTURE}
      preventsDisplaySleepDuringVideoPlayback={false}
      onReadyForDisplay={onReady}
      onError={onFinish}
      onEnd={onFinish}
      onProgress={event => {
        if (event.currentTime >= 10) onFinish();
      }}
    />
  );
}
