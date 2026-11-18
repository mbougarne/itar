import { createContext } from 'react';

export const BrowserNavigation = createContext<{
  enabled: boolean;
  toggle: () => void;
} | null>(null);
