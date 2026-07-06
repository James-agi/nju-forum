#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/njuknow}"
DEPLOY_BRANCH="${DEPLOY_BRANCH:-001-nju-knowledge-p0}"
PM2_APP="${PM2_APP:-njuknow}"
PORT="${PORT:-3000}"
APP_HOST="${APP_HOST:-0.0.0.0}"
RUN_DB_MIGRATIONS="${RUN_DB_MIGRATIONS:-0}"

echo "==> App dir: ${APP_DIR}"
cd "${APP_DIR}"

if [ ! -d ".git" ]; then
  echo "ERROR: ${APP_DIR} is not a Git repository."
  echo "Clone the GitHub repo here first, then run this script."
  exit 1
fi

if [ ! -f ".env" ]; then
  echo "ERROR: .env is missing in ${APP_DIR}."
  echo "Keep production secrets on the server and do not commit them to GitHub."
  exit 1
fi

if [ -n "$(git status --porcelain)" ]; then
  echo "ERROR: working tree is not clean. Refusing to deploy."
  git status --short
  exit 1
fi

echo "==> Fetching ${DEPLOY_BRANCH}"
git fetch origin "${DEPLOY_BRANCH}"

if git show-ref --verify --quiet "refs/heads/${DEPLOY_BRANCH}"; then
  git checkout "${DEPLOY_BRANCH}"
else
  git checkout -b "${DEPLOY_BRANCH}" "origin/${DEPLOY_BRANCH}"
fi

git pull --ff-only origin "${DEPLOY_BRANCH}"

echo "==> Installing dependencies"
npm ci

echo "==> Generating Prisma client"
npx prisma generate

if [ "${RUN_DB_MIGRATIONS}" = "1" ]; then
  echo "==> Applying database migrations"
  npx prisma migrate deploy
else
  echo "==> Skipping database migrations"
  echo "    Set RUN_DB_MIGRATIONS=1 only after checking production migration state."
fi

echo "==> Building Next.js app"
npm run build

echo "==> Restarting PM2 app: ${PM2_APP}"
export PORT
export HOSTNAME="${APP_HOST}"
if pm2 describe "${PM2_APP}" >/dev/null 2>&1; then
  CURRENT_CWD="$(PM2_NAME="${PM2_APP}" pm2 jlist | PM2_NAME="${PM2_APP}" node -e 'const fs=require("fs"); const apps=JSON.parse(fs.readFileSync(0,"utf8")); const app=apps.find((p)=>p.name===process.env.PM2_NAME); process.stdout.write(app?.pm2_env?.pm_cwd || "");')"
  if [ "${CURRENT_CWD}" = "${APP_DIR}" ]; then
    pm2 restart "${PM2_APP}" --update-env
  else
    echo "==> PM2 app points to ${CURRENT_CWD:-unknown}; recreating with cwd ${APP_DIR}"
    pm2 delete "${PM2_APP}"
    pm2 start npm --name "${PM2_APP}" --cwd "${APP_DIR}" -- start
  fi
else
  pm2 start npm --name "${PM2_APP}" --cwd "${APP_DIR}" -- start
fi

pm2 save
pm2 status "${PM2_APP}"

echo "==> Health check"
curl -fsS "http://127.0.0.1:${PORT}/login" >/dev/null
curl -fsS "http://127.0.0.1:${PORT}/forum" >/dev/null
curl -fsS "http://127.0.0.1:${PORT}/knowledge" >/dev/null

echo "==> Deployment finished"
