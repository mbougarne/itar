import { createContext, useContext } from 'react';
import type { WebFocusStore } from './focus-store';

export const StoreContext = createContext<WebFocusStore | null>(null);

export const WebScopeContext = createContext({
  path: [] as string[],
  key: '',
  active: true,
});

export function useWebStore() {
  const store = useContext(StoreContext);

  if (!store) {
    throw new Error('Web focus components require FocusProvider');
  }

  return store;
}
