import type { APIRequestContext } from '@playwright/test';
import { API_URL } from './env';

/** Hosts a fixed, publicly known test account may be created on. */
const LOCAL_HOSTS = ['localhost', '127.0.0.1', '[::1]'];

/**
 * Is this URL on the developer's own machine? Exact host names only: a name that
 * merely starts with or contains one ("localhost.example.org",
 * "127.0.0.1.example.org") is somebody else's server. An unparseable URL is not local.
 */
export function isLocalHost(url: string): boolean {
  try {
    return LOCAL_HOSTS.includes(new URL(url).hostname.toLowerCase());
  } catch {
    return false;
  }
}

export interface FixtureUser {
  username: string;
  password: string;
  roles: string[];
}

/**
 * Create a staff account whose credentials are in this public repository, unless it
 * is already there. Refuses (throws, before sending anything) on any host that is not
 * local: such an account would be a standing login on a real server.
 */
export async function ensureLocalFixtureUser(
  superadmin: Pick<APIRequestContext, 'post'>,
  user: FixtureUser,
  apiUrl: string = API_URL,
): Promise<void> {
  if (!isLocalHost(apiUrl)) {
    throw new Error(`refusing to create the fixture user ${user.username}: ${apiUrl} is not a local server`);
  }
  const res = await superadmin.post('/user/create', {
    data: {
      lmsusername: user.username,
      lmsuserpasswordhash: user.password,
      lmsuserroles: user.roles,
      countryids: [],
      schoolids: [],
    },
  });
  if (!res.ok()) {
    // Already there from an earlier run is fine; anything else is not.
    const said = JSON.stringify(await res.json().catch(() => ({})));
    if (!said.includes('already registered')) {
      throw new Error(`could not create the fixture user (HTTP ${res.status()}): ${said}`);
    }
  }
}
