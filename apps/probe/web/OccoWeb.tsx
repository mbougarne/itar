import './occo.css';
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  DevelopmentSettings,
  type DevelopmentAction,
} from '../ott/src/development-settings';
import {
  eventTitle,
  eventDetails,
  recordingSummary,
  type OccoRecording,
} from '../occo/timeline';
import { WebRecording } from './occo-recording';

const refresh = () => {};

function Inspector({
  recording,
  close,
}: {
  recording: OccoRecording;
  close(): void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const list = useRef<HTMLSelectElement>(null);
  const save = useRef<HTMLButtonElement>(null);
  const back = useRef<HTMLButtonElement>(null);

  const [index, setIndex] = useState(() => {
    const mark = recording.events.reduce(
      (last, e, i) => (e.kind === 'marker' ? i : last),
      -1,
    );

    return mark >= 0 ? mark : Math.max(0, recording.events.length - 1);
  });

  useLayoutEffect(() => {
    const element = dialog.current!;

    element.showModal();
    list.current?.focus();

    // Handle Back before Cinema's document-level route listener.
    const key = (e: KeyboardEvent) => {
      if (
        ['Escape', 'GoBack', 'BrowserBack'].includes(e.key) ||
        [10009, 461].includes(e.keyCode)
      ) {
        e.preventDefault();
        e.stopPropagation();
        close();
      }
    };

    window.addEventListener('keydown', key, true);

    return () => {
      window.removeEventListener('keydown', key, true);
      element.close();
    };
  }, [close]);

  function download() {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(recording)], { type: 'application/json' }),
    );

    const link = document.createElement('a');

    link.href = url;
    link.download = 'occo-web.json';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <dialog
      ref={dialog}
      aria-label="Occo recording"
      className="occo-inspector"
      onKeyDown={e => {
        if (!['ArrowLeft', 'ArrowRight'].includes(e.key)) return;

        const controls = [list.current, save.current, back.current];
        const at = controls.findIndex(c => c === document.activeElement);
        const next = controls[at + (e.key === 'ArrowLeft' ? -1 : 1)];

        e.preventDefault();
        next?.focus();
      }}
    >
      <h2>Occo recording</h2>
      <p>{recordingSummary(recording)}</p>
      <div className="occo-columns">
        <select
          aria-label="Events"
          ref={list}
          size={10}
          value={index}
          onChange={e => setIndex(Number(e.target.value))}
        >
          {recording.events.map((e, i) => (
            <option key={e.seq} value={i}>
              {eventTitle(e)}
            </option>
          ))}
        </select>
        <dl>
          {eventDetails(recording, index).map(([label, value]) => (
            <React.Fragment key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </React.Fragment>
          ))}
        </dl>
      </div>
      <button ref={save} onClick={download}>
        Export recording
      </button>
      <button ref={back} onClick={close}>
        Return to Cinema
      </button>
    </dialog>
  );
}

export function OccoWeb({ children }: React.PropsWithChildren) {
  const [recorder] = useState(() => new WebRecording());
  const [state, setState] = useState<'idle' | 'recording' | 'frozen'>('idle');
  const [marked, setMarked] = useState(false);
  const [snapshot, setSnapshot] = useState<OccoRecording | null>(null);
  const close = React.useCallback(() => setSnapshot(null), []);

  useEffect(() => () => recorder.freeze(), [recorder]);

  const actions: DevelopmentAction[] = [
    {
      key: 'occo-record',
      title: 'Occo focus debugger',
      label:
        state === 'recording' ? 'Mark Occo incident' : 'Start Occo recording',
      value:
        state === 'recording'
          ? marked
            ? 'Incident marked'
            : 'Recording'
          : state === 'idle'
          ? 'Idle'
          : 'Start a new trace',
      press: () => {
        if (state === 'recording') {
          recorder.event({ kind: 'marker', detail: 'incident' });
          setMarked(true);
        } else {
          recorder.start();
          setMarked(false);
          setState('recording');
        }
      },
    },
  ];

  if (state !== 'idle')
    actions.push({
      key: 'occo-inspect',
      title: '',
      label:
        state === 'recording'
          ? 'Freeze and inspect Occo recording'
          : 'Inspect Occo recording',
      value: 'Event timeline',
      press: () => {
        recorder.freeze();
        setState('frozen');
        setSnapshot(recorder.snapshot());
      },
    });

  return (
    <DevelopmentSettings.Provider value={{ actions, refresh }}>
      {children}
      {snapshot && <Inspector recording={snapshot} close={close} />}
    </DevelopmentSettings.Provider>
  );
}
