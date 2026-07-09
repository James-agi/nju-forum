const fs = require("fs");
const path = require("path");

function cleanValue(rawValue) {
  let value = rawValue.trim();
  const quote = value[0];

  if ((quote === '"' || quote === "'") && value.endsWith(quote)) {
    value = value.slice(1, -1);
    if (quote === '"') {
      value = value
        .replace(/\\n/g, "\n")
        .replace(/\\r/g, "\r")
        .replace(/\\t/g, "\t")
        .replace(/\\"/g, '"')
        .replace(/\\\\/g, "\\");
    }
    return value;
  }

  const commentIndex = value.search(/\s#/);
  return commentIndex >= 0 ? value.slice(0, commentIndex).trim() : value;
}

function loadDotEnv(envPath) {
  if (!fs.existsSync(envPath)) {
    return;
  }

  const text = fs.readFileSync(envPath, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const body = trimmed.startsWith("export ")
      ? trimmed.slice("export ".length).trim()
      : trimmed;
    const equalsIndex = body.indexOf("=");
    if (equalsIndex <= 0) {
      continue;
    }

    const key = body.slice(0, equalsIndex).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
      continue;
    }

    if (process.env[key] === undefined) {
      process.env[key] = cleanValue(body.slice(equalsIndex + 1));
    }
  }
}

process.env.NODE_ENV = process.env.NODE_ENV || "production";
loadDotEnv(process.env.DOTENV_CONFIG_PATH || "/var/www/njuknow/.env");
loadDotEnv(path.join(process.cwd(), ".env"));

require(path.join(process.cwd(), "server.js"));
