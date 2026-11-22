import React, {
  memo,
  useSyncExternalStore,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { View } from 'react-native';
import { nativeTargetKey } from '../../../packages/itar/src/api/types';
import { horizontalScrollOffset } from '../../../packages/itar/src/api/viewport';
import { useWebStore } from './focus-context';
import { directionalNavigationEnabled } from './focus-store';
import { Focusable } from './Focusable';
import { FocusScope } from './FocusScope';
import { htmlStyles, itemStyles } from './rail-styles';
import type { RowProps } from './rail-types';
import { visibleIndices } from './window';

export const Rail = memo(function RailRow({
  rail,
  height,
  width,
  extent,
  headerHeight,
  renderHeader,
  decoration,
  renderItem,
  forced,
  alignment,
  active,
}: RowProps) {
  const [start, setStart] = useState(0);
  const scroll = useRef<HTMLDivElement>(null);
  const store = useWebStore();
  const previousAlignment = useRef(alignment);
  const pinned = alignment === 'pinned';

  const content =
    rail.items.length * extent +
    (pinned && rail.items.length ? Math.max(0, width - extent) : 0);

  const focused = useSyncExternalStore(store.subscribe, () => {
    const key = store.snapshot().occurrenceKey;

    return rail.items.findIndex(item => item.occurrenceKey === key);
  });

  const requested = rail.items.findIndex(
    item => nativeTargetKey(item.occurrenceKey) === forced,
  );

  const indices = visibleIndices(
    rail.items.length,
    start,
    Math.ceil(width / extent),
    requested,
    focused,
  );

  useLayoutEffect(() => {
    const changed = previousAlignment.current !== alignment;

    previousAlignment.current = alignment;

    const view = scroll.current;

    if (!view) {
      return;
    }

    const reversed = getComputedStyle(view).direction === 'rtl';

    const index = requested >= 0 ? requested : focused;

    const maximum = Math.max(0, content - width);
    const current = reversed ? maximum + view.scrollLeft : view.scrollLeft;

    setStart(
      Math.floor((pinned && reversed ? maximum - current : current) / extent),
    );

    if (
      !active ||
      !directionalNavigationEnabled ||
      index < 0 ||
      (requested >= 0 ? changed : !store.canAlign()) ||
      (requested < 0 && alignment === 'nearest')
    ) {
      return;
    }

    const itemStart =
      pinned && reversed ? content - (index + 1) * extent : index * extent;

    const offset = horizontalScrollOffset(
      itemStart,
      itemStart + extent,
      current,
      width,
      content,
      pinned ? 'leading' : alignment,
      reversed,
    );

    view.scrollLeft = reversed ? offset - maximum : offset;

    setStart(
      Math.floor((pinned && reversed ? maximum - offset : offset) / extent),
    );
  }, [
    requested,
    focused,
    extent,
    width,
    content,
    pinned,
    alignment,
    active,
    store,
  ]);

  return (
    <FocusScope id={rail.id} layout="row" boundary="parent" style={{ height }}>
      {headerHeight > 0 && (
        <View pointerEvents="none" style={{ height: headerHeight }}>
          {renderHeader?.(rail)}
        </View>
      )}
      <div
        ref={scroll}
        className="itar-web-scrollport"
        style={{
          height: height - headerHeight,
          ...htmlStyles.horizontal,
          width,
        }}
        onScroll={event => {
          const view = event.currentTarget;

          const reversed = getComputedStyle(view).direction === 'rtl';

          const offset =
            pinned && reversed
              ? -view.scrollLeft
              : reversed
              ? Math.max(0, view.scrollWidth - view.clientWidth) +
                view.scrollLeft
              : view.scrollLeft;

          setStart(Math.floor(offset / extent));
        }}
      >
        <div
          style={{
            height: height - headerHeight,
            width: content,
            ...htmlStyles.relative,
          }}
        >
          {indices.map(index => {
            const item = rail.items[index];

            return (
              <View
                key={item.occurrenceKey}
                style={{
                  ...itemStyles.cell,
                  ...(pinned
                    ? { start: index * extent }
                    : { left: index * extent }),
                  width: extent,
                  height: height - headerHeight,
                }}
              >
                {decoration && (
                  <View
                    accessible={false}
                    importantForAccessibility="no-hide-descendants"
                    pointerEvents="none"
                  >
                    {decoration(item)}
                  </View>
                )}
                <Focusable
                  {...item}
                  order={index}
                  style={[
                    { width: extent, height: height - headerHeight },
                    rail.itemStyle,
                    rail.overlayTarget && itemStyles.overlay,
                  ]}
                >
                  {renderItem ? renderItem(item, index) : item.children}
                </Focusable>
              </View>
            );
          })}
        </div>
      </div>
    </FocusScope>
  );
});
