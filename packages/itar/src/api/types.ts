export type FocusKind = 'managed' | 'unmanaged' | 'absent' | 'unknown';
export type FocusChannel = 'input' | 'accessibility';
export type FocusState = Readonly<{
  kind: FocusKind;
  occurrenceKey: string | null;
  lifetime: string | null;
  mount: string | null;
}>;
export type FocusOutcome = Readonly<{
  status: 'applied' | 'cancelled' | 'unavailable' | 'unsupported';
  reason: string;
  command: string;
  request: string | null;
  lifetime: string | null;
}>;
export type FocusRequest = Readonly<{
  command: string;
  result: Promise<FocusOutcome>;
  cancel(): void;
}>;
export type Activation = Readonly<{
  occurrenceKey: string;
  contentId?: string;
  lifetime: string;
  mount: string;
  sequence: string;
  source: 'input' | 'accessibility' | 'semantic';
}>;
export type SurfaceRecord = Readonly<{
  provider: string;
  lifetime: string;
  sequence: string;
  state: string;
}>;
export type FocusRecord = Readonly<{
  provider: string;
  lifetime: string;
  sequence: string;
  occurrenceKey: string;
  mount: string;
  kind: string;
  channel: string;
}>;
export type RequestRecord = Readonly<{
  provider: string;
  lifetime: string;
  sequence: string;
  command: string;
  request: string;
  status: string;
}>;
export type ActivationRecord = Readonly<{
  provider: string;
  lifetime: string;
  occurrenceKey: string;
  mount: string;
  sequence: string;
  source: string;
  registration: string;
}>;

// Application occurrence identity is independent of a movie/content identifier.
export function occurrenceKey(...parts: string[]): string {
  if (parts.length === 0 || parts.some(part => typeof part !== 'string' || part.length === 0)) {
    throw new Error('Occurrence keys require nonempty stable components');
  }
  return JSON.stringify(parts);
}
export const nativeTargetKey = (key: string): string => JSON.stringify(['target', key]);
export const nativeScopeKey = (path: readonly string[]): string => JSON.stringify(['scope', ...path]);
export function publicTargetKey(key: string): string | null {
  try {
    const value: unknown = JSON.parse(key);
    return Array.isArray(value) && value.length === 2 && value[0] === 'target' && typeof value[1] === 'string'
      ? value[1] : null;
  } catch { return null; }
}
export function decimal(value: string, zero = false): boolean {
  return typeof value === 'string' && /^(0|[1-9][0-9]*)$/.test(value) && value.length <= 20 &&
    (value.length < 20 || value <= '18446744073709551615') && (zero || value !== '0');
}
export function newer(value: string, previous: string): boolean {
  return value.length > previous.length || (value.length === previous.length && value > previous);
}
