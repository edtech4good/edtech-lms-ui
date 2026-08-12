/**
 * The seeded local superadmin (`npm run seed:local` in edtech-lms-api).
 * Override for staging via env rather than editing this file.
 */
export const SUPERADMIN = {
  username: process.env.E2E_SUPERADMIN_USER ?? 'superadmin@superadmin.com',
  password: process.env.E2E_SUPERADMIN_PASS ?? 'LocalDev_Superadmin1',
};

/**
 * The seeded local student, used against the rpi (student) API — see
 * edtech-lms-rpi-api's seed. Override for staging via env rather than editing
 * this file.
 */
export const DEMO_STUDENT = {
  username: process.env.E2E_DEMO_STUDENT_USER ?? 'demo.student',
  password: process.env.E2E_DEMO_STUDENT_PASS ?? 'demo',
};

/** RBAC role ids, from the RBAC seed. See edtech-lms-api src/models/enums/role.enum.ts. */
export const ROLE = {
  admin: 'zr5ER4QD',
  superadmin: 'Mapyr2Pw',
  user: 'wSRgm8KP',
  teacher: 'Q3Qs7PuD',
  apikey: 'dErM4cvb',
} as const;
