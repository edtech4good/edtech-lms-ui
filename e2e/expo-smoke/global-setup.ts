import type { FullConfig } from '@playwright/test';

/**
 * Cold-start resilience for the Expo SDK ladder: the ladder runs this suite
 * against a freshly started `expo start -c` (see docs/testing-and-verification.md
 * on Metro's incremental cache going stale across branch/version switches —
 * a clean start is the ladder's whole point). Metro compiles the web bundle
 * lazily on the first request, and a cold compile of this app has taken well
 * over a minute in practice. Without this, that compile time gets charged
 * against whichever spec happens to run first (a 30s test timeout), which
 * fails for a reason that has nothing to do with the app under test.
 *
 * Poll the baseURL until it answers — or ~120s elapses — before any spec
 * runs, so the compile happens here instead.
 */
export default async function globalSetup(config: FullConfig): Promise<void> {
  const baseURL = config.projects[0]?.use?.baseURL as string | undefined;
  if (!baseURL) return;

  const deadline = Date.now() + 120_000;
  let lastError: unknown;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(baseURL);
      // Any response at all — even a 4xx from the dev server — means Metro
      // has finished compiling and is actually listening; only a network-
      // level failure (connection refused, timeout) means "still cold."
      if (response.status < 500) return;
      lastError = new Error(`${baseURL} responded ${response.status}`);
    } catch (err) {
      lastError = err;
    }
    await new Promise(resolve => setTimeout(resolve, 2_000));
  }

  throw new Error(
    `Expo web at ${baseURL} did not respond within 120s (cold Metro build?). Last error: ${String(lastError)}`,
  );
}
