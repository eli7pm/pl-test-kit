// Save a signed-in browser session for E2E scenarios tagged @session:<name>.
//   pnpm session alice                 -> .auth/alice.json, against BASE_URL
//   BASE_URL=https://staging... pnpm session alice
// A browser opens on the login page: sign in with the dedicated test account,
// then close the window. The file holds live credentials: never commit or share it.
import { spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import "./cucumber.mjs"; // sets the default BASE_URL

// Same defaults as features/support/world.mjs, which reads these files.
const BASE_URL = (process.env.BASE_URL ?? "").replace(/\/$/, "");
const AUTH_DIR = process.env.AUTH_DIR ?? ".auth";

const name = process.argv[2];
if (!name || !/^[\w-]+$/.test(name)) {
  console.error("Usage: pnpm session <name>   (e.g. pnpm session alice)");
  process.exit(1);
}
if (!BASE_URL || BASE_URL.includes("__BASE_URL__")) {
  console.error("Set BASE_URL in cucumber.mjs or the environment.");
  process.exit(1);
}

mkdirSync(AUTH_DIR, { recursive: true });
const file = `${AUTH_DIR}/${name}.json`;
const { status } = spawnSync(
  "pnpm",
  ["dlx", "playwright", "open", `--save-storage=${file}`, `${BASE_URL}/auth/login`],
  { stdio: "inherit", shell: process.platform === "win32" },
);
if (status === 0) console.log(`Saved session to ${file}`);
process.exit(status ?? 1);
