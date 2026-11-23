import { occurrenceKey } from '@bougarnem/itar/react';

export const rails = [
  {
    id: 'rail-a',
    entries: [
      { id: 'entry-1', movie: 'movie-1' },
      { id: 'entry-2', movie: 'movie-2' },
    ],
  },
  {
    id: 'rail-b',
    entries: [
      { id: 'entry-1', movie: 'movie-1' },
      { id: 'entry-2', movie: 'movie-2' },
    ],
  },
];

export const keyFor = (rail: string, entry: string) =>
  occurrenceKey('home', rail, entry);

export const focusStyle = { accentColor: '#ff8800' };
