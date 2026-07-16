/**
 * The seeded local superadmin (`npm run seed:local` in edtech-lms-api).
 * Override for staging via env rather than editing this file.
 */
export const SUPERADMIN = {
  username: process.env.E2E_SUPERADMIN_USER ?? 'superadmin@superadmin.com',
  password: process.env.E2E_SUPERADMIN_PASS ?? 'LocalDev_Superadmin1',
};

/** RBAC role ids, from the RBAC seed. See edtech-lms-api src/models/enums/role.enum.ts. */
export const ROLE = {
  admin: 'zr5ER4QD',
  superadmin: 'Mapyr2Pw',
  user: 'wSRgm8KP',
  teacher: 'Q3Qs7PuD',
  apikey: 'dErM4cvb',
} as const;
