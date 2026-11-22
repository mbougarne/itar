import React, { useEffect, useRef } from 'react';

const source: {
  uri: string;
} = require('../../assets/cinematic/big_buck_bunny_preview.mp4');

const videoStyle: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  width: '100%',
  height: '100%',
  objectFit: 'cover',
  pointerEvents: 'none',
};

export function PreviewVideo({
  onReady,
  onFinish,
}: {
  onReady: () => void;
  onFinish: () => void;
}) {
  const video = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const media = video.current;

    if (!media) return;

    let mounted = true;

    // Muted inline playback still may be declined by the TV browser.
    media.muted = true;

    const playback = media.play();

    playback?.catch(() => {
      if (mounted) onFinish();
    });

    return () => {
      mounted = false;
      media.pause();
      media.removeAttribute('src');
      media.load();
    };
  }, [onFinish]);

  return (
    <video
      ref={video}
      src={source.uri}
      muted
      playsInline
      aria-hidden
      tabIndex={-1}
      onPlaying={onReady}
      onEnded={onFinish}
      onError={onFinish}
      onTimeUpdate={event => {
        if (event.currentTarget.currentTime >= 10) onFinish();
      }}
      style={videoStyle}
    />
  );
}
