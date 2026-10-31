import {useEffect, useMemo, useRef, useSyncExternalStore} from 'react';
import type {Category, Kind} from './catalog';
import {fetchPage} from './catalog';
import {fetchProxyPage, type ProviderMode} from './tmdb';
import {CatalogueSession} from './session';
export function useCatalogue(kind: Kind, query: string, delay: number, failNext: () => boolean, mode: ProviderMode = 'fixture', limit = 160, category: Category = 'All') {
  const options = useRef({delay, failNext});
  options.current = {delay, failNext};
  const normalized = query.trim().toLocaleLowerCase('en-US');
  const session = useMemo(() => new CatalogueSession(kind, normalized,
    () => ({delay: options.current.delay, fail: options.current.failNext(), category}), mode === 'proxy' ? fetchProxyPage : fetchPage, limit), [kind, normalized, mode, limit, category]);
  const state = useSyncExternalStore(session.subscribe, session.snapshot, session.snapshot);
  useEffect(() => { session.start(); return session.dispose; }, [session]);
  return {state, loadMore: session.loadMore, reload: session.start, nextWindow: session.nextWindow};
}
