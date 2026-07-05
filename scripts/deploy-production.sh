#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/njuknow}"
DEPLOY_BRANCH="${DEPLOY_BRANCH:-001-nju-knowledge-p0}"
PM2_APP="${PM2_APP:-njuknow}"

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

echo "==> Applying database migrations"
npx prisma migrate deploy

echo "==> Building Next.js app"
npm run build

echo "==> Restarting PM2 app: ${PM2_APP}"
if pm2 describe "${PM2_APP}" >/dev/null 2>&1; then
  pm2 restart "${PM2_APP}" --update-env
else
  pm2 start npm --name "${PM2_APP}" -- start
fi

pm2 save
pm2 status "${PM2_APP}"

echo "==> Deployment finished"
