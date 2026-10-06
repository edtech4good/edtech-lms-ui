# Working in this repository

The admin web application of an open-source learning platform (Angular,
ng-zorro, Playwright e2e). Staff of several organisations use it against the
central API (edtech-lms-api). **This repository is public.** Read this file
before changing anything.

## What may never be committed here

- Credentials, keys, tokens, real hostnames, or environment files with real
  values (`src/environments/environment.prod.ts` is a template; deployments
  carry their own copy).
- The name of any customer, school, organisation or person, including in e2e
  fixtures, screenshots, comments and commit messages. Invent names.
- Fixed passwords for anything but local test accounts; e2e specs that create
  accounts run only against a local API (`e2e/fixtures/local-only.ts`).
- A description of a server weakness. Findings go to the private tracker.

## How the admin works with organisations

- A platform user acts as an organisation through the switcher in the shell
  (`app-org-switcher`, `OrgContextService`); the acting organisation is in the
  token. Every create of content or people is made as the acting organisation;
  a platform user who is not acting is refused with "Choose an organisation to
  act in". When the acting context changes or drops, a page that makes sense in
  any context reloads its data and any other page goes Home.
- The API answers a row the caller may not see exactly as a missing row (404),
  and lists leave it out. Screens must not assume a 404 means a bug.
- Errors: `src/app/interceptors/error.interceptor.ts` toasts 400, 403, 404,
  429, 500 unless the request opted out (`FIELD_ERRORS_INLINE`,
  `FORBIDDEN_HANDLED`, `NOT_FOUND_HANDLED` in `error-context.ts`). A screen
  that shows its own message opts out so a failure is one message, never two.
- Roles: an Organisation Admin may grant only what it holds; the staff form
  marks roles outside the editor's reach and disables sign-in fields on wider
  accounts. Follow the API's answer; do not duplicate its rules client-side.

## Tests and verification

- Do not run `ng serve` on a shared machine (about 1.9 GB resident). Build once
  (`NODE_OPTIONS=--max-old-space-size=2560 npx ng build --configuration local
  --output-path <dir>`) and serve the folder with a static SPA server.
- Playwright: 1 worker. Assert on the element's exact text, not on a count that
  zero satisfies; for "no toast" read the count once after a fence, since a
  retrying `toHaveCount(0)` passes when the toast fades. **Prove a new
  assertion can fail** by breaking the thing it watches.
- A production build (`npx ng build --configuration production`) must be
  clean; CI runs it.
- Component unit specs (`ng test`) are scaffolding; logic is tested under
  Playwright in plain Node.

## Khmer text

The product is taught in Khmer. Use Khmer in fixtures for anything that shows a
name, and never let a test "tidy" a name's marks.

## Sessions

One token per user: signing in anywhere evicts the previous session. Each spec
signs in with its own fixture account.

## Git

Branch from `origin/main`; `main` is protected (PR + CI). Squash merge; never
delete a branch that is the base of another PR.
