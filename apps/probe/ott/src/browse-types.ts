import type { Category, Film, Kind, ProviderMode } from './catalog-types';
import type { Programme } from './guide-types';

export type BrowseVisual = {
  film?: Film;
  poster?: boolean;
  programme?: Programme;
  channel?: string;
  guide?: boolean;
  feedback?: boolean;
};

export type BrowseProps = {
  grid?: boolean;
  category?: Category;
  onGuide?: (openerKey: string) => void;
  onReady?: (initialKey?: string) => void;
  viewportWidth?: number;
  mode: ProviderMode;
  id: string;
  kind: Kind;
  query?: string;
  active: boolean;
  delay: number;
  failNext: () => boolean;
  onOpen: (film: Film, openerKey: string) => void;
  highContrast: boolean;
  featured?: boolean;
  searchResults?: boolean;
};
