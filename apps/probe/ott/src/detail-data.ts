import type { Film } from './catalog-types';
import { fetchDetails } from './tmdb';

type TitleDetails = Awaited<ReturnType<typeof fetchDetails>>;

// Only public catalogue metadata is shared for the lifetime of Cinema.
const recent = new Map<string, TitleDetails>();
const limit = 32;

function key(film: Film) {
  return `${film.source}/${film.id}`;
}

export function cachedDetails(film: Film) {
  return recent.get(key(film));
}

export async function loadDetails(film: Film, signal: AbortSignal) {
  const id = key(film);
  const previous = recent.get(id);

  if (previous) {
    recent.delete(id);
    recent.set(id, previous);

    return previous;
  }

  const result = await fetchDetails(film, signal);

  if (!signal.aborted) {
    recent.set(id, result);

    if (recent.size > limit) {
      const oldest = recent.keys().next();

      if (!oldest.done) recent.delete(oldest.value);
    }
  }

  return result;
}
