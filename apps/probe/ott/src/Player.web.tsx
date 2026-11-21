import React, {
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { BackHandler } from '../../web/platform';
import PlaybackIcon from '../../web/PlaybackIcon';
import { BrowserNavigation } from './browser-navigation';
import { formatPlaybackTime } from './playback-time';
import { usePlaybackControls } from './usePlaybackControls';

import { webDemoStream } from './demo-stream';
import { PlaybackHistory, type PlayerProps } from './playback-history';

const legacyKeys: Record<number, string> = {
  13: 'Enter',
  32: ' ',
  37: 'ArrowLeft',
  38: 'ArrowUp',
  39: 'ArrowRight',
  40: 'ArrowDown',
};

function remoteKey(event: React.KeyboardEvent) {
  // Some TV browsers send keyCode with a missing or unidentified key.
  return event.key && event.key !== 'Unidentified'
    ? event.key
    : legacyKeys[event.keyCode] ?? '';
}

export default function Player({
  title,
  onClose,
  startPosition,
  onCheckpoint,
}: PlayerProps) {
  const video = useRef<HTMLVideoElement>(null);
  const playButton = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLElement>(null);
  const lastControl = useRef<HTMLButtonElement | HTMLInputElement | null>(null);
  const wakeKey = useRef('');
  const alive = useRef(true);
  const [paused, setPaused] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [failed, setFailed] = useState(false);
  const [status, setStatus] = useState('Loading video…');

  const historyRef = useRef<PlaybackHistory | null>(null);

  if (!historyRef.current)
    historyRef.current = new PlaybackHistory(startPosition, onCheckpoint);

  const history = historyRef.current;

  const directionalNavigationEnabled =
    useContext(BrowserNavigation)?.enabled ?? true;

  const { visible, wake, cancelHide } = usePlaybackControls(
    playing && !paused && !failed && directionalNavigationEnabled,
  );

  useLayoutEffect(() => {
    if (!visible) {
      // Keep remote and Tab events in the modal when its focused button disappears.
      dialog.current?.focus();
    } else if (document.activeElement === dialog.current) {
      const control = lastControl.current;

      (control && !control.disabled ? control : playButton.current)?.focus();
    }
  }, [visible]);

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
        wakeKey.current = '';
        setPlaying(false);
        media?.pause();
      }
    };

    document.addEventListener('visibilitychange', pause);

    return () => {
      alive.current = false;
      history.flush();
      subscription.remove();
      document.removeEventListener('visibilitychange', pause);
      media?.pause();
      media?.removeAttribute('src');
      media?.load();
    };
  }, [onClose, play, history]);

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
    const key = remoteKey(event);

    if (wakeKey.current && wakeKey.current === key) {
      event.preventDefault();
      event.stopPropagation();

      return;
    }

    wake();

    if (
      !visible &&
      !event.altKey &&
      !event.ctrlKey &&
      !event.metaKey &&
      (key.startsWith('Arrow') ||
        ['Enter', 'Select', ' ', 'Spacebar', 'Tab'].includes(key))
    ) {
      wakeKey.current = key;
      cancelHide();
      event.preventDefault();
      event.stopPropagation();

      return;
    }

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

    if (key === 'Tab') {
      next =
        (index + (event.shiftKey ? -1 : 1) + controls.length) % controls.length;
    } else if (directionalNavigationEnabled && key.startsWith('Arrow')) {
      // Range controls keep native Left/Right adjustment and reader semantics.
      if (
        target.tagName === 'INPUT' &&
        ['ArrowLeft', 'ArrowRight'].includes(key)
      ) {
        return;
      }

      const row = target.closest('[data-player-row]');

      if (!row) return;

      if (key === 'ArrowUp' || key === 'ArrowDown') {
        const rows = Array.from(
          event.currentTarget.querySelectorAll('[data-player-row]'),
        );

        const adjacent = rows[rows.indexOf(row) + (key === 'ArrowUp' ? -1 : 1)];

        const entry = adjacent?.querySelector<HTMLElement>(
          '[data-player-entry]:not(:disabled)',
        );

        if (entry) next = controls.indexOf(entry);
      } else {
        const siblings = controls.filter(control => row.contains(control));
        const rtl = getComputedStyle(row).direction === 'rtl';
        const step = (key === 'ArrowRight') !== rtl ? 1 : -1;
        const sibling = siblings[siblings.indexOf(target) + step];

        if (sibling) next = controls.indexOf(sibling);
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
      ref={dialog}
      tabIndex={-1}
      className="itar-web-player"
      data-controls-hidden={visible ? undefined : true}
      role="dialog"
      aria-modal="true"
      aria-label={`Player: ${title}`}
      onKeyDown={keyboard}
      onKeyUp={event => {
        if (wakeKey.current && wakeKey.current === remoteKey(event)) {
          wakeKey.current = '';
          event.preventDefault();
          event.stopPropagation();
        }

        wake();
      }}
      onFocusCapture={event => {
        const control = event.target.closest<
          HTMLButtonElement | HTMLInputElement
        >('button, input');

        if (control) {
          lastControl.current = control;

          if (!wakeKey.current) wake();
        }
      }}
      onPointerMove={wake}
      onPointerDown={wake}
      onPointerUp={wake}
      onClickCapture={wake}
    >
      <video
        ref={video}
        src={webDemoStream}
        playsInline
        preload="auto"
        controls={false}
        disablePictureInPicture
        disableRemotePlayback
        aria-label={`Sample video for ${title}`}
        onContextMenu={event => event.preventDefault()}
        onLoadedMetadata={event => {
          const media = event.currentTarget;

          setDuration(Number.isFinite(media.duration) ? media.duration : 0);

          const resume = history.resumeAt(media.duration);

          if (resume > 0) media.currentTime = resume;
        }}
        onTimeUpdate={event => {
          const media = event.currentTarget;

          setTime(media.currentTime);
          history.progress(media.currentTime, media.duration);
        }}
        onPlay={() => setPaused(false)}
        onPlaying={() => {
          history.playing();
          setPlaying(true);
          setStatus('');
        }}
        onPause={() => {
          history.flush();
          setPlaying(false);
          setPaused(true);
        }}
        onEnded={() => {
          history.ended(video.current?.duration ?? 0);
          setPlaying(false);
          setPaused(true);
          setStatus('Playback finished. Select Play to watch again.');
        }}
        onWaiting={() => {
          setPlaying(false);
          setStatus('Buffering…');
        }}
        onCanPlay={() => setStatus('')}
        onVolumeChange={event => {
          setMuted(event.currentTarget.muted);
          setVolume(event.currentTarget.volume);
        }}
        onError={() => {
          setPlaying(false);
          setFailed(true);
          setStatus('Video could not load. Check your connection and retry.');
        }}
      />
      <header className="itar-player-header" data-player-row>
        <h1>{title}</h1>
        <div className="itar-player-utilities">
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
          <button
            data-player-entry
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
        </div>
      </header>
      <div className="itar-player-transport" data-player-row>
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
          data-player-entry
          ref={playButton}
          onClick={toggle}
          aria-label={failed ? 'Retry' : paused ? 'Play' : 'Pause'}
          title={failed ? 'Retry' : paused ? 'Play' : 'Pause'}
        >
          {failed ? 'Retry' : <PlaybackIcon name={paused ? 'play' : 'pause'} />}
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
      </div>
      <div className="itar-player-controls" data-player-row>
        <div className="itar-player-meta">
          <span className="itar-player-time">
            {formatPlaybackTime(time)} / {formatPlaybackTime(duration)}
          </span>
          {status && (
            <p
              className="itar-player-status"
              role={failed ? 'alert' : 'status'}
            >
              {status}
            </p>
          )}
        </div>
        <input
          data-player-entry
          type="range"
          aria-label="Playback position"
          min={0}
          max={duration || 1}
          step={1}
          value={Math.min(time, duration)}
          disabled={!duration || failed}
          aria-valuetext={`${formatPlaybackTime(time)} of ${formatPlaybackTime(
            duration,
          )}`}
          onChange={event => seek(Number(event.currentTarget.value))}
        />
        <p className="itar-player-credit">
          Big Buck Bunny · 4K UHD · 30 fps · © Blender Foundation |
          bigbuckbunny.org · CC BY 3.0 · Sample playback
        </p>
      </div>
    </section>,
    document.body,
  );
}
