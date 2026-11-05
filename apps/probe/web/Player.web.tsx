import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { BackHandler } from './platform';
import { directionalNavigationEnabled } from './focus-store';

// Public Blender 4K sample on the GARR Kodi mirror; catalogue titles do not supply streams.
const sample =
  'https://kodi.mirror.garr.it/demo-files/BBB/bbb_sunflower_2160p_30fps_normal.mp4';

function PlaybackIcon({
  name,
}: {
  name: 'play' | 'pause' | 'rewind' | 'forward' | 'mute' | 'unmute';
}) {
  const paths = {
    play: 'M8 5v14l11-7z',
    pause: 'M8 5v14M16 5v14',
    rewind: 'M11 5 3 12l8 7V5Zm10 0-8 7 8 7V5Z',
    forward: 'm3 5 8 7-8 7V5Zm10 0 8 7-8 7V5Z',
    mute: 'M11 4 6 8H2v8h4l5 4V4Zm4 5 6 6m0-6-6 6',
    unmute: 'M11 4 6 8H2v8h4l5 4V4Zm4 4a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14',
  };

  return (
    <svg
      viewBox="0 0 24 24"
      width="28"
      height="28"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d={paths[name]}
        fill={name === 'play' ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth={name === 'pause' ? 4 : 2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const clock = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(
    2,
    '0',
  )}`;

export default function Player({
  title,
  onClose,
}: {
  title: string;
  onClose: () => void;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const playButton = useRef<HTMLButtonElement>(null);
  const alive = useRef(true);
  const [paused, setPaused] = useState(true);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [failed, setFailed] = useState(false);
  const [status, setStatus] = useState('Loading video…');

  const play = useCallback(async () => {
    const media = video.current;

    if (!media) {
      return;
    }

    try {
      if (media.ended) {
        media.currentTime = 0;
      }

      await media.play();
    } catch (error) {
      if (
        !alive.current ||
        (error instanceof Error && error.name === 'AbortError')
      ) {
        return;
      }

      if (error instanceof Error && error.name === 'NotAllowedError') {
        setStatus('Press Play to start.');
      } else {
        setFailed(true);
        setStatus('Video could not play. Check your connection and retry.');
      }
    }
  }, []);

  useEffect(() => {
    alive.current = true;

    const media = video.current;

    playButton.current?.focus();
    play();

    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        media?.pause();
        onClose();

        return true;
      },
    );

    const pause = () => {
      if (document.hidden) {
        media?.pause();
      }
    };

    document.addEventListener('visibilitychange', pause);

    return () => {
      alive.current = false;
      subscription.remove();
      document.removeEventListener('visibilitychange', pause);
      media?.pause();
      media?.removeAttribute('src');
      media?.load();
    };
  }, [onClose, play]);

  const seek = (value: number) => {
    const media = video.current;

    if (media && Number.isFinite(media.duration) && media.duration > 0) {
      media.currentTime = Math.max(0, Math.min(media.duration, value));
      setTime(media.currentTime);
    }
  };

  const toggle = () => {
    const media = video.current;

    if (!media) {
      return;
    }

    if (failed) {
      setFailed(false);
      setStatus('Loading video…');
      media.load();
      play();
    } else if (media.paused) {
      play();
    } else {
      media.pause();
    }
  };

  const keyboard = (event: React.KeyboardEvent<HTMLElement>) => {
    const controls = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>(
        'button:not(:disabled), input:not(:disabled)',
      ),
    );

    const target = event.target as HTMLElement;
    const index = controls.indexOf(target);

    if (index < 0) {
      return;
    }

    let next = index;

    if (event.key === 'Tab') {
      next =
        (index + (event.shiftKey ? -1 : 1) + controls.length) % controls.length;
    } else if (directionalNavigationEnabled && event.key.startsWith('Arrow')) {
      // Range controls keep native Left/Right adjustment and reader semantics.
      if (
        target.tagName === 'INPUT' &&
        ['ArrowLeft', 'ArrowRight'].includes(event.key)
      ) {
        return;
      }

      if (event.key === 'ArrowUp') {
        next = 0;
      } else if (event.key === 'ArrowDown') {
        next = index === 0 ? 1 : 2;
      } else {
        next = Math.max(
          0,
          Math.min(
            controls.length - 1,
            index + (event.key === 'ArrowLeft' ? -1 : 1),
          ),
        );
      }
    } else {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    controls[next]?.focus();
  };

  return createPortal(
    <section
      className="itar-web-player"
      role="dialog"
      aria-modal="true"
      aria-label={`Player: ${title}`}
      onKeyDown={keyboard}
    >
      <video
        ref={video}
        src={sample}
        playsInline
        preload="auto"
        controls={false}
        disablePictureInPicture
        disableRemotePlayback
        aria-label={`Sample video for ${title}`}
        onContextMenu={event => event.preventDefault()}
        onLoadedMetadata={event =>
          setDuration(
            Number.isFinite(event.currentTarget.duration)
              ? event.currentTarget.duration
              : 0,
          )
        }
        onTimeUpdate={event => setTime(event.currentTarget.currentTime)}
        onPlay={() => {
          setPaused(false);
          setStatus('');
        }}
        onPause={() => setPaused(true)}
        onEnded={() => {
          setPaused(true);
          setStatus('Playback finished. Select Play to watch again.');
        }}
        onWaiting={() => setStatus('Buffering…')}
        onCanPlay={() => setStatus('')}
        onVolumeChange={event => {
          setMuted(event.currentTarget.muted);
          setVolume(event.currentTarget.volume);
        }}
        onError={() => {
          setFailed(true);
          setStatus('Video could not load. Check your connection and retry.');
        }}
      />
      <header className="itar-player-header">
        <h1>{title}</h1>
        <button
          className="itar-player-close"
          aria-label="Close player"
          onClick={() => {
            video.current?.pause();
            onClose();
          }}
        >
          ×
        </button>
      </header>
      {status && (
        <p className="itar-player-status" role={failed ? 'alert' : 'status'}>
          {status}
        </p>
      )}
      <div className="itar-player-controls">
        <input
          type="range"
          aria-label="Playback position"
          min={0}
          max={duration || 1}
          step={1}
          value={Math.min(time, duration)}
          disabled={!duration || failed}
          aria-valuetext={`${clock(time)} of ${clock(duration)}`}
          onChange={event => seek(Number(event.currentTarget.value))}
        />
        <div className="itar-player-buttons">
          <button
            ref={playButton}
            onClick={toggle}
            aria-label={failed ? 'Retry' : paused ? 'Play' : 'Pause'}
            title={failed ? 'Retry' : paused ? 'Play' : 'Pause'}
          >
            {failed ? (
              'Retry'
            ) : (
              <PlaybackIcon name={paused ? 'play' : 'pause'} />
            )}
          </button>
          <button
            aria-label="Rewind 10 seconds"
            title="Rewind 10 seconds"
            disabled={!duration || failed}
            onClick={() => seek((video.current?.currentTime ?? 0) - 10)}
          >
            <PlaybackIcon name="rewind" />
            <span aria-hidden="true">10</span>
          </button>
          <button
            aria-label="Forward 10 seconds"
            title="Forward 10 seconds"
            disabled={!duration || failed}
            onClick={() => seek((video.current?.currentTime ?? 0) + 10)}
          >
            <PlaybackIcon name="forward" />
            <span aria-hidden="true">10</span>
          </button>
          <span className="itar-player-time">
            {clock(time)} / {clock(duration)}
          </span>
          <button
            aria-label={muted ? 'Unmute' : 'Mute'}
            title={muted ? 'Unmute' : 'Mute'}
            onClick={() => {
              if (video.current) {
                video.current.muted = !video.current.muted;
              }
            }}
          >
            <PlaybackIcon name={muted ? 'mute' : 'unmute'} />
          </button>
          <input
            type="range"
            aria-label="Volume"
            min={0}
            max={1}
            step={0.05}
            value={muted ? 0 : volume}
            onChange={event => {
              if (video.current) {
                video.current.volume = Number(event.currentTarget.value);
                video.current.muted = false;
              }
            }}
          />
        </div>
        <p className="itar-player-credit">
          Big Buck Bunny · 4K UHD · 30 fps · © Blender Foundation |
          bigbuckbunny.org · CC BY 3.0 · Sample playback
        </p>
      </div>
    </section>,
    document.body,
  );
}
