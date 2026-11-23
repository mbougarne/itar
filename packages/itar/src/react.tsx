import React, {createContext, memo, useCallback, useContext, useEffect, useLayoutEffect,
  useMemo, useRef, useState, useSyncExternalStore} from 'react';
import {AccessibilityInfo, Platform, StyleSheet, View} from 'react-native';
import type {ColorValue, StyleProp, ViewStyle} from 'react-native';
import NativeSurface, {Commands} from './specs/ItarSurfaceNativeComponent';
import NativeScope from './specs/ItarScopeNativeComponent';
import NativeTarget from './specs/ItarTargetNativeComponent';
import {FocusStore} from './api/store';
import {CollectionStore} from './api/collections';
import {CollectionContext, CollectionDatasetContext, ScopeContext, PaneTargetContext, FocusContentContext} from './api/contexts';
import {nativeScopeKey, nativeTargetKey} from './api/types';
import type {ProviderProps, ScopeProps, TargetProps} from './api/component-props';
import type {FocusChannel} from './api/types';
export {occurrenceKey} from './api/types';
export type {Activation, FocusKind, FocusChannel, FocusState, FocusOutcome, FocusRequest} from './api/types';

const StoreContext = createContext<FocusStore | null>(null);
const supported = Platform.isTV && (Platform.OS === 'ios' || Platform.OS === 'android');
const clearedAccessibilityState = {};
const useStore = (): FocusStore => {
  const store = useContext(StoreContext);
  if (!store) { throw new Error('Itar components and hooks require FocusProvider'); }
  return store;
};

export function FocusProvider({children, active = true, style, testID}: ProviderProps<StyleProp<ViewStyle>>) {
  const view = useRef<React.ElementRef<typeof NativeSurface>>(null);
  const [store] = useState(() => new FocusStore({
    focus: (key, command) => {
      if (!view.current) { throw new Error('Native surface is not mounted'); }
      Commands.focusRequest(view.current, key, command);
    },
    restore: (key, command) => {
      if (!view.current) { throw new Error('Native surface is not mounted'); }
      Commands.restoreScopeRequest(view.current, key, command);
    },
    cancel: command => { if (view.current) { Commands.cancelRequest(view.current, command); } },
    showDialog: () => { if (view.current) { Commands.showDialog(view.current); } },
    dismissDialog: () => { if (view.current) { Commands.dismissDialog(view.current); } },
  }, supported));
  const [collections] = useState(() => new CollectionStore(store.provider, payload => {
    if (view.current) { Commands.prepareCollection(view.current, payload); }
  }));
  const collection = useSyncExternalStore(collections.subscribe, collections.snapshot, collections.snapshot);
  useLayoutEffect(() => { store.activate(); return () => store.deactivate(); }, [store]);
  useLayoutEffect(() => { store.setEnabled(active); }, [store, active]);
  const content = <ScopeContext.Provider value={useMemo(() => ({path: [], key: '', active}), [active])}>
    {children}
  </ScopeContext.Provider>;
  return <StoreContext.Provider value={store}><CollectionContext.Provider value={collections}>
    {supported ? <NativeSurface ref={view} providerId={store.provider} active={active} style={style} testID={testID}
      collectionData={collection.data} onCollectionRecord={event => collections.record(event.nativeEvent)}
      onSurfaceRecord={event => { store.surface(event.nativeEvent); collections.surface(event.nativeEvent); }}
      onFocusRecord={event => store.focus(event.nativeEvent)}
      onRequestRecord={event => store.receipt(event.nativeEvent)}>{content}</NativeSurface> :
      <View style={style} testID={testID}>{content}</View>}
  </CollectionContext.Provider></StoreContext.Provider>;
}

export function FocusScope({id, active = true, layout = 'spatial', boundary = 'stop', trap = false,
  entryReady = true, restoreOnEntry = false, preferredKey, accessibilityPaneTitle, children, style, testID}: ScopeProps<StyleProp<ViewStyle>>) {
  useStore();
  if (useContext(FocusContentContext)) { throw new Error('Focusable content cannot contain a focus scope'); }
  const parent = useContext(ScopeContext);
  const collectionDataset = useContext(CollectionDatasetContext);
  const context = useMemo(() => {
    if (!id) { throw new Error('A scope requires a stable id'); }
    const path = [...parent.path, id];
    return {path, key: nativeScopeKey(path), active: parent.active && active};
  }, [parent, id, active]);
  const inheritedPane = useContext(PaneTargetContext);
  const paneTarget = !context.active ? undefined : accessibilityPaneTitle ? preferredKey : inheritedPane;
  const content = <ScopeContext.Provider value={context}>
    <PaneTargetContext.Provider value={paneTarget}>{children}</PaneTargetContext.Provider>
  </ScopeContext.Provider>;
  return supported ? <NativeScope scopeKey={context.key} parentScopeKey={parent.key} active={context.active}
    collectionDataset={collectionDataset}
    layout={layout} boundary={boundary} trap={trap} entryReady={entryReady} restoreOnEntry={restoreOnEntry}
    paneTitle={accessibilityPaneTitle ?? ''}
    preferredKey={preferredKey === undefined ? '' : nativeTargetKey(preferredKey)} style={style} testID={testID}>
    {content}
  </NativeScope> : <View style={style} testID={testID}>{content}</View>;
}

export type FocusableProps = TargetProps<StyleProp<ViewStyle>, ColorValue>;
// Render allocates only an identity. Registration is published at host/effect commit.
export const Focusable = memo(function FocusableButton({occurrenceKey: key, contentId, accessibilityLabel,
  accessibilityRole, accessibilityState,
  enabled = true, order = 0, style, focusStyle, baseAccentColor, onPress, onAdjust, testID, children, displayLabel, labelPlacement = 'center', labelSize = 14, outlineInsetBottom = 0}: FocusableProps) {
  const store = useStore();
  if (useContext(FocusContentContext)) { throw new Error('Focusable content cannot contain another focus host'); }
  const scope = useContext(ScopeContext);
  const collectionDataset = useContext(CollectionDatasetContext);
  const lease = useMemo(() => ({token: {key, scope: scope.key}, registration: store.registrationId()}), [store, key, scope.key]);
  const committed = useRef({key, contentId, onPress, onAdjust});
  if (!key || !accessibilityLabel || !Number.isInteger(order) || order < -2147483648 || order > 2147483647) {
    throw new Error('Focusable requires an occurrence key, label and Int32 order');
  }
  useLayoutEffect(() => store.register(key, lease.token, lease.registration, false, false), [store, key, lease]);
  useLayoutEffect(() => {
    committed.current = {key, contentId, onPress, onAdjust};
    store.updateTarget(key, lease.token, enabled, scope.active);
  }, [store, key, lease, contentId, onPress, onAdjust, enabled, scope.active]);
  if (accessibilityRole !== undefined && onAdjust) {
    throw new Error('Adjustable targets retain their native role');
  }
  if (accessibilityRole === 'switch' && typeof accessibilityState?.checked !== 'boolean') {
    throw new Error('Switch targets require a Boolean checked state');
  }
  const radius = StyleSheet.flatten(style)?.borderRadius;
  if (!supported) { return <View style={style} testID={testID} accessibilityLabel={accessibilityLabel}>{children}</View>; }
  return <NativeTarget occurrenceKey={nativeTargetKey(key)} scopeKey={scope.key} registrationId={lease.registration}
    collectionDataset={collectionDataset}
    label={accessibilityLabel} displayLabel={displayLabel ?? accessibilityLabel} labelPlacement={labelPlacement}
    accessibilityRole={Platform.OS === 'android' ? accessibilityRole : undefined}
    accessibilityState={Platform.OS === 'android' ?
      (accessibilityRole === 'switch' ? accessibilityState : clearedAccessibilityState) : undefined}
    labelSize={labelSize} outlineInsetBottom={outlineInsetBottom} enabled={enabled} order={order} style={style} testID={testID}
    cornerRadius={typeof radius === 'number' && Number.isFinite(radius) ? Math.max(0, radius) : 6}
    baseColor={baseAccentColor} focusColor={focusStyle?.accentColor} focusBackgroundColor={focusStyle?.backgroundColor}
    adjustable={onAdjust !== undefined}
    onAdjust={event => {
      const record = event.nativeEvent;
      if (record.delta !== '-1' && record.delta !== '1') { return; }
      if (store.activation(record, committed.current.key, lease.token)) { committed.current.onAdjust?.(record.delta === '1' ? 1 : -1); }
    }}
    onActivate={event => {
      const activation = store.activation(event.nativeEvent, committed.current.key, lease.token);
      if (activation) { committed.current.onPress?.({...activation, contentId: committed.current.contentId}); }
    }}>
    {children == null ? null : <View collapsable={false} pointerEvents="none" accessible={false}
      importantForAccessibility="no-hide-descendants" style={StyleSheet.absoluteFill}>
      <FocusContentContext.Provider value>{children}</FocusContentContext.Provider>
    </View>}
  </NativeTarget>;
});

export function useFocusCommands() {
  const store = useStore();
  const scope = useContext(ScopeContext);
  return useMemo(() => ({focusByKey: (key: string) => store.request(key),
    restoreFocusByKey: (key: string) => store.restoreTarget(key),
    restoreScope: (path: readonly string[] = scope.path) => store.restore(path),
    showDialog: () => store.showDialog(), dismissDialog: () => store.dismissDialog()}), [store, scope.path]);
}
export function useFocusReady(): boolean {
  const store = useStore();
  return useSyncExternalStore(useCallback((listener: () => void) => store.subscribeStatus(listener), [store]),
    useCallback(() => store.ready(), [store]), () => false);
}
export function useFocusState(channel: FocusChannel = 'input') {
  const store = useStore();
  return useSyncExternalStore(useCallback((listener: () => void) => store.subscribe(channel, listener), [store, channel]),
    useCallback(() => store.snapshot(channel), [store, channel]));
}
export function useIsFocused(key: string, channel: FocusChannel = 'input'): boolean {
  const store = useStore();
  return useSyncExternalStore(useCallback((listener: () => void) => store.subscribe(channel, listener, key), [store, key, channel]),
    useCallback(() => store.isFocused(key, channel), [store, key, channel]), () => false);
}
export function useScreenReaderEnabled(): boolean | null {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  useEffect(() => {
    let alive = true;
    let changed = false;
    const subscription = AccessibilityInfo.addEventListener('screenReaderChanged', value => {
      changed = true;
      if (alive) { setEnabled(value); }
    });
    AccessibilityInfo.isScreenReaderEnabled().then(
      value => { if (alive && !changed) { setEnabled(value); } },
      () => { if (alive && !changed) { setEnabled(null); } },
    );
    return () => { alive = false; subscription.remove(); };
  }, []);
  return enabled;
}
export {FocusVirtualizedList, FocusVirtualizedRails} from './virtualized';
export type {VirtualizedFocusItem, VirtualizedFocusRail, VirtualizedFocusItemRenderer} from './virtualized';
