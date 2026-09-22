# Contributing

Thank you for your interest in contributing. This document explains the workflow and what to verify before opening a pull request.

How to get the code and run it locally

See the README. It covers installation with --legacy-peer-deps, configuration, how to run the dev server, and how to run the Playwright test suites.

Branch and pull request workflow

Branch from main with a descriptive name. Make your changes in that branch. When ready, push to your fork and open a pull request. The PR will be squash merged into main.

What to verify before opening a PR

Run the linter:

```bash
npm run lint
```

If you changed a Playwright assertion, prove it can fail. Break the thing it watches once and confirm the test goes red. A test that passes without the code it watches is decorative and reduces confidence in the suite.

Test data and Khmer text

If you add test data or a fixture, include Khmer text. The product is taught in Khmer. Test data in ASCII only cannot catch a Khmer bug.

One access token per user

Each user gets one access token at a time. Running a test suite or a curl login while you are signed in to the same account in a browser logs the browser out. Coordinate if you run multiple test suites at once.

Testing

The Playwright suites under e2e/ are the tests we trust. Run them with npm run e2e against a local stack with the APIs on ports 3000 and 3001. The suites cover login, CRUD, authorization, SQL injection, Khmer text and the Expo web build.

## Licensing of contributions

By submitting a contribution you agree that it is licensed under the
AGPL-3.0-only licence of this repository, and you grant Jesse Orndorff a
perpetual, worldwide, non-exclusive, royalty-free licence to use,
reproduce, modify, sublicense and distribute your contribution as part of
this project under any licence, including commercial licences, so the
project can be dual-licensed. You confirm you have the right to grant
this. Sign your commits with `git commit -s` (Developer Certificate of
Origin, https://developercertificate.org/).
