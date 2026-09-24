/**
 * Credential validation for the Expo web smoke suite.
 *
 * The automation accounts (demo.sophea / miv.verify) were rotated on 18 Sep
 * 2026. The fallback `demo` password only matches a fresh local seed and will
 * silently fail against UAT with confusing 400 errors. This module guards
 * against that: if the target URL is non-local, the required env vars must be
 * set to avoid a silent, hard-to-debug failure.
 */

/**
 * Returns a list of missing credential environment variables for a given
 * baseURL. If the baseURL host is local (localhost, 127.0.0.1, [::1],
 * 0.0.0.0, or *.localhost), returns an empty array — the `demo` default is
 * correct. Otherwise, lists which env vars must be set from the shell.
 *
 * A var counts as set only if it's a non-empty string. Each account's password
 * can come from its own var or E2E_EXPO_STUDENT_PASS:
 * - Corporate: E2E_EXPO_CORPORATE_PASS or E2E_EXPO_STUDENT_PASS
 * - Kids: E2E_EXPO_KIDS_PASS or E2E_EXPO_STUDENT_PASS
 */
export function missingCredentialVars(
  baseURL: string,
  env: NodeJS.ProcessEnv
): string[] {
  let hostname: string;
  try {
    hostname = new URL(baseURL).hostname;
  } catch {
    // If the URL can't be parsed, treat it as non-local.
    hostname = '';
  }

  // Local hosts that don't require env vars.
  const localHosts = new Set([
    'localhost',
    '127.0.0.1',
    '[::1]',
    '0.0.0.0',
  ]);

  if (localHosts.has(hostname) || hostname.endsWith('.localhost')) {
    return [];
  }

  // Non-local: check that each account has a password set.
  const isSet = (varName: string) => {
    const value = env[varName];
    return typeof value === 'string' && value.length > 0;
  };

  const studentPass = isSet('E2E_EXPO_STUDENT_PASS');
  const missing: string[] = [];

  if (!isSet('E2E_EXPO_CORPORATE_PASS') && !studentPass) {
    missing.push('E2E_EXPO_CORPORATE_PASS (or E2E_EXPO_STUDENT_PASS)');
  }

  if (!isSet('E2E_EXPO_KIDS_PASS') && !studentPass) {
    missing.push('E2E_EXPO_KIDS_PASS (or E2E_EXPO_STUDENT_PASS)');
  }

  return missing;
}
