# pl-test-kit

A Claude Code plugin that writes and runs tests for [Pagelove](https://pagelove.com) apps.

- **Unit tests**: `skills/test-writer/scripts/harness.mjs` runs the JavaScript
  Triggers in `triggers.html` offline. It fakes `ctx`, `Pagelove.PUT/POST/DELETE`,
  Schema imports with `search()`, and enforces `unique` rules from `schema.html`.
  It uses Node's built-in test runner and needs one dependency, `linkedom`.
- **E2E tests**: Cucumber/Gherkin features with generic HTTP steps, run against
  the live host. They cover access rules, private paths, concurrency, per-user
  isolation and cleanup. Signed-in scenarios reuse saved browser sessions.

## Install

```
/plugin marketplace add eli7pm/pl-test-kit
/plugin install pl-test-kit@pl-test-kit
```

Then ask Claude: "add tests to my Pagelove app".

## Requirements

Node 24+ and [pnpm](https://pnpm.io). For signed-in E2E tests, `pnpm session <name>`
saves a browser session once per test account; it fetches Playwright on demand
through `pnpm dlx`.

## License

[MIT](LICENSE) © Eli Payano
