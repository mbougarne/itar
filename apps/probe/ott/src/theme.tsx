import React, { createContext, useContext, useMemo } from 'react';
import { useWindowDimensions } from 'react-native';
import { createStyles } from './styles';

const Context = createContext({ s: createStyles(1), u: 1 });

export function DesignTheme({ children }: { children: React.ReactNode }) {
  const { width, height } = useWindowDimensions();
  const u = Math.min(width / 1920, height / 1080);
  const value = useMemo(() => ({ s: createStyles(u), u }), [u]);

  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export const useDesign = () => useContext(Context);
