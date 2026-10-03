/**
 * Path data for the shell's icons. Every icon is drawn on a 24 x 24 grid with a
 * 2px round stroke (see ShellIconComponent). The nav icons are copied verbatim
 * from AdminNav.dc.html (docs/design/admin/handoff-v2); log-out, collapse,
 * expand and classes (the presentation board) are written in the same style.
 */
export const SHELL_ICONS = {
  home: 'M3 10.5 12 3l9 7.5V21h-6v-6H9v6H3z',
  curricula: 'M12 2 2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5',
  questions:
    'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01',
  media: 'M3 3h18v18H3zM10 8l6 4-6 4z',
  assessments:
    'M9 2h6v4H9zM16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2M9 14l2 2 4-4',
  schools: 'M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6',
  // Platform: organisations (AdminNav.dc.html).
  organisations: 'M3 21h18M6 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16M10 8h4M10 12h4M10 16h4',
  // Presentation board: a class.
  classes: 'M2 3h20M21 3v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V3M7 21l5-5 5 5',
  learners:
    'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
  teachers: 'M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M8.5 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM17 11l2 2 4-4',
  reports: 'M3 3v18h18M7 16v-5M12 16V8M17 16v-8',
  administration: 'M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6',
  chevronDown: 'M6 9l6 6 6-6',
  chevronUp: 'M6 15l6-6 6 6',
  chevronsUpDown: 'M7 15l5 5 5-5M7 9l5-5 5 5',
  collapse: 'M3 3h18v18H3zM9 3v18M16 10l-2 2 2 2',
  expand: 'M3 3h18v18H3zM9 3v18M14 10l2 2-2 2',
  globe:
    'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z',
  check: 'M20 6 9 17l-5-5',
  logOut: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
} as const;

export type ShellIconName = keyof typeof SHELL_ICONS;
