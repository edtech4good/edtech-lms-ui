# EdTech LMS UI

The web app for the LMS: admin, teacher and student screens, plus the reports. It is an Angular 21 app that talks to the central API, [edtech-lms-api](https://github.com/edtech4good/edtech-lms-api). The product is taught in Khmer, so anything you build here has to hold up with Khmer text, not just ASCII.

Stack: Angular 21 (NgModule-based, not standalone), ng-zorro-antd for components, NgRx for state, ngx-charts for charts, Less for styles, FontAwesome for icons. Auth is a JWT from the API, decoded client-side with `@auth0/angular-jwt`. That is a helper library, not the Auth0 service.

For where this project came from, see [HISTORY.md](HISTORY.md).

## How it fits with the other repos

This is the only web front end. The old reporting UI, [edtech-lms-report-ui](https://github.com/edtech4good/edtech-lms-report-ui), was a copy of this repo with nothing extra in it and is archived; the reports live here. Students on tablets and phones use [edtech-expo](https://github.com/edtech4good/edtech-expo), which talks to the classroom API, [edtech-lms-rpi-api](https://github.com/edtech4good/edtech-lms-rpi-api).

This repo also holds the Playwright suites for the whole stack, including the ones that drive the Expo web build. See Testing below.

## What you need

- Node 20 or 22. Angular 21 needs 20.19 or newer. The Docker image still builds on `node:20`, which reached end of life in April 2026, so Node 22 is where this is heading.
- The central API running on port 3000. For the end-to-end tests you also need the classroom API on 3001.

## Running it locally

```bash
npm install --legacy-peer-deps
npm start
```

Open http://localhost:4200. The `--legacy-peer-deps` is needed because `@angular-eslint/schematics` is still on 16 and its peer range does not include the current CLI. It is dev-only tooling and does not affect the build.

`src/environments/environment.ts` is checked in and already points at `http://localhost:3000`, so there is nothing to copy for local work. For another host, edit it or copy `environment.example.ts` over it. The keys named `PAYLOAD_KEY`, `ALG_KEY`, `HASH_KEY` and the `REFRESH_*` set are sessionStorage key names for the three JWT segments. They are not secrets and they do not need to match anything on the API.

The other environment files (`environment.dev.ts`, `environment.staging.ts`, `environment.prod.ts`) hold placeholder hostnames. Fill them in for your deployment. `angular.json` has four build configurations: `production`, `development`, `staging` and `local`. `npm run watch` serves with `local`, which turns optimization off and source maps on.

## Testing

```bash
# Playwright, against a local stack on 4200 / 3000 / 3001
npm run e2e

# Same, with the Playwright UI
npm run e2e:ui

# The Expo web smoke suite, against an Expo web build on 8081
npm run e2e:expo

# Open the last HTML report
npm run e2e:report
```

The suites under `e2e/` are the tests we actually trust:

- `smoke/` covers login, CRUD on the main screens, lazy-loaded modules, question templates and the sync record filter.
- `authorization/` checks role grants and role enforcement, including the baseline curriculum download.
- `security/` runs SQL injection probes against both the central and the classroom API.
- `localization/` checks Khmer text end to end.
- `expo-smoke/` drives the Expo web build: login, lesson video, practice quiz, drill-down, the phone learner path and the offline banner. It has its own config, `playwright.expo.config.ts`, because it targets a different app and account model.

Where the suites point is set with environment variables, all with local defaults: `E2E_BASE_URL` (4200), `E2E_API_URL` (3000), `E2E_RPI_API_URL` (3001), `EXPO_WEB_URL` (8081). The account fixtures default to the superadmin and demo student that the API seed scripts create; override with `E2E_SUPERADMIN_USER`, `E2E_SUPERADMIN_PASS`, `E2E_DEMO_STUDENT_USER` and `E2E_DEMO_STUDENT_PASS`.

Two cautions from experience. The API issues one access token per user, so running a suite or a `curl` login while you are signed in to the same account in a browser logs the browser out. And a test that only uses ASCII data cannot catch a Khmer bug.

`npm test` runs the Karma unit tests via `ng test`. `npm run lint` runs ESLint via `ng lint`.

## Building

```bash
npm run build -- --configuration production
```

Output goes to `dist/`. The `Dockerfile` does the same build inside `node:20` and serves the result with nginx on port 80, using `nginx/nginx.conf`. Pass `--build-arg configuration=staging` to build another configuration.

## Layout

```
src/
├── app/
│   ├── modules/        # One feature module per area: auth, dashboard, lesson,
│   │                   #   question, student, teacher, school, curriculum,
│   │                   #   report, grade, level, subject, ...
│   ├── services/       # API services
│   ├── models/
│   ├── guards/         # Route guards
│   ├── interceptors/   # HTTP interceptors (JWT, errors)
│   └── shared/         # Shared components and the ng-zorro module
├── assets/
└── environments/
e2e/                    # Playwright suites (see Testing)
nginx/                  # Config for the Docker image
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). If you add a Playwright assertion, break the thing it watches once and confirm it goes red. We have had specs that passed happily for a module that did not exist.

## License and support

AGPL-3.0-only, see [LICENSE](LICENSE) and [NOTICE.txt](NOTICE.txt) for the copyright history. In short: you may run, study, change and share this software, and if you run a modified version for others over a network you must offer them your modified source under the same licence. It was MIT-licensed before 22 September 2026; see NOTICE.txt. Questions and bugs go to [GitHub Issues](https://github.com/edtech4good/edtech-lms-ui/issues).
