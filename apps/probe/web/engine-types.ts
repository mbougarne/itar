// Private probe binding; numeric identifiers stay below Number.MAX_SAFE_INTEGER.
export type EngineNode = {
  key: string;
  parent: string;
  scope: boolean;
  active: boolean;
  enabled: boolean;
  mounted: boolean;
  mount: number;
  order: number;
  layout: number;
  boundary: number;
  trap: boolean;
  entryReady: boolean;
  restoreOnEntry: boolean;
  preferredKey: string;
  x: number;
  y: number;
  width: number;
  height: number;
  collection?: boolean;
  extent?: number;
  rowEntry?: 0 | 1;
  horizontalAlignment?: 0 | 1;
};

export type EngineEffect = {
  id: number;
  request: number;
  kind: number;
  key: string;
  mount: number;
  cancels: number;
};

export type EngineResult = { status: number; request: number };

export interface WebEngine {
  sync(nodes: EngineNode[]): number;
  observe(
    key: string,
    mount: number,
    channel: number,
    effect: number,
  ): EngineResult;
  unmanaged(channel: number): EngineResult;
  detach(key: string, mount: number): void;
  direction(
    direction: number,
    owner: number,
  ): { status: number; request: number };
  focus(key: string, owner: number): { status: number; request: number };
  restore(key: string): { status: number; request: number };
  drain(): EngineEffect[];
  issue(id: number): { status: number; request: number };
  complete(id: number, outcome: number): unknown;
  cancel(request: number): unknown;
  realize(id: number, key: string, mount: number): EngineResult;
  release(): void;
  advance(now: number): void;
  snapshot(): {
    inputKey: string;
    inputKind: number;
    a11yKey: string;
    a11yKind: number;
    activeRequest: number;
    resync: boolean;
  };
  delete(): void;
}

export type EngineModule = { WebEngine: new (capacity: number) => WebEngine };
