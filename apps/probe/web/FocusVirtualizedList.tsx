import React, { useMemo } from 'react';
import type {
  FocusVirtualizedList as NativeList,
  VirtualizedFocusItem,
} from '../../../packages/itar/src/virtualized';
import { FocusVirtualizedRails } from './rails';

export function FocusVirtualizedList({
  id,
  data,
  horizontal = true,
  itemExtent,
  viewportExtent,
  itemStyle,
  style,
  testID,
  horizontalAlignment = 'nearest',
  renderItem,
}: React.ComponentProps<typeof NativeList>) {
  const rails = useMemo(
    () =>
      horizontal
        ? [{ id: 'items', items: data, itemExtent, itemStyle }]
        : data.map(item => ({
            id: item.occurrenceKey,
            items: [item],
            itemExtent: 240,
            itemStyle,
          })),
    [horizontal, data, itemExtent, itemStyle],
  );

  const contentRenderer = useMemo(
    () =>
      !renderItem || horizontal
        ? renderItem
        : (item: VirtualizedFocusItem) =>
            renderItem(
              item,
              data.findIndex(
                candidate => candidate.occurrenceKey === item.occurrenceKey,
              ),
            ),
    [renderItem, horizontal, data],
  );

  return (
    <FocusVirtualizedRails
      id={id}
      rails={rails}
      renderItem={contentRenderer}
      horizontalAlignment={horizontalAlignment}
      itemExtent={horizontal ? itemExtent : 240}
      rowExtent={horizontal ? 100 : itemExtent}
      viewportHeight={horizontal ? 100 : viewportExtent}
      viewportExtent={horizontal ? viewportExtent : 240}
      style={style}
      testID={testID}
    />
  );
}
