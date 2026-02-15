import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

function parseEnvFile(raw) {
  const env = {};
  const lines = raw.split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const normalized = trimmed.startsWith("export ")
      ? trimmed.slice("export ".length)
      : trimmed;

    const eqIndex = normalized.indexOf("=");
    if (eqIndex === -1) continue;

    const key = normalized.slice(0, eqIndex).trim();
    if (!key) continue;

    let value = normalized.slice(eqIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    env[key] = value;
  }

  return env;
}

const [, , envFileArg, ...commandParts] = process.argv;

if (!envFileArg || commandParts.length === 0) {
  console.error(
    "Usage: node scripts/run-with-env.mjs <env-file> <command> [args...]",
  );
  process.exit(1);
}

const envFile = path.resolve(process.cwd(), envFileArg);
if (!fs.existsSync(envFile)) {
  console.error(`Env file not found: ${envFile}`);
  process.exit(1);
}

const fileContent = fs.readFileSync(envFile, "utf8");
const parsed = parseEnvFile(fileContent);
const [command, ...args] = commandParts;

const childEnv = {
  ...process.env,
  ...parsed,
  ENV_FILE: envFile,
};

function quoteWindowsArg(value) {
  if (!/[ \t"]/u.test(value)) return value;
  return `"${value.replace(/"/g, '\\"')}"`;
}

const child =
  process.platform === "win32"
    ? spawn([command, ...args].map(quoteWindowsArg).join(" "), {
        stdio: "inherit",
        shell: true,
        env: childEnv,
      })
    : spawn(command, args, {
        stdio: "inherit",
        shell: false,
        env: childEnv,
      });

child.on("error", (error) => {
  console.error(error.message);
  process.exit(1);
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
