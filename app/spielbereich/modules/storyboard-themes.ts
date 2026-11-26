/** Werkbank colour schemes (ADR-001). Same structure, four calm base tones; gold always means "reaches the table",
 * silver "only for the SL". The CSS lives in storyboard.module.css (`.board[data-theme=…]`). */
export const storyboardThemes = [
  { id: 'nacht', label: 'Nacht (Standard)', swatch: '#16242a' },
  { id: 'mitternacht', label: 'Mitternacht', swatch: '#141f33' },
  { id: 'graphit', label: 'Graphit', swatch: '#1d1f22' },
  { id: 'bordeaux', label: 'Bordeaux', swatch: '#22171a' },
] as const;
export type StoryboardTheme = typeof storyboardThemes[number]['id'];
