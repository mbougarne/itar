import { useContext, useMemo, useSyncExternalStore } from 'react';
import {
  nativeScopeKey,
  nativeTargetKey,
  type FocusChannel,
} from '../src/api/types';
import { useWebStore, WebScopeContext } from './focus-context';

export function useFocusCommands() {
  const store = useWebStore();
  const scope = useContext(WebScopeContext);

  return useMemo(
    () => ({
      focusByKey: (key: string) => store.request(nativeTargetKey(key)),
      restoreFocusByKey: (key: string) =>
        store.request(nativeTargetKey(key), true),
      restoreScope: (path: readonly string[] = scope.path) =>
        store.request(nativeScopeKey(path), true),
      showDialog: () => {
        throw new Error('Native dialog probes are unavailable on web');
      },
      dismissDialog: () => {
        throw new Error('Native dialog probes are unavailable on web');
      },
    }),
    [store, scope.path],
  );
}

export function useFocusReady() {
  return useWebStore().available();
}

export function useFocusState(channel: FocusChannel = 'input') {
  const store = useWebStore();

  return useSyncExternalStore(
    store.subscribe,
    channel === 'input' ? store.snapshot : store.accessibilitySnapshot,
  );
}

export function useIsFocused(key: string, channel: FocusChannel = 'input') {
  const store = useWebStore();

  const snapshot =
    channel === 'input' ? store.snapshot : store.accessibilitySnapshot;

  return useSyncExternalStore(
    store.subscribe,
    () => snapshot().occurrenceKey === key,
  );
}

// Browsers expose no reliable screen-reader-enabled signal; never fabricate one.
export function useScreenReaderEnabled(): boolean | null {
  return null;
}
