import {createContext} from 'react';
import type {CollectionStore} from './collections';

export const CollectionContext = createContext<CollectionStore | null>(null);
export const CollectionDatasetContext = createContext('');
export const ScopeContext = createContext<Readonly<{path: readonly string[]; key: string; active: boolean}>>({path: [], key: '', active: true});

export const PaneTargetContext = createContext<string | undefined>(undefined);

export const FocusContentContext = createContext(false);
