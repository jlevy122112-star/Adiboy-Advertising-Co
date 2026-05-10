import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const apiEntry = path.join(rootDir, "apps", "api", "dist", "server.js");
const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";

const apiEnv = {
  ...process.env,
  MARKETER_DB_PATH: ":memory:",
  PORT: "4310",
  HOST: "127.0.0.1",
};

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitForApiHealth(maxMs) {
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch("http://127.0.0.1:4310/health");
      if (res.ok) {
        return;
      }
    } catch {
      /* not listening yet */
    }
    await delay(200);
  }
  throw new Error(`API did not become healthy within ${maxMs}ms`);
}

async function waitForViteDev(maxMs) {
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch("http://127.0.0.1:5173/");
      if (res.ok) {
        console.log("[e2e-marketer-webserver] Vite ready at http://127.0.0.1:5173/");
        return;
      }
    } catch {
      /* Vite not listening yet */
    }
    await delay(300);
  }
  throw new Error(`Vite did not respond on 127.0.0.1:5173 within ${maxMs}ms`);
}

const api = spawn(process.execPath, [apiEntry], {
  cwd: rootDir,
  env: apiEnv,
  stdio: "inherit",
});

let web = null;

try {
  await waitForApiHealth(120_000);
} catch (err) {
  console.error("[e2e-marketer-webserver]", err);
  try {
    api.kill("SIGTERM");
  } catch {
    /* ignore */
  }
  process.exit(1);
}

web = spawn(npmCmd, ["run", "dev", "--prefix", "apps/web"], {
  cwd: rootDir,
  env: { ...process.env },
  stdio: "inherit",
  shell: process.platform === "win32",
});

try {
  await waitForViteDev(240_000);
} catch (err) {
  console.error("[e2e-marketer-webserver]", err);
  try {
    api.kill("SIGTERM");
  } catch {
    /* ignore */
  }
  if (web) {
    try {
      web.kill("SIGTERM");
    } catch {
      /* ignore */
    }
  }
  process.exit(1);
}

function shutdown(code) {
  try {
    api.kill("SIGTERM");
  } catch {
    /* ignore */
  }
  if (web) {
    try {
      web.kill("SIGTERM");
    } catch {
      /* ignore */
    }
  }
  process.exit(code);
}

process.on("SIGTERM", () => shutdown(0));
process.on("SIGINT", () => shutdown(0));

web.on("exit", (code) => {
  shutdown(code ?? 1);
});

api.on("exit", (code, signal) => {
  if (signal || (code !== 0 && code !== null)) {
    shutdown(code ?? 1);
  }
});
