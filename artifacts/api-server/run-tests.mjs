import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const testDir = path.resolve(__dirname, "src/analytics/__tests__");
const files = fs
  .readdirSync(testDir)
  .filter((f) => f.endsWith(".test.ts"))
  .map((f) => path.join("src/analytics/__tests__", f));

const proc = spawn(process.execPath, ["--import", "tsx", "--test", ...files], {
  stdio: "inherit",
  shell: false,
});
proc.on("exit", (code) => process.exit(code ?? 0));
