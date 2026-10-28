import {fetchPage, type Kind, type Rail, type DataSource} from './catalog';
export type CatalogueState = Readonly<{rows: readonly Rail[]; cursor: string | null; loading: boolean; error: string; ended: boolean; source: DataSource | null; limitReached: boolean}>;
const empty = (): CatalogueState => ({rows: [], cursor: null, loading: false, error: '', ended: false, source: null, limitReached: false});
export class CatalogueSession {
  private state = empty();
  private generation = 0;
  private closed = true;
  private controller: AbortController | null = null;
  private listeners = new Set<() => void>();
  constructor(private kind: Kind, private query: string,
    private options: () => {delay: number; fail: boolean}, private provider = fetchPage) {}
  snapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private publish(state: CatalogueState) { this.state = state; this.listeners.forEach(listener => listener()); }
  start = () => {
    this.dispose();
    this.closed = false;
    this.publish(empty());
    return this.loadMore();
  };
  dispose = () => { this.closed = true; this.generation += 1; this.controller?.abort(); };
  loadMore = async () => {
    if (this.closed || this.state.loading || this.state.ended) { return; }
    const owner = this.generation;
    const request = new AbortController();
    this.controller = request;
    const before = this.state;
    this.publish({...before, loading: true, error: ''});
    try {
      const page = await this.provider(this.kind, this.query, before.cursor, {signal: request.signal, ...this.options()});
      if (this.closed || owner !== this.generation || request.signal.aborted) { return; }
      let remaining = 48;
      const rows = [...before.rows, ...page.rows].map(row => {
        const entries = row.entries.slice(0, remaining); remaining -= entries.length;
        return entries.length === row.entries.length ? row : {...row, entries};
      }).filter(row => row.entries.length > 0);
      const limitReached = remaining === 0 && page.nextCursor !== null;
      this.publish({rows, cursor: limitReached ? null : page.nextCursor, source: page.source,
        loading: false, error: '', limitReached, ended: page.nextCursor === null || limitReached});
    } catch (error) {
      if (this.closed || owner !== this.generation || request.signal.aborted) { return; }
      this.publish({...before, loading: false, error: error instanceof Error ? error.message : 'Fixture fetch failed'});
    }
  };
}
