import { spawn, spawnSync } from "node:child_process";

const args = process.argv.slice(2);
const command = process.platform === "win32" ? "wsl.exe" : "docker";
const prefix = process.platform === "win32"
  ? ["-d", "Ubuntu", "--cd", process.cwd(), "--", "docker", "compose"]
  : ["compose"];

if (args[0] === "up") {
  const child = spawn(command, [...prefix, "up"], {
    detached: true,
    stdio: "ignore",
    windowsHide: true,
  });
  child.unref();
  console.log("PostgreSQL is starting in the background.");
  process.exit(0);
}

const result = spawnSync(command, [...prefix, ...args], { stdio: "inherit" });

if (result.error) {
  console.error("Unable to start Docker through Ubuntu WSL:", result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);

