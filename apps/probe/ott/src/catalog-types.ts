export type DataSource = 'simulated-local' | 'tmdb' | 'tmdb-mock';

export type CastMember = Readonly<{
  id: string;
  name: string;
  role: string;
  bio?: string;
  portraitUrl?: string | null;
}>;

export type Kind = 'all' | 'movie' | 'series';

export const categories = [
  'All',
  'Action',
  'Comedy',
  'Drama',
  'Documentary',
  'Sci-fi',
] as const;

export type Category = (typeof categories)[number];

export type Film = Readonly<{
  id: string;
  title: string;
  category: string;
  year: number;
  rating?: number;
  votes?: number;
  runtime?: number;
  certification?: string;
  certificationRegion?: string;
  tagline?: string;
  status?: string;
  languages?: string;
  countries?: string;
  studios?: string;
  seasons?: number;
  episodes?: number;
  kind: 'movie' | 'series';
  synopsis: string;
  art: number;
  source?: 'tmdb' | 'tmdb-mock';
  posterUrl?: string | null;
  backdropUrl?: string | null;
}>;

export type Rail = Readonly<{
  id: string;
  title: string;
  format: 'landscape' | 'poster';
  entries: readonly Film[];
}>;

export type Page = Readonly<{
  rows: readonly Rail[];
  nextCursor: string | null;
  source: DataSource;
  attribution?: string;
}>;

export type CatalogueState = Readonly<{
  rows: readonly Rail[];
  cursor: string | null;
  loading: boolean;
  error: string;
  ended: boolean;
  source: DataSource | null;
  limitReached: boolean;
}>;

export type ProviderMode = 'proxy' | 'fixture';
