import { createContext } from 'react';

export const BrowserNavigation = createContext<{
  enabled: boolean;
  systemBackAtRoot?: boolean;
  toggle: () => void;
} | null>(null);
