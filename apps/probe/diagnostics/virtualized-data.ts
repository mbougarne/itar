import {
  occurrenceKey,
  type VirtualizedFocusItem,
  type VirtualizedFocusRail,
} from '@bougarnem/itar/react';

export const virtualizedKey = (row: number, item: number) =>
  occurrenceKey('virtualized', `row-${row}`, `entry-${item}`);

export function createVirtualizedRails(
  reverse: boolean,
  removed: boolean,
  onActivate: (key: string) => void,
): VirtualizedFocusRail[] {
  return Array.from({ length: 8 }, (_rowValue, row) => {
    const items: VirtualizedFocusItem[] = Array.from(
      { length: row === 0 ? 40 : 12 },
      (_itemValue, item) => ({
        occurrenceKey: virtualizedKey(row, item),
        contentId: `movie-${item % 3}`,
        accessibilityLabel: `Rail ${row + 1}, item ${item + 1}`,
        testID: `virtual-${row}-${item}`,
        focusStyle: { accentColor: '#ff8800' },
        onPress: value => onActivate(value.occurrenceKey),
      }),
    );

    const visible = removed
      ? items.filter(item => item.occurrenceKey !== virtualizedKey(row, 1))
      : items;

    return {
      id: `row-${row}`,
      items: reverse ? [...visible].reverse() : visible,
    };
  });
}
