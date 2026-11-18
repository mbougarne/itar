import React, { useContext, useLayoutEffect, useMemo } from 'react';
import { View } from 'react-native';
import type { FocusScope as NativeScope } from '../../../packages/itar/src/react';
import {
  nativeScopeKey,
  nativeTargetKey,
} from '../../../packages/itar/src/api/types';
import { FocusContentContext } from '../../../packages/itar/src/api/contexts';
import { useWebStore, WebScopeContext } from './focus-context';
import { createNode } from './focus-store';

export function FocusScope({
  id,
  children,
  active = true,
  layout = 'spatial',
  boundary = 'stop',
  entryReady = true,
  restoreOnEntry = false,
  trap = false,
  preferredKey,
  style,
  testID,
}: React.ComponentProps<typeof NativeScope>) {
  const store = useWebStore();

  if (useContext(FocusContentContext)) {
    throw new Error('Focusable content cannot contain a focus scope');
  }

  const parent = useContext(WebScopeContext);
  const path = useMemo(() => [...parent.path, id], [parent.path, id]);
  const key = nativeScopeKey(path);

  const record = useMemo(
    () => createNode(key, parent.key, true),
    [key, parent.key],
  );

  const enabled = parent.active && active;

  useLayoutEffect(() => store.register(record), [store, record]);

  useLayoutEffect(() => {
    store.update(record, {
      active: enabled,
      entryReady,
      restoreOnEntry,
      trap,
      layout: ['spatial', 'row', 'column'].indexOf(layout),
      boundary: ['stop', 'wrap', 'parent'].indexOf(boundary),
      preferredKey: preferredKey ? nativeTargetKey(preferredKey) : '',
    });
  }, [
    store,
    record,
    enabled,
    entryReady,
    restoreOnEntry,
    trap,
    layout,
    boundary,
    preferredKey,
  ]);

  const context = useMemo(
    () => ({ path, key, active: enabled }),
    [path, key, enabled],
  );

  return (
    <WebScopeContext.Provider value={context}>
      <View
        {...{ inert: !enabled }}
        aria-hidden={!enabled}
        pointerEvents={enabled ? 'auto' : 'none'}
        style={style}
        testID={testID}
      >
        {children}
      </View>
    </WebScopeContext.Provider>
  );
}
