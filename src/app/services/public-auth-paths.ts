/**
 * The pages a signed-out user is meant to see: the sign-in page and the emailed
 * links (reset password, verify email). No imports on purpose, so the e2e suite
 * can test the matching in plain Node (e2e/smoke/public-auth-paths.spec.ts).
 */
export const PUBLIC_AUTH_PATHS = ['/auth/login', '/auth/changepassword', '/auth/verify'];

/** True for each listed path and anything beneath it, not for a longer name that merely starts with it. */
export function isPublicAuthPath(pathname: string): boolean {
  return PUBLIC_AUTH_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'));
}
