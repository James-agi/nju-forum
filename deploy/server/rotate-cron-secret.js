"use strict";

const fs = require("fs");
const path = require("path");

const envPath = "/var/www/njuknow/.env";
const secret = fs.readFileSync(0, "utf8").trim();

if (!/^[A-Za-z0-9_-]{64}$/.test(secret)) {
  throw new Error("CRON_SECRET must be a 64-character base64url value");
}

const currentStat = fs.lstatSync(envPath);
if (!currentStat.isFile() || currentStat.isSymbolicLink()) {
  throw new Error(`${envPath} must be a regular file`);
}

const currentLines = fs
  .readFileSync(envPath, "utf8")
  .split(/\r?\n/)
  .filter((line) => !/^\s*(?:export\s+)?CRON_SECRET\s*=/.test(line));

while (currentLines.at(-1) === "") {
  currentLines.pop();
}

const nextContents = `${currentLines.join("\n")}\nCRON_SECRET=${secret}\n`;
const tempPath = `${envPath}.tmp-${process.pid}`;
const mode = currentStat.mode & 0o777;

try {
  const fd = fs.openSync(tempPath, "wx", mode);
  try {
    fs.writeFileSync(fd, nextContents, "utf8");
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }

  fs.chownSync(tempPath, currentStat.uid, currentStat.gid);
  fs.chmodSync(tempPath, mode);
  fs.renameSync(tempPath, envPath);

  const directoryFd = fs.openSync(path.dirname(envPath), "r");
  try {
    fs.fsyncSync(directoryFd);
  } finally {
    fs.closeSync(directoryFd);
  }
} finally {
  if (fs.existsSync(tempPath)) {
    fs.unlinkSync(tempPath);
  }
}

process.stdout.write("CRON_SECRET_UPDATED\n");
