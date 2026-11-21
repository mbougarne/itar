import { occurrenceKey } from 'itar/react';

export const screens = [
  'Home',
  'Movies',
  'Series',
  'Search',
  'My List',
  'Profile',
  'Settings',
] as const;

export type Screen = (typeof screens)[number];

export const subtitles = {
  Home: '',
  Movies: 'Find your next story.',
  Series: 'Stories worth staying with.',
  Search: 'Find a title or genre.',
  'My List': 'Titles saved on this device.',
  Profile: '',
  Settings: 'Make the demo yours.',
};

export const detailTabs = [
  'More like this',
  'Cast & crew',
  'Information',
] as const;

export const detailControlKeys = new Set([
  ...['play', 'list', 'like', 'retry'].map(action =>
    occurrenceKey('details', action),
  ),
  ...detailTabs.map(tab => occurrenceKey('details', 'tab', tab)),
]);
