import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync, unlinkSync } from "node:fs";
import os from "node:os";
import path from "node:path";

function runViaPs1(command: string): Promise<{ code: number | null; stdout: string; stderr: string; sessionId?: string }> {
  return new Promise((resolve) => {
    const tempDir = path.join(os.tmpdir(), "oc-test");
    mkdirSync(tempDir, { recursive: true });
    const ps1 = path.join(tempDir, `test-${Date.now()}.ps1`);
    writeFileSync(ps1, Buffer.concat([Buffer.from([0xEF, 0xBB, 0xBF]), Buffer.from(command, "utf8")]));

    const child = spawn("powershell.exe", ["-ExecutionPolicy", "Bypass", "-File", ps1], {
      cwd: "D:/nju-forum",
      windowsHide: true,
    });
    child.on("close", () => { try { unlinkSync(ps1); } catch {} });

    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    let sessionId: string | undefined;

    child.stdout.on("data", (chunk) => {
      stdout.push(chunk);
      for (const line of chunk.toString("utf8").split("\n")) {
        try {
          const j = JSON.parse(line.trim());
          if (j.sessionID) sessionId = j.sessionID;
        } catch {}
      }
    });
    child.stderr.on("data", (chunk) => stderr.push(chunk));
    child.on("close", (code) => resolve({
      code,
      stdout: Buffer.concat(stdout).toString("utf8"),
      stderr: Buffer.concat(stderr).toString("utf8"),
      sessionId,
    }));
  });
}

async function main() {
  console.log("=== Stage 1: opencode run --format json ===");
  const r1 = await runViaPs1(
    'opencode run --format json --dangerously-skip-permissions "Say hi, just hi, nothing else"'
  );
  console.log("exit:", r1.code);
  console.log("sessionId:", r1.sessionId);
  console.log("stderr:", r1.stderr.trim());

  if (!r1.sessionId) {
    console.error("FAIL: no sessionId from stage 1");
    process.exit(1);
  }

  console.log("\n=== Stage 2: continue with --session ===");
  const r2 = await runViaPs1(
    `opencode run --format json --dangerously-skip-permissions --session ${r1.sessionId} "What did I say before?"`
  );
  console.log("exit:", r2.code);
  console.log("sessionId:", r2.sessionId);
  console.log("stderr:", r2.stderr.trim());
  console.log("stdout snippet:", r2.stdout.slice(0, 300));
}

main().catch((e) => { console.error(e); process.exit(1); });
