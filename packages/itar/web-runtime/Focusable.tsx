import React, { useContext, useLayoutEffect, useMemo, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { FocusableProps } from '../src/react';
import { nativeTargetKey } from '../src/api/types';
import { FocusContentContext } from '../src/api/contexts';
import { useWebStore, WebScopeContext } from './focus-context';
import { createNode, webTrace } from './focus-store';

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
    }),
    [key, scope.key, publicKey],
  );

  const ref = useRef<HTMLElement | null>(null);

  useLayoutEffect(() => {
    // React can detach and reattach effects for the same rendered card.
    record.mount = store.mountId();

    return store.register(record);
  }, [store, record]);

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
          webTrace?.event({
            kind: 'activation',
            surface: store.lifetime,
            target: key,
            mount: String(record.mount),
            detail: 'semantic',
          });

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

const labelStyles = StyleSheet.create({
  base: { position: 'absolute', left: 0, right: 0 },
  left: { textAlign: 'left' },
  center: { textAlign: 'center' },
  middle: { top: '50%' },
  bottom: { bottom: 4 },
});
