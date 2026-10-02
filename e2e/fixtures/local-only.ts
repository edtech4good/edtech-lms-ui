import { test } from '@playwright/test';
import { API_URL } from './env';
import { isLocalHost } from './local-fixture-user';

/**
 * Skip the enclosing spec (or describe) unless the API is on this machine. For specs
 * that create staff accounts with a password that is written in this public repository:
 * if their teardown failed on a real server, those accounts would stay enabled there,
 * with a login anyone can read. Call it at the top of a file, or inside a describe.
 *
 * `what` says what the spec makes; it ends up in the skip reason.
 */
export function skipUnlessLocalApi(what: string): void {
  test.skip(!isLocalHost(API_URL), `${what}, with passwords written in this repository: only on a local API (E2E_API_URL is ${API_URL})`);
}
