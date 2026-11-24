// Overscan plus the actual source and pending destination; never replace one with the other.
export function visibleIndices(
  count: number,
  start: number,
  size: number,
  ...pinned: number[]
) {
  const values = new Set<number>();

  for (
    let index = Math.max(0, start - 1);
    index < Math.min(count, start + size + 2);
    index++
  ) {
    values.add(index);
  }

  for (const index of pinned) {
    if (index >= 0 && index < count) {
      values.add(index);
    }
  }

  return [...values].sort((a, b) => a - b);
}
