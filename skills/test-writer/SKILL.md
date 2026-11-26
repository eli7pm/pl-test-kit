---
name: test-writer
description: Generate and run tests for a Pagelove app — fast offline unit tests of its JavaScript Triggers (via a bundled harness that fakes ctx, Pagelove.PUT/POST/DELETE, Schema.search and unique constraints) and Cucumber/Gherkin end-to-end tests against the live host (authz rules, private paths, uniqueness races, per-user isolation, redirects). Use this whenever someone wants tests, a test suite, CI checks, regression protection, e2e, BDD/Cucumber/Gherkin scenarios, or "prove it's secure" for a Pagelove site, its triggers.html, authz.html, schema.html or templates — even if they just say "add tests to my Pagelove app" or "make sure this doesn't break".
---

# Pagelove test writer

Pagelove apps put their logic in HTML: rules in `authz.html`, data models in
`schema.html`, code in `triggers.html`. This skill derives tests from those files
in two layers, because each layer catches what the other can't:

- **Unit:** `scripts/harness.mjs` runs the trigger scripts in Node with in-memory
  data, in milliseconds. It catches logic bugs: validation, ownership checks,
  status codes, escaping.
- **E2E:** Cucumber features run against the real public host. They catch
  platform behaviour the harness doesn't emulate: authorization rules, deny-mode
  GETs, real `unique` enforcement under concurrency, sessions and caching.

## 1. Locate the app

Find the local folder that mirrors the site's paths (the one containing
`system/triggers.html`), the public `BASE_URL`, and the host's
`default-get-authz-mode` (ask, or read it with the `pagelove-dev` skill). If the
site exists only remotely, download it first over WebDAV (see `pagelove-dev`).

## 2. Scaffold `tests/` (next to the site folder)

Copy from this skill's directory:

| From | To |
|---|---|
| `scripts/harness.mjs` | `tests/support/harness.mjs` |
| `templates/package.json` | `tests/package.json` (replace `__APP__`) |
| `templates/cucumber.mjs` | `tests/cucumber.mjs` (replace `__BASE_URL__`) |
| `templates/gitignore` | `tests/.gitignore` (**must** ignore `.auth/`) |
| `templates/features/support/*.mjs` | `tests/features/support/` |

Then run `npm install --save-dev linkedom @cucumber/cucumber` in `tests/`. Use the
`*.example` files as worked examples of the style; don't copy them verbatim.

## 3. Write unit tests from the trigger code

Read every trigger in `triggers.html`. For each one, enumerate every `reply()`
or thrown response, and write at least one test that reaches it. Then add:

- **Identity:** anonymous gets 401 on private endpoints; the identity fallbacks
  (`auth.sub` → `auth.claims.sub` → …) each work; internal IDs never appear in
  responses.
- **Ownership:** two users (`auth: { sub: "a" }`, `{ sub: "b" }`). B can't
  list, update or delete A's records, and gets 404 (not 403) on A's keys.
- **Uniqueness:** a duplicate key gives 409. Also call `site.post()` directly
  with a duplicate to prove the schema's `unique` rule rejects it, and that the
  harness rolled the document back.
- **Input:** a table of hostile values (`javascript:`, `data:`, oversize,
  selector characters like `a,#x`, quotes and `<script>`), and at least one
  **realistic large** valid input. Arbitrary limits are a common bug.
- **Body shapes:** an object, a raw JSON string, and form-encoded data.
- **Headers:** `Cache-Control` on identity-dependent responses, and
  `Location` / `Referrer-Policy` on redirects.

Harness API (for full details, see the header comment in `harness.mjs`):

```js
const site = await loadSite(ROOT, { host: "my-site.onpagelove.com" });  // fresh per test
const res = await site.request({ method, path: "/api/x?k=v", body, rawBody, auth });
res.status; res.json; res.headers; res.body; res.passthrough  // true = no trigger answered
site.items(TYPE); site.search(TYPE, { owner: "a" }); site.doc("/data/x.html");
site.post(html, path, selector, placement); site.put(...); site.del(path, selector);
```

Use `process.env.PAGELOVE_ROOT ?? <default>` for `ROOT`, so the mutation check
below can point the tests at a modified copy.

Run `npm run test:unit`. If a test fails, decide whether **the test or the app**
is wrong before changing either. A real app bug is a finding to report to the
user. Don't weaken the assertion to make it pass.

### Prove the tests bite (mutation check)

Copy the site folder to a scratch directory and make 4–6 one-line sabotages in
the copy's `triggers.html`. Typical ones:
- drop the owner filter from a search;
- remove an ownership check before a delete;
- widen a URL or scheme regex;
- shrink a size limit;
- remove a security header.

Run the suite with `PAGELOVE_ROOT=<copy>/` once per sabotage. Each must fail at
least one test. If one survives, add the missing test. Delete the copy afterwards.

## 4. Write Cucumber features from the rules and the API

- **`access.feature`, generated from `authz.html`:** every public path gets 200
  anonymously. Every private path (data and system documents, plus a made-up
  path when the GET mode is `deny`) gets 401. Every gated API method gets 401.
  Anonymous only, so it's safe to run anytime.
- **`<resource>.feature`, tagged `@session:<name>`:** the signed-in lifecycle
  (create → list → public read → delete → gone), duplicate key → 409, a
  concurrent duplicate (`N times at once`) → exactly one 201, and hostile
  inputs → 400.
- **`isolation.feature`, tagged `@session:alice @session:bob`:** B can't see or
  delete A's records, and public endpoints behave the same for both.

Use only the generic steps in `features/support/steps.mjs`. Add a new step only
when the existing ones can't express the check, and keep it generic. Placeholders:
`{{run}}` (unique `zztest-xxxxxx` per scenario), `{{saved.name}}` (from `I remember
"json.path" as "name"`) and `{{last.json.path}}`.

**Clean up every write.** Register cleanup *before* creating, with
`afterwards I DELETE "/api/...?key={{run}}"`. Cleanups run even when a step
fails. Use `{{run}}` in every key or URL you create, so test data is identifiable
and never collides with real data.

## 5. Run

- `npm run test:unit`: offline, always safe.
- `npx cucumber-js --tags "not @session:alice and not @session:bob"`
  (or simply `npm run test:e2e`, where sessionless runs skip those scenarios):
  read-only against the host.
- **Signed-in scenarios write to the live host.** Before the first run against a
  production host, get the user's go-ahead, and prefer a staging host
  (`BASE_URL=...`). They create and delete only `zztest-` data.

### Sessions (OIDC)

Automated tests must not drive a real identity provider's login page. A person
signs in once per **dedicated test account** and the session is saved:

```bash
npx playwright open --save-storage=.auth/alice.json <BASE_URL>/auth/login
```

Ask the user to run this (it opens a browser). `.auth/*.json` files are live
credentials, so never print, commit or upload them. When a signed-in step gets
an unexpected 401, the world adds a hint saying the session has probably
expired.

## 6. Report

Tell the user:
- the counts for each layer (passed, failed, skipped, and why skipped);
- the mutation-check results (which sabotages were caught);
- any real app bugs found, with file:line references;
- what's still uncovered, and why: usually signed-in E2E waiting on saved
  sessions, plus anything the harness doesn't emulate (authz, gates, shape and
  transition constraints, composition).

## Harness limits (keep this honest)

The harness fakes the platform, and fakes drift. It doesn't emulate:
- authorization rules, trigger gates, shape or transition constraints;
- page composition;
- the exact auth object a host provides, or the exact `ctx.request.body` shape.

When E2E reveals platform behaviour the harness didn't predict, fix the harness
(or the test's assumptions) first, then the app.
