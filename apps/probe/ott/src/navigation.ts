export const screens = [
  'Home',
  'Movies',
  'Series',
  'Search',
  'Profile',
  'Settings',
] as const;

export type Screen = (typeof screens)[number];

export const subtitles = {
  Home: '',
  Movies: 'Find your next story.',
  Series: 'Stories worth staying with.',
  Search: 'Find a title or genre.',
  Profile: '',
  Settings: 'Make the demo yours.',
};
