declare module '*itar-web.js' {
  const createItarEngine: (options: {
    wasmBinary: Uint8Array;
    locateFile(path: string): string;
  }) => Promise<import('./engine-types').EngineModule>;
  export default createItarEngine;
}

declare module '*.wasm' {
  const bytes: Uint8Array;
  export default bytes;
}
