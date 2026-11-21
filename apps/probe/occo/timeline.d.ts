export type OccoEvent = Readonly<{
  seq: number;
  ms: number;
  kind: string;
  surface?: string;
  request?: string;
  move?: string;
  target?: string;
  mount?: string;
  channel?: 'input' | 'accessibility';
  direction?: string;
  owner?: string;
  detail?: string;
  effect?: string;
  nativeDestination?: Readonly<{
    role: string;
    bounds?: Readonly<{
      left: number;
      top: number;
      right: number;
      bottom: number;
    }>;
  }>;
}>;

export type OccoRecording = Readonly<{
  format: 'occo';
  version: 1;
  capacity: number;
  dropped: number;
  events: readonly OccoEvent[];
  state?: 'idle' | 'recording' | 'frozen';
  device?: {
    model: string;
    android: string;
    api: number;
    accessibilityEnabledAtStart?: boolean;
    touchExplorationAtStart?: boolean;
  };
}>;

export const maxBytes: number;

export function recordingSummary(recording: OccoRecording): string;

export function parseRecording(text: string): OccoRecording;

export function eventTitle(event: OccoEvent): string;

export function eventDetails(
  recording: OccoRecording,
  index: number,
): [string, string][];
