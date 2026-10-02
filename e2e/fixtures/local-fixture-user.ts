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
  /** The organisation the account belongs to; left out for a platform account (one that holds Super Admin). */
  organisationid?: string;
}

type Api = Pick<APIRequestContext, 'post'> & Partial<Pick<APIRequestContext, 'get' | 'put'>>;

/**
 * Create a staff account whose credentials are in this public repository, unless it
 * is already there, and make sure it is in `user.organisationid`. Refuses (throws,
 * before sending anything) on any host that is not local: such an account would be
 * a standing login on a real server.
 *
 * An account made before organisations existed is already registered but belongs to
 * none, and can no longer sign in; it is moved into the organisation (the platform
 * caller may change an account's organisation).
 */
export async function ensureLocalFixtureUser(
  superadmin: Api,
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
      ...(user.organisationid ? { organisationid: user.organisationid } : {}),
      countryids: [],
      schoolids: [],
    },
  });
  if (res.ok()) return;
  // Already there from an earlier run is fine; anything else is not.
  const said = JSON.stringify(await res.json().catch(() => ({})));
  if (!said.includes('already registered')) {
    throw new Error(`could not create the fixture user (HTTP ${res.status()}): ${said}`);
  }
  if (user.organisationid) await placeInOrganisation(superadmin, user);
}

async function placeInOrganisation(superadmin: Api, user: FixtureUser): Promise<void> {
  if (!superadmin.get || !superadmin.put) throw new Error('placing an existing fixture user needs a full API context');
  const found = await superadmin.post('/user', {
    data: { pageindex: 1, pagesize: 50, filter: [{ key: 'lmsusername', value: user.username }] },
  });
  const rows: Array<{ lmsuserid: string; lmsusername: string; organisationid: string | null }> = (await found.json()).data.data;
  const mine = rows.find((r) => r.lmsusername === user.username);
  if (!mine) throw new Error(`the fixture user ${user.username} is registered but could not be found to place it`);
  if (mine.organisationid === user.organisationid) return;
  const moved = await superadmin.put(`/user/${mine.lmsuserid}`, {
    data: {
      lmsusername: user.username,
      lmsuserroles: user.roles,
      organisationid: user.organisationid,
      countryids: [],
      schoolids: [],
    },
  });
  if (!moved.ok()) {
    throw new Error(`could not move the fixture user into its organisation (HTTP ${moved.status()})`);
  }
}
