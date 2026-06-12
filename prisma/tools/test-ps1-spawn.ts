import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync, unlinkSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const tempDir = path.join(os.tmpdir(), "oc-test");
mkdirSync(tempDir, { recursive: true });
const ps1 = path.join(tempDir, `test-${Date.now()}.ps1`);
const cmd = 'opencode run --format json --dangerously-skip-permissions "Say hi"';
writeFileSync(ps1, Buffer.concat([Buffer.from([0xEF, 0xBB, 0xBF]), Buffer.from(cmd, "utf8")]));

const child = spawn("powershell.exe", ["-ExecutionPolicy", "Bypass", "-File", ps1], {
  cwd: "D:/nju-forum",
  windowsHide: true,
  stdio: ["ignore", "pipe", "pipe"],
});
child.on("close", () => { try { unlinkSync(ps1); } catch {} });

const stdout: string[] = [];
const stderr: string[] = [];
let sessionId: string | undefined;

child.stdout.on("data", (chunk) => {
  const text = chunk.toString("utf8");
  process.stdout.write("STDOUT: " + text);
  for (const line of text.split("\n")) {
    try {
      const j = JSON.parse(line.trim());
      if (j.sessionID) sessionId = j.sessionID;
    } catch {}
  }
});
child.stderr.on("data", (chunk) => {
  process.stderr.write("STDERR: " + chunk.toString("utf8"));
});
child.on("close", (code) => {
  console.log("EXIT:", code, "sessionId:", sessionId);
  process.exit(code ?? 1);
});

setTimeout(() => {
  console.error("TIMEOUT after 30s");
  child.kill();
  process.exit(1);
}, 30000);
