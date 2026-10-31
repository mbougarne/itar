import type {Rail} from './catalog';
// Repack API pages without repeating titles or changing earlier occurrence positions.
export function layoutRows(rows: readonly Rail[], mode: 'home' | 'grid'): readonly Rail[] {
  const seen = new Set<string>();
  const entries = rows.flatMap(row => row.entries).filter(film => {
    if (seen.has(film.id)) { return false; }
    seen.add(film.id);return true;
  });
  if (mode === 'home') {
    return ['Popular stories', 'Worth exploring', 'The poster collection', 'More discoveries'].map((title, index): Rail => ({
      id: `home-${index}`, title, format: index < 2 ? 'landscape' : 'poster',
      entries: entries.filter((_, position) => position % 4 === index).slice(0, 15),
    })).filter(row => row.entries.length > 0);
  }
  return Array.from({length: Math.ceil(entries.length / 5)}, (_, index): Rail => ({
    id: `grid-${index}`, title: '', format: 'landscape', entries: entries.slice(index * 5, index * 5 + 5),
  }));
}
