import {useEffect, useMemo, useRef, useSyncExternalStore} from 'react';
import type {Kind} from './catalog';
import {fetchPage} from './catalog';
import {fetchProxyPage, type ProviderMode} from './tmdb';
import {CatalogueSession} from './session';
export function useCatalogue(kind: Kind, query: string, delay: number, failNext: () => boolean, mode: ProviderMode = 'fixture') {
  const options = useRef({delay, failNext});
  options.current = {delay, failNext};
  const normalized = query.trim().toLocaleLowerCase('en-US');
  const session = useMemo(() => new CatalogueSession(kind, normalized,
    () => ({delay: options.current.delay, fail: options.current.failNext()}), mode === 'proxy' ? fetchProxyPage : fetchPage), [kind, normalized, mode]);
  const state = useSyncExternalStore(session.subscribe, session.snapshot, session.snapshot);
  useEffect(() => { session.start(); return session.dispose; }, [session]);
  return {state, loadMore: session.loadMore, reload: session.start};
}
