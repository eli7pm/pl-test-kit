// BASE_URL defaults to the app's host; override for staging.
process.env.BASE_URL ??= "__BASE_URL__";

export default {
  paths: ["features/**/*.feature"],
  import: ["features/support/**/*.mjs"],
  format: ["progress-bar", "summary"],
  // Network calls to a real host: give each step room.
  parallel: 0,
};
