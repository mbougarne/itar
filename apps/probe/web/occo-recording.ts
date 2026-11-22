import type { OccoEvent, OccoRecording } from '../occo/timeline';
import { directionalNavigationEnabled, setWebTrace } from './focus-store';

const capacity = 1024;

const directions = new Map([
  ['ArrowLeft', 'left'],
  ['ArrowRight', 'right'],
  ['ArrowUp', 'up'],
  ['ArrowDown', 'down'],
  ['Enter', 'select'],
  ['Escape', 'back'],
  ['BrowserBack', 'back'],
  ['GoBack', 'back'],
  ['Tab', 'tab'],
]);

const legacyDirections: Record<number, string> = {
  13: 'select',
  37: 'left',
  39: 'right',
  38: 'up',
  40: 'down',
  10009: 'back',
  461: 'back',
};

// The browser exposes DOM input focus. It does not expose screen-reader focus.
export class WebRecording {
  private buffer: OccoEvent[] = [];
  private sequence = 0;
  private started = 0;
  private moves = new WeakMap<KeyboardEvent, string>();
  private recording = false;

  event = (value: Omit<OccoEvent, 'seq' | 'ms'>) => {
    if (!this.recording) return;

    const seq = ++this.sequence;

    this.buffer[(seq - 1) % capacity] = {
      ...value,
      seq,
      ms: Math.floor(performance.now() - this.started),
    };
  };

  move = (key: KeyboardEvent) => this.moves.get(key);

  private key = (event: KeyboardEvent) => {
    const direction =
      directions.get(event.key) || legacyDirections[event.keyCode];

    if (!direction) return;

    const move = String(this.sequence + 1);

    this.moves.set(event, move);

    this.event({
      kind: 'input',
      direction,
      move,
      detail: event.repeat ? 'window repeat' : 'window',
      owner:
        !directionalNavigationEnabled &&
        ['left', 'right', 'up', 'down'].includes(direction)
          ? 'host'
          : undefined,
    });
  };

  start() {
    this.buffer = [];
    this.sequence = 0;
    this.started = performance.now();
    this.recording = true;
    setWebTrace(this);
    window.addEventListener('keydown', this.key, true);
  }

  freeze() {
    this.recording = false;
    setWebTrace();
    window.removeEventListener('keydown', this.key, true);
  }

  snapshot(): OccoRecording {
    const dropped = this.sequence - this.buffer.length;

    return {
      format: 'occo',
      version: 1,
      state: this.recording ? 'recording' : 'frozen',
      capacity,
      dropped,
      device: { model: 'Web browser' },
      events: this.buffer.map(
        (_, index) => this.buffer[(index + dropped) % capacity],
      ),
    };
  }
}
