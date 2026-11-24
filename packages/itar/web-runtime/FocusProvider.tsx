import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import type { FocusProvider as NativeProvider } from '../src/react';
import createItarEngine from '../../../build/itar-web-engine/itar-web.js';
import wasmBinary from '../../../build/itar-web-engine/itar-web.wasm';
import type { EngineModule } from './engine-types';
import {
  WebFocusStore,
  directionalNavigationEnabled,
  webTrace,
} from './focus-store';
import { StoreContext, WebScopeContext } from './focus-context';

let engineModule: EngineModule | undefined;
let initializing: Promise<void> | undefined;

export function initializeFocusEngine(): Promise<void> {
  initializing ??= createItarEngine({
    wasmBinary,
    locateFile: path => new URL(path, document.baseURI).href,
  })
    .then(module => {
      engineModule = module;
    })
    .catch(error => {
      initializing = undefined;

      throw error;
    });

  return initializing;
}

type Props = React.ComponentProps<typeof NativeProvider>;

export function FocusProvider(props: Props) {
  const [store, setStore] = useState<WebFocusStore>();

  useLayoutEffect(() => {
    if (!engineModule) {
      throw new Error(
        'Await initializeFocusEngine() before mounting FocusProvider',
      );
    }

    const mounted = new WebFocusStore(new engineModule.WebEngine(2048));

    setStore(mounted);

    return () => mounted.dispose();
  }, []);

  return store ? <MountedProvider {...props} store={store} /> : null;
}

function MountedProvider({
  children,
  active = true,
  style,
  testID,
  store,
}: Props & { store: WebFocusStore }) {
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
      store.observe(document.activeElement, 0, true);
    };

    const blur = () =>
      queueMicrotask(() => {
        if (store.available()) {
          store.observe(
            document.activeElement,
            0,
            !!webTrace && !element.contains(document.activeElement),
          );
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

      store.direction(
        direction < 0 ? legacy : direction,
        webTrace?.move(event),
      );
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
