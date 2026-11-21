// Public build-time endpoint only. Provider credentials never enter this module.
import type {
  CastMember,
  Category,
  Film,
  Kind,
  Page,
  Rail,
} from './catalog-types';

// Replaced by the bundler; no Node runtime or server environment is loaded.
declare const process: { env: { ITAR_TMDB_PROXY_URL?: string } };

const PROXY = process.env.ITAR_TMDB_PROXY_URL || 'http://127.0.0.1:8787';

const record = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const string = (v: unknown, max: number): v is string =>
  typeof v === 'string' && v.length <= max;

const source = (v: unknown): v is 'tmdb' | 'tmdb-mock' =>
  v === 'tmdb' || v === 'tmdb-mock';

function artwork(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (
    !string(value, 300) ||
    !/^(https:\/\/image\.tmdb\.org\/t\/p\/(w185|w500|w1280)\/[\w.-]+\.(jpg|png|webp)|http:\/\/127\.0\.0\.1:8787\/v1\/mock-art\/[0-7])$/.test(
      value,
    )
  ) {
    throw new Error('Proxy returned an invalid artwork address.');
  }

  return value;
}

export function parseFilm(v: unknown): Film {
  if (
    !record(v) ||
    !string(v.id, 80) ||
    !/^tmdb:(movie|series):\d+$/.test(v.id) ||
    !string(v.title, 200) ||
    !string(v.synopsis, 4000) ||
    !string(v.category, 300) ||
    !Number.isInteger(v.year) ||
    typeof v.year !== 'number' ||
    !source(v.source) ||
    (v.kind !== 'movie' && v.kind !== 'series') ||
    !v.id.startsWith(`tmdb:${v.kind}:`)
  ) {
    throw new Error('Proxy returned invalid title metadata.');
  }

  const metadata: Partial<
    Record<'rating' | 'votes' | 'runtime' | 'seasons' | 'episodes', number>
  > = {};

  for (const key of [
    'rating',
    'votes',
    'runtime',
    'seasons',
    'episodes',
  ] as const) {
    if (v[key] === undefined) {
      continue;
    }

    if (
      typeof v[key] !== 'number' ||
      !Number.isFinite(v[key]) ||
      v[key] < 0 ||
      v[key] > (key === 'rating' ? 10 : 1000000000)
    ) {
      throw new Error('Proxy returned invalid numeric metadata.');
    }

    metadata[key] = v[key];
  }

  const descriptions: Partial<
    Record<
      | 'certification'
      | 'certificationRegion'
      | 'tagline'
      | 'status'
      | 'languages'
      | 'countries'
      | 'studios',
      string
    >
  > = {};

  for (const key of [
    'certification',
    'certificationRegion',
    'tagline',
    'status',
    'languages',
    'countries',
    'studios',
  ] as const) {
    if (v[key] === undefined) {
      continue;
    }

    if (!string(v[key], 500)) {
      throw new Error('Proxy returned invalid descriptive metadata.');
    }

    descriptions[key] = v[key];
  }

  return {
    ...metadata,
    ...descriptions,
    id: v.id,
    title: v.title,
    synopsis: v.synopsis,
    category: v.category,
    year: v.year,
    kind: v.kind,
    source: v.source,
    art: 0,
    posterUrl: artwork(v.posterUrl),
    backdropUrl: artwork(v.backdropUrl),
    titleLogoUrl: artwork(v.titleLogoUrl),
  };
}

async function request(
  route: string,
  params: Record<string, string>,
  signal: AbortSignal,
): Promise<unknown> {
  const controller = new AbortController();
  const abort = () => controller.abort();

  signal.addEventListener('abort', abort, { once: true });

  if (signal.aborted) {
    abort();
  }

  const timer = setTimeout(abort, 12000);

  try {
    const query = Object.entries(params)
      .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
      .join('&');

    const response = await fetch(`${PROXY}${route}?${query}`, {
      signal: controller.signal,
    });

    const data: unknown = await response.json();

    if (!response.ok) {
      throw new Error(
        record(data) && string(data.error, 200)
          ? data.error
          : 'Local proxy request failed.',
      );
    }

    return data;
  } catch (error) {
    if (signal.aborted) {
      throw error;
    }

    if (error instanceof Error && /^(TMDB|Proxy|Local)/.test(error.message)) {
      throw error;
    }

    throw new Error(
      'Local TMDB proxy unavailable. Start the local backend or choose Fixtures in Settings.',
    );
  } finally {
    clearTimeout(timer);
    signal.removeEventListener('abort', abort);
  }
}

export const fetchProxyPage = async (
  kind: Kind,
  query: string,
  cursor: string | null,
  options: {
    signal: AbortSignal;
    delay?: number;
    fail?: boolean;
    category?: Category;
  },
): Promise<Page> => {
  if ((options.delay || 0) > 180) {
    await new Promise<void>((resolve, reject) => {
      const abort = () => {
        clearTimeout(timer);
        options.signal.removeEventListener('abort', abort);
        reject(new Error('Local request cancelled.'));
      };

      const timer = setTimeout(() => {
        options.signal.removeEventListener('abort', abort);
        resolve();
      }, options.delay);

      if (options.signal.aborted) {
        abort();
      } else {
        options.signal.addEventListener('abort', abort, { once: true });
      }
    });
  }

  if (options.fail) {
    throw new Error('Simulated local client failure. Retry to continue.');
  }

  const data = await request(
    '/v1/catalogue',
    {
      kind,
      query,
      category: options.category || 'All',
      ...(cursor ? { cursor } : {}),
    },
    options.signal,
  );

  if (
    !record(data) ||
    !source(data.source) ||
    !Array.isArray(data.rows) ||
    data.rows.length > 4 ||
    !(data.nextCursor === null || string(data.nextCursor, 1000))
  ) {
    throw new Error('Proxy returned an invalid page.');
  }

  const pageSource = data.source;
  const seen = new Set<string>();

  const rows = data.rows.map((row): Rail => {
    if (
      !record(row) ||
      !string(row.id, 100) ||
      seen.has(row.id) ||
      !string(row.title, 200) ||
      (row.format !== 'landscape' && row.format !== 'poster') ||
      !Array.isArray(row.entries) ||
      row.entries.length > 5
    ) {
      throw new Error('Proxy returned an invalid rail.');
    }

    seen.add(row.id);

    const entries = row.entries.map(parseFilm);

    if (
      new Set(entries.map(film => film.id)).size !== entries.length ||
      entries.some(film => film.source !== pageSource)
    ) {
      throw new Error('Proxy returned inconsistent title identities.');
    }

    return { id: row.id, title: row.title, format: row.format, entries };
  });

  return {
    rows,
    nextCursor: data.nextCursor,
    source: pageSource,
    attribution: string(data.attribution, 300) ? data.attribution : undefined,
  };
};

export async function fetchDetails(
  film: Film,
  signal: AbortSignal,
): Promise<{
  film: Film;
  cast: readonly CastMember[];
  related: readonly Film[];
}> {
  const data = await request('/v1/details', { id: film.id }, signal);

  if (!record(data) || !Array.isArray(data.cast) || data.cast.length > 8) {
    throw new Error('Proxy returned invalid cast data.');
  }

  const updated = parseFilm(data.film);

  if (updated.id !== film.id || updated.source !== film.source) {
    throw new Error('Proxy changed the selected title identity.');
  }

  const cast = data.cast.map(person => {
    if (
      !record(person) ||
      !string(person.id, 32) ||
      !/^\d+$/.test(person.id) ||
      !string(person.name, 120) ||
      !string(person.role, 120)
    ) {
      throw new Error('Proxy returned invalid cast metadata.');
    }

    return {
      id: person.id,
      name: person.name,
      role: person.role,
      portraitUrl: artwork(person.portraitUrl),
    };
  });

  if (new Set(cast.map(person => person.id)).size !== cast.length) {
    throw new Error('Proxy returned duplicate cast identities.');
  }

  if (!Array.isArray(data.related) || data.related.length > 12) {
    throw new Error('Proxy returned invalid related titles.');
  }

  const related = data.related.map(parseFilm);

  if (
    new Set(related.map(value => value.id)).size !== related.length ||
    related.some(value => value.source !== film.source || value.id === film.id)
  ) {
    throw new Error('Proxy returned inconsistent related identities.');
  }

  // Different TMDB endpoints can omit different sizes or kinds of title artwork.
  return {
    film: {
      ...updated,
      posterUrl: updated.posterUrl ?? artwork(film.posterUrl),
      backdropUrl: updated.backdropUrl ?? artwork(film.backdropUrl),
      titleLogoUrl: updated.titleLogoUrl ?? artwork(film.titleLogoUrl),
    },
    cast,
    related,
  };
}

export async function fetchBiography(
  person: CastMember,
  signal: AbortSignal,
): Promise<string> {
  const data = await request('/v1/person', { id: person.id }, signal);

  if (!record(data) || data.id !== person.id || !string(data.bio, 8000)) {
    throw new Error('Proxy returned an invalid biography.');
  }

  return data.bio;
}
