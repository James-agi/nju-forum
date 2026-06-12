import { spawn, type ChildProcess } from "node:child_process";
import { connect } from "node:net";

let state: {
  process: ChildProcess | null;
  port: number;
  ready: boolean;
} = {
  process: null,
  port: 0,
  ready: false,
};

function getRandomPort(): number {
  return Math.floor(Math.random() * (65535 - 1024) + 1024);
}

function waitForPort(port: number, timeoutMs = 30_000): Promise<void> {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tryConnect = () => {
      const socket = connect({ port, host: "127.0.0.1" }, () => {
        socket.destroy();
        resolve();
      });
      socket.on("error", () => {
        socket.destroy();
        if (Date.now() - start > timeoutMs) {
          reject(
            new Error(`OpenCode server on port ${port} did not start within ${timeoutMs}ms`),
          );
        } else {
          setTimeout(tryConnect, 200);
        }
      });
    };
    tryConnect();
  });
}

export async function ensureServer(port?: number): Promise<number> {
  if (state.ready && state.process && !state.process.killed) {
    return state.port;
  }

  const actualPort = port && port > 0 ? port : getRandomPort();

  // If a server is already listening on the target port, reuse it
  // instead of spawning a new one (which would fail with EADDRINUSE).
  try {
    await waitForPort(actualPort, 2_000);
    state.port = actualPort;
    state.ready = true;
    state.process = null; // externally managed process
    return actualPort;
  } catch {
    /* no server on this port, spawn one */
  }

  if (state.process) {
    try {
      state.process.kill();
    } catch {
      /* already dead */
    }
  }

  const opencodeBin =
    process.platform === "win32" ? "opencode.cmd" : "opencode";
  // Use shell on Windows so .cmd files are resolved through PATH
  const child = spawn(
    `${opencodeBin} serve --port ${actualPort}`,
    [],
    {
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
      shell: process.platform === "win32",
    },
  );

  state.process = child;
  state.port = actualPort;
  state.ready = false;

  child.stderr?.on("data", () => {
    /* discard stderr, opencode logs here */
  });

  child.stdout?.on("data", () => {
    /* discard stdout */
  });

  child.on("exit", () => {
    if (state.process === child) {
      state.ready = false;
      state.process = null;
    }
  });

  await waitForPort(actualPort);
  state.ready = true;
  return actualPort;
}

export async function shutdown(): Promise<void> {
  if (state.process && !state.process.killed) {
    state.process.kill();
    state.process = null;
    state.ready = false;
  }
}

export async function getServerPort(): Promise<number> {
  return ensureServer();
}

export interface CreateSessionOptions {
  parentID?: string;
  title?: string;
}

export async function createSession(
  options?: CreateSessionOptions,
): Promise<{ id: string; [key: string]: unknown }> {
  const port = state.port;
  if (!state.ready || !port) throw new Error("OpenCode server not ready");

  const body: Record<string, string> = {};
  if (options?.parentID) body.parentID = options.parentID;
  if (options?.title) body.title = options.title;

  const res = await fetch(`http://127.0.0.1:${port}/session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) {
    throw new Error(`Failed to create session: ${res.status} ${await res.text()}`);
  }

  return res.json();
}

export interface SendMessageInput {
  model?: { providerID: string; modelID: string };
  agent?: string;
  system?: string;
  noReply?: boolean;
  variant?: string;
  parts: Array<{ type: "text"; text: string }>;
}

export interface SendMessageResult {
  info: {
    id: string;
    sessionID: string;
    role: string;
    finish: string;
    modelID: string;
    providerID: string;
    tokens: { input: number; output: number; reasoning: number };
  };
  parts: Array<{
    id: string;
    type: string;
    text?: string;
  }>;
}

export async function sendMessage(
  sessionId: string,
  input: SendMessageInput,
): Promise<SendMessageResult> {
  const port = state.port;
  if (!state.ready || !port) throw new Error("OpenCode server not ready");

  const res = await fetch(`http://127.0.0.1:${port}/session/${sessionId}/message`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    signal: AbortSignal.timeout(600_000),
  });

  if (!res.ok) {
    throw new Error(`Failed to send message: ${res.status} ${await res.text()}`);
  }

  return res.json();
}

// Cleanup on process exit
if (typeof process !== "undefined") {
  const cleanup = () => {
    if (state.process && !state.process.killed) {
      try {
        state.process.kill();
      } catch {
        /* best effort */
      }
    }
  };
  process.on("exit", cleanup);
  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);
}
