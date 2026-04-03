export function loadLocalScriptEnv(projectDir = process.cwd()) {
  // Next already owns the env file loading rules for this repo, so reuse that logic for scripts.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { loadEnvConfig } = require("@next/env") as typeof import("@next/env");
  loadEnvConfig(projectDir);
}
