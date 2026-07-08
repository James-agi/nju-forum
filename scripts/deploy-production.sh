#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-$(pwd)}"
DEPLOY_BRANCH="${DEPLOY_BRANCH:-001-nju-knowledge-p0}"
PM2_APP="${PM2_APP:-njuknow}"
PORT="${PORT:-3000}"
APP_HOST="${APP_HOST:-0.0.0.0}"
HEALTH_PORT="${HEALTH_PORT:-3100}"
RUN_DB_MIGRATIONS="${RUN_DB_MIGRATIONS:-0}"
RELEASES_DIR="${RELEASES_DIR:-$(dirname "${APP_DIR}")}"
SHARED_DIR="${SHARED_DIR:-/var/www/njuknow}"
KEEP_FAILED_RELEASE="${KEEP_FAILED_RELEASE:-1}"
PM2_USE_SUDO="${PM2_USE_SUDO:-auto}"

echo "==> Current app dir: ${APP_DIR}"
echo "==> Releases dir: ${RELEASES_DIR}"
cd "${APP_DIR}"

if [ ! -d ".git" ]; then
  echo "ERROR: ${APP_DIR} is not a Git repository."
  echo "Run this script from the current production Git release, or set APP_DIR."
  exit 1
fi

if [ ! -f ".env" ]; then
  echo "ERROR: .env is missing in ${APP_DIR}."
  echo "Keep production secrets on the server and do not commit them to GitHub."
  exit 1
fi

PM2_SUDO_DETECTED="0"
if [ "${PM2_USE_SUDO}" = "auto" ]; then
  if pm2 describe "${PM2_APP}" >/dev/null 2>&1; then
    PM2_SUDO_DETECTED="0"
  elif sudo -n pm2 describe "${PM2_APP}" >/dev/null 2>&1; then
    PM2_SUDO_DETECTED="1"
  fi
elif [ "${PM2_USE_SUDO}" = "1" ] || [ "${PM2_USE_SUDO}" = "true" ]; then
  PM2_SUDO_DETECTED="1"
fi

pm2_cmd() {
  if [ "${PM2_SUDO_DETECTED}" = "1" ]; then
    sudo -n pm2 "$@"
  else
    pm2 "$@"
  fi
}

pm2_start_app() {
  local cwd="$1"
  if [ "${PM2_SUDO_DETECTED}" = "1" ]; then
    sudo -n env PORT="${PORT}" HOSTNAME="${APP_HOST}" pm2 start npm --name "${PM2_APP}" --cwd "${cwd}" -- start
  else
    PORT="${PORT}" HOSTNAME="${APP_HOST}" pm2 start npm --name "${PM2_APP}" --cwd "${cwd}" -- start
  fi
}

if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
  echo "ERROR: tracked working tree files are not clean. Refusing to deploy."
  git status --short
  exit 1
fi

echo "==> Fetching ${DEPLOY_BRANCH}"
git fetch origin "${DEPLOY_BRANCH}"
TARGET_SHA="$(git rev-parse "origin/${DEPLOY_BRANCH}")"
TARGET_SHORT="$(git rev-parse --short=7 "${TARGET_SHA}")"
RELEASE_NAME="$(date +%Y%m%d%H%M%S)-${TARGET_SHORT}"
NEW_APP_DIR="${RELEASES_DIR}/${RELEASE_NAME}"

if [ -e "${NEW_APP_DIR}" ]; then
  echo "ERROR: release path already exists: ${NEW_APP_DIR}"
  exit 1
fi

PM2_CWD=""
if pm2_cmd describe "${PM2_APP}" >/dev/null 2>&1; then
  PM2_CWD="$(pm2_cmd jlist | PM2_NAME="${PM2_APP}" node -e 'const fs=require("fs"); const apps=JSON.parse(fs.readFileSync(0,"utf8")); const app=apps.find((p)=>p.name===process.env.PM2_NAME); process.stdout.write(app?.pm2_env?.pm_cwd || "");')"
fi

TEMP_PID=""
rollback_pm2() {
  if [ -n "${TEMP_PID}" ] && kill -0 "${TEMP_PID}" >/dev/null 2>&1; then
    kill "${TEMP_PID}" >/dev/null 2>&1 || true
  fi

  if [ -n "${PM2_CWD}" ] && [ -d "${PM2_CWD}" ]; then
    echo "==> Rolling PM2 back to ${PM2_CWD}"
    pm2_cmd delete "${PM2_APP}" >/dev/null 2>&1 || true
    pm2_start_app "${PM2_CWD}"
    pm2_cmd save
  fi
}

finish_temp_server() {
  if [ -n "${TEMP_PID}" ] && kill -0 "${TEMP_PID}" >/dev/null 2>&1; then
    kill "${TEMP_PID}" >/dev/null 2>&1 || true
    wait "${TEMP_PID}" >/dev/null 2>&1 || true
  fi
  TEMP_PID=""
}

safe_link_shared_path() {
  local name="$1"
  local shared_path="${SHARED_DIR}/public/${name}"
  local target_path="${NEW_APP_DIR}/public/${name}"

  if [ ! -e "${shared_path}" ]; then
    return 0
  fi

  if [ -e "${target_path}" ] || [ -L "${target_path}" ]; then
    case "${target_path}" in
      "${NEW_APP_DIR}/public/"*) rm -rf "${target_path}" ;;
      *)
        echo "ERROR: refusing to remove unexpected path: ${target_path}"
        exit 1
        ;;
    esac
  fi

  ln -s "${shared_path}" "${target_path}"
}

safe_link_shared_storage_path() {
  local name="$1"
  local shared_path="${SHARED_DIR}/storage/${name}"
  local target_path="${NEW_APP_DIR}/storage/${name}"

  mkdir -p "${shared_path}"
  mkdir -p "${NEW_APP_DIR}/storage"
  if [ -e "${target_path}" ] || [ -L "${target_path}" ]; then
    case "${target_path}" in
      "${NEW_APP_DIR}/storage/"*) rm -rf "${target_path}" ;;
      *)
        echo "ERROR: refusing to remove unexpected path: ${target_path}"
        exit 1
        ;;
    esac
  fi

  ln -s "${shared_path}" "${target_path}"
}

echo "==> Creating isolated release: ${NEW_APP_DIR}"
git worktree add --detach "${NEW_APP_DIR}" "${TARGET_SHA}"

cleanup_failed_release() {
  if [ "${KEEP_FAILED_RELEASE}" = "0" ]; then
    git worktree remove --force "${NEW_APP_DIR}" >/dev/null 2>&1 || true
  else
    echo "==> Keeping failed release for inspection: ${NEW_APP_DIR}"
  fi
}
trap 'finish_temp_server' EXIT

cp -p "${APP_DIR}/.env" "${NEW_APP_DIR}/.env"
mkdir -p "${NEW_APP_DIR}/public"
safe_link_shared_path "knowledge-images"
safe_link_shared_path "pdfs"
safe_link_shared_path "forum-images"
safe_link_shared_storage_path "feedback-materials"

if [ -e "${SHARED_DIR}/temp-card-vectors.json" ]; then
  ln -s "${SHARED_DIR}/temp-card-vectors.json" "${NEW_APP_DIR}/temp-card-vectors.json"
fi

cd "${NEW_APP_DIR}"

echo "==> Installing dependencies in isolated release"
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

echo "==> Smoke testing release on port ${HEALTH_PORT}"
PORT="${HEALTH_PORT}" HOSTNAME="127.0.0.1" npm start >"/tmp/${PM2_APP}-${RELEASE_NAME}.log" 2>&1 &
TEMP_PID="$!"
for _ in $(seq 1 30); do
  if curl -fsS "http://127.0.0.1:${HEALTH_PORT}/login" >/dev/null; then
    break
  fi
  sleep 1
done
curl -fsS "http://127.0.0.1:${HEALTH_PORT}/login" >/dev/null
curl -fsS "http://127.0.0.1:${HEALTH_PORT}/knowledge" >/dev/null
finish_temp_server

echo "==> Switching PM2 app: ${PM2_APP}"
export PORT
export HOSTNAME="${APP_HOST}"
if pm2_cmd describe "${PM2_APP}" >/dev/null 2>&1; then
  pm2_cmd delete "${PM2_APP}"
fi
pm2_start_app "${NEW_APP_DIR}"

echo "==> Health check"
if ! curl -fsS "http://127.0.0.1:${PORT}/login" >/dev/null; then
  rollback_pm2
  cleanup_failed_release
  exit 1
fi
if ! curl -fsS "http://127.0.0.1:${PORT}/forum" >/dev/null; then
  rollback_pm2
  cleanup_failed_release
  exit 1
fi
if ! curl -fsS "http://127.0.0.1:${PORT}/knowledge" >/dev/null; then
  rollback_pm2
  cleanup_failed_release
  exit 1
fi

pm2_cmd save
pm2_cmd status "${PM2_APP}"

echo "==> Deployment finished"
echo "==> Active release: ${NEW_APP_DIR}"
