import { spawn } from "node:child_process";
import { mkdtemp } from "node:fs/promises";
import { createServer } from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

async function availablePort() {
  const probe = createServer();
  await new Promise((resolve, reject) => probe.once("error", reject).listen(0, "127.0.0.1", resolve));
  const { port } = probe.address();
  await new Promise((resolve) => probe.close(resolve));
  return port;
}

const port = await availablePort();
const dataDirectory = await mkdtemp(path.join(os.tmpdir(), "nuzzle-browser-battles-"));
const baseUrl = `http://127.0.0.1:${port}`;
const backend = spawn(process.execPath, ["backend/server.js"], {
  cwd: projectDirectory,
  env: { ...process.env, PORT: String(port), NUZZLE_DATA_DIR: dataDirectory },
  stdio: ["ignore", "pipe", "inherit"],
});

try {
  let ready = false;
  for (let attempt = 0; attempt < 50; attempt++) {
    try {
      const response = await fetch(`${baseUrl}/api/health`);
      if (response.ok) {
        ready = true;
        break;
      }
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  if (!ready) throw new Error("The local test backend did not start.");
  process.env.NUZZLE_BASE_URL = baseUrl;
  await import("./browser.mjs");
} finally {
  backend.kill("SIGTERM");
}
