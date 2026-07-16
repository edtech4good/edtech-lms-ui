/**
 * Where the suite points. Defaults to the local dev stack described in
 * LOCAL_DEVELOPMENT.md; override to run against staging.
 */
export const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:4200';
export const API_URL = process.env.E2E_API_URL ?? 'http://localhost:3000';
