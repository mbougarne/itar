import React, {
  createContext,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type {
  FocusableProps,
  FocusProvider as NativeProvider,
  FocusScope as NativeScope,
} from '../../../packages/itar/src/react';
import { FocusContentContext } from '../../../packages/itar/src/api/contexts';
import type { FocusChannel } from '../../../packages/itar/src/api/types';
import {
  nativeScopeKey,
  nativeTargetKey,
} from '../../../packages/itar/src/api/types';
import createItarEngine from '../../../build/web-engine/itar-web.js';
import wasmBinary from '../../../build/web-engine/itar-web.wasm';
import type { EngineModule } from './engine-types';
import {
  createNode,
  WebFocusStore,
  directionalNavigationEnabled,
} from './focus-store';

export { occurrenceKey } from '../../../packages/itar/src/api/types';

export type {
  Activation,
  FocusKind,
  FocusChannel,
  FocusState,
  FocusOutcome,
  FocusRequest,
} from '../../../packages/itar/src/api/types';

export { setDirectionalNavigationEnabled } from './focus-store';

export type { FocusableProps };

export { FocusVirtualizedRails, FocusVirtualizedList } from './rails';

export type {
  VirtualizedFocusRail,
  VirtualizedFocusItem,
} from '../../../packages/itar/src/virtualized';

let engineModule: EngineModule;

export async function initializeFocusEngine() {
  engineModule = await createItarEngine({
    wasmBinary,
    locateFile: path => new URL(path, document.baseURI).href,
  });
}

const StoreContext = createContext<WebFocusStore | null>(null);

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

export function FocusProvider({
  children,
  active = true,
  style,
  testID,
}: React.ComponentProps<typeof NativeProvider>) {
  const [store] = useState(
    () => new WebFocusStore(new engineModule.WebEngine(2048)),
  );

  const root = useRef<HTMLElement | null>(null);

  useLayoutEffect(() => {
    store.setEnabled(active);
  }, [store, active]);

  useLayoutEffect(() => {
    const element = root.current;

    if (!element) {
      return;
    }

    const focus = () => {
      store.flush();
      store.observe(document.activeElement);
    };

    const blur = () =>
      queueMicrotask(() => {
        if (store.available()) {
          store.observe(document.activeElement);
        }
      });

    const measure = () => store.flush();

    const keydown = (event: KeyboardEvent) => {
      if (
        !directionalNavigationEnabled ||
        event.defaultPrevented ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey
      ) {
        return;
      }

      const direction = [
        'ArrowLeft',
        'ArrowRight',
        'ArrowUp',
        'ArrowDown',
      ].indexOf(event.key);

      const legacy = [37, 39, 38, 40].indexOf(event.keyCode);

      const key =
        event.target instanceof HTMLElement
          ? event.target.dataset.itarKey
          : undefined;

      const target = key ? store.get(key) : undefined;

      // Editable text, HTML media controls, reader/browser controls and other providers own their input.
      if (
        (direction < 0 && legacy < 0) ||
        !target?.active ||
        !target.enabled ||
        !store.available()
      ) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      store.direction(direction < 0 ? legacy : direction);
    };

    const keyup = (event: KeyboardEvent) => {
      if (
        store.available() &&
        ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(
          event.key,
        ) &&
        event.target instanceof HTMLElement &&
        event.target.dataset.itarKey &&
        store.get(event.target.dataset.itarKey)
      ) {
        store.engine.release();
      }
    };

    element.addEventListener('focusin', focus);
    element.addEventListener('focusout', blur);
    element.addEventListener('keydown', keydown);
    element.addEventListener('keyup', keyup);
    element.addEventListener('scroll', measure, true);

    const resize = new ResizeObserver(measure);

    resize.observe(element);
    store.flush();
    store.observe(document.activeElement);

    return () => {
      element.removeEventListener('focusin', focus);
      element.removeEventListener('focusout', blur);
      element.removeEventListener('keydown', keydown);
      element.removeEventListener('keyup', keyup);
      element.removeEventListener('scroll', measure, true);
      resize.disconnect();
      store.dispose();
    };
  }, [store]);

  const context = useMemo(() => ({ path: [], key: '', active }), [active]);

  return (
    <StoreContext.Provider value={store}>
      <WebScopeContext.Provider value={context}>
        <View
          ref={value => {
            root.current = value instanceof HTMLElement ? value : null;
          }}
          style={style}
          testID={testID}
        >
          {children}
        </View>
      </WebScopeContext.Provider>
    </StoreContext.Provider>
  );
}

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

export function Focusable({
  occurrenceKey: publicKey,
  contentId,
  accessibilityLabel,
  accessibilityRole,
  accessibilityState,
  enabled = true,
  order = 0,
  style,
  focusStyle,
  baseAccentColor,
  onPress,
  onAdjust,
  testID,
  displayLabel,
  labelPlacement = 'center',
  labelSize = 14,
  children,
}: FocusableProps) {
  const store = useWebStore();

  if (useContext(FocusContentContext)) {
    throw new Error('Focusable content cannot contain another focus host');
  }

  const scope = useContext(WebScopeContext);
  const key = nativeTargetKey(publicKey);

  const record = useMemo(
    () => ({
      ...createNode(key, scope.key),
      publicKey,
      mount: store.mountId(),
    }),
    [store, key, scope.key, publicKey],
  );

  const ref = useRef<HTMLElement | null>(null);

  useLayoutEffect(() => store.register(record), [store, record]);

  useLayoutEffect(() => {
    const element = ref.current;

    if (element) {
      element.dataset.itarKey = key;
      element.classList.add('itar-web-target');

      element.classList.toggle(
        'itar-web-target-background',
        typeof focusStyle?.backgroundColor === 'string',
      );

      element.style.setProperty(
        '--itar-accent',
        typeof focusStyle?.accentColor === 'string'
          ? focusStyle.accentColor
          : '#26D9F2',
      );

      if (typeof focusStyle?.backgroundColor === 'string') {
        element.style.setProperty(
          '--itar-focus-background',
          focusStyle.backgroundColor,
        );
      } else {
        element.style.removeProperty('--itar-focus-background');
      }
    }

    store.update(record, {
      element: element ?? undefined,
      enabled,
      active: scope.active,
      order,
      adjust: onAdjust,
    });
  }, [store, record, key, scope.active, enabled, order, onAdjust, focusStyle]);

  if (accessibilityRole !== undefined && onAdjust) {
    throw new Error('Adjustable targets retain their native role');
  }

  if (
    accessibilityRole === 'switch' &&
    typeof accessibilityState?.checked !== 'boolean'
  ) {
    throw new Error('Switch targets require a Boolean checked state');
  }

  return (
    <Pressable
      ref={value => {
        ref.current = value instanceof HTMLElement ? value : null;
      }}
      accessibilityRole={accessibilityRole ?? 'button'}
      aria-checked={
        accessibilityRole === 'switch' ? accessibilityState?.checked : undefined
      }
      accessibilityLabel={accessibilityLabel}
      disabled={!enabled || !scope.active}
      tabIndex={enabled && scope.active ? 0 : -1}
      style={style}
      testID={testID}
      onPress={() => {
        if (enabled && scope.active) {
          onPress?.({
            occurrenceKey: publicKey,
            contentId,
            lifetime: store.lifetime,
            mount: String(record.mount),
            sequence: String(store.mountId()),
            source: 'semantic',
          });
        }
      }}
    >
      {children == null ? (
        <Text
          pointerEvents="none"
          accessible={false}
          style={[
            labelStyles.base,
            labelPlacement === 'bottom' ? labelStyles.left : labelStyles.center,
            labelPlacement === 'center'
              ? labelStyles.middle
              : labelStyles.bottom,
            { color: baseAccentColor ?? '#F4EEE4', fontSize: labelSize },
            labelPlacement === 'center' && {
              transform: [{ translateY: -labelSize * 0.65 }],
            },
          ]}
        >
          {displayLabel ?? accessibilityLabel}
        </Text>
      ) : (
        <View
          {...{ inert: true }}
          aria-hidden
          pointerEvents="none"
          accessible={false}
          importantForAccessibility="no-hide-descendants"
          style={StyleSheet.absoluteFill}
        >
          <FocusContentContext.Provider value>
            {children}
          </FocusContentContext.Provider>
        </View>
      )}
    </Pressable>
  );
}

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
  return useFocusState(channel).occurrenceKey === key;
}

// Browsers expose no reliable screen-reader-enabled signal; never fabricate one.
export function useScreenReaderEnabled(): boolean | null {
  return null;
}

const labelStyles = StyleSheet.create({
  base: { position: 'absolute', left: 0, right: 0 },
  left: { textAlign: 'left' },
  center: { textAlign: 'center' },
  middle: { top: '50%' },
  bottom: { bottom: 4 },
});
