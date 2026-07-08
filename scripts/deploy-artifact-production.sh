#!/usr/bin/env bash
set -euo pipefail

ARTIFACT_PATH="${1:-${ARTIFACT_PATH:-}}"
RELEASES_DIR="${RELEASES_DIR:-/var/www/njuknow-releases}"
SHARED_DIR="${SHARED_DIR:-/var/www/njuknow}"
PM2_APP="${PM2_APP:-njuknow}"
PORT="${PORT:-3000}"
APP_HOST="${APP_HOST:-0.0.0.0}"
HEALTH_PORT="${HEALTH_PORT:-3100}"
RUN_DB_MIGRATIONS="${RUN_DB_MIGRATIONS:-1}"
KEEP_FAILED_RELEASE="${KEEP_FAILED_RELEASE:-1}"
PM2_USE_SUDO="${PM2_USE_SUDO:-auto}"
RELEASE_NAME="${RELEASE_NAME:-$(date +%Y%m%d%H%M%S)-artifact}"

if [ -z "${ARTIFACT_PATH}" ] || [ ! -f "${ARTIFACT_PATH}" ]; then
  echo "ERROR: artifact file is missing."
  echo "Usage: RELEASE_NAME=yyyymmddhhmmss-sha bash scripts/deploy-artifact-production.sh /tmp/njuknow-release.tar.gz"
  exit 1
fi

case "${RELEASE_NAME}" in
  *[!A-Za-z0-9._-]* | "" )
    echo "ERROR: unsafe release name: ${RELEASE_NAME}"
    exit 1
    ;;
esac

NEW_APP_DIR="${RELEASES_DIR}/${RELEASE_NAME}"

echo "==> Artifact: ${ARTIFACT_PATH}"
echo "==> New release: ${NEW_APP_DIR}"

if [ -e "${NEW_APP_DIR}" ]; then
  echo "ERROR: release path already exists: ${NEW_APP_DIR}"
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

  if [ -f "${cwd}/server.js" ] && [ -f "${cwd}/scripts/start-standalone.js" ]; then
    if [ "${PM2_SUDO_DETECTED}" = "1" ]; then
      sudo -n env PORT="${PORT}" HOSTNAME="${APP_HOST}" pm2 start node --name "${PM2_APP}" --cwd "${cwd}" -- scripts/start-standalone.js
    else
      PORT="${PORT}" HOSTNAME="${APP_HOST}" pm2 start node --name "${PM2_APP}" --cwd "${cwd}" -- scripts/start-standalone.js
    fi
    return
  fi

  if [ -f "${cwd}/package.json" ]; then
    if [ "${PM2_SUDO_DETECTED}" = "1" ]; then
      sudo -n env PORT="${PORT}" HOSTNAME="${APP_HOST}" pm2 start npm --name "${PM2_APP}" --cwd "${cwd}" -- start
    else
      PORT="${PORT}" HOSTNAME="${APP_HOST}" pm2 start npm --name "${PM2_APP}" --cwd "${cwd}" -- start
    fi
    return
  fi

  echo "ERROR: cannot start app from ${cwd}"
  exit 1
}

PM2_CWD=""
if pm2_cmd describe "${PM2_APP}" >/dev/null 2>&1; then
  PM2_CWD="$(pm2_cmd jlist | PM2_NAME="${PM2_APP}" node -e 'const fs=require("fs"); const apps=JSON.parse(fs.readFileSync(0,"utf8")); const app=apps.find((p)=>p.name===process.env.PM2_NAME); process.stdout.write(app?.pm2_env?.pm_cwd || "");')"
fi

ENV_SOURCE="${ENV_SOURCE:-}"
if [ -z "${ENV_SOURCE}" ] && [ -n "${PM2_CWD}" ] && [ -f "${PM2_CWD}/.env" ]; then
  ENV_SOURCE="${PM2_CWD}/.env"
elif [ -z "${ENV_SOURCE}" ] && [ -f "${SHARED_DIR}/.env" ]; then
  ENV_SOURCE="${SHARED_DIR}/.env"
fi

if [ -z "${ENV_SOURCE}" ] || [ ! -f "${ENV_SOURCE}" ]; then
  echo "ERROR: production .env was not found."
  echo "Set ENV_SOURCE=/path/to/.env when running this script."
  exit 1
fi

TEMP_PID=""
finish_temp_server() {
  if [ -n "${TEMP_PID}" ] && kill -0 "${TEMP_PID}" >/dev/null 2>&1; then
    kill "${TEMP_PID}" >/dev/null 2>&1 || true
    wait "${TEMP_PID}" >/dev/null 2>&1 || true
  fi
  TEMP_PID=""
}

cleanup_failed_release() {
  finish_temp_server
  if [ "${KEEP_FAILED_RELEASE}" = "0" ] && [ -d "${NEW_APP_DIR}" ]; then
    case "${NEW_APP_DIR}" in
      "${RELEASES_DIR}/"*) rm -rf "${NEW_APP_DIR}" ;;
      *)
        echo "ERROR: refusing to remove unexpected path: ${NEW_APP_DIR}"
        exit 1
        ;;
    esac
  else
    echo "==> Keeping failed release for inspection: ${NEW_APP_DIR}"
  fi
}

rollback_pm2() {
  finish_temp_server
  if [ -n "${PM2_CWD}" ] && [ -d "${PM2_CWD}" ]; then
    echo "==> Rolling PM2 back to ${PM2_CWD}"
    pm2_cmd delete "${PM2_APP}" >/dev/null 2>&1 || true
    pm2_start_app "${PM2_CWD}"
    pm2_cmd save
  fi
}

trap 'finish_temp_server' EXIT

safe_link_shared_path() {
  local name="$1"
  local shared_path="${SHARED_DIR}/public/${name}"
  local target_path="${NEW_APP_DIR}/public/${name}"

  if [ ! -e "${shared_path}" ]; then
    return 0
  fi

  mkdir -p "${NEW_APP_DIR}/public"
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

mkdir -p "${NEW_APP_DIR}"
tar -xzf "${ARTIFACT_PATH}" -C "${NEW_APP_DIR}"

if [ ! -f "${NEW_APP_DIR}/server.js" ]; then
  echo "ERROR: artifact does not contain server.js. Did the build use Next standalone output?"
  cleanup_failed_release
  exit 1
fi

if [ ! -f "${NEW_APP_DIR}/scripts/start-standalone.js" ]; then
  echo "ERROR: artifact does not contain scripts/start-standalone.js."
  cleanup_failed_release
  exit 1
fi

cp -p "${ENV_SOURCE}" "${NEW_APP_DIR}/.env"
safe_link_shared_path "knowledge-images"
safe_link_shared_path "pdfs"
safe_link_shared_path "forum-images"
safe_link_shared_path "avatars"
safe_link_shared_storage_path "feedback-materials"

if [ -e "${SHARED_DIR}/temp-card-vectors.json" ]; then
  ln -s "${SHARED_DIR}/temp-card-vectors.json" "${NEW_APP_DIR}/temp-card-vectors.json"
fi

if [ "${RUN_DB_MIGRATIONS}" = "1" ]; then
  if [ ! -d "${NEW_APP_DIR}/prisma/migrations" ] || [ ! -f "${NEW_APP_DIR}/prisma/schema.prisma" ]; then
    echo "ERROR: artifact does not contain Prisma migrations/schema."
    cleanup_failed_release
    exit 1
  fi

  echo "==> Applying database migrations"
  (
    cd "${NEW_APP_DIR}"
    PRISMA_VERSION="$(node -p 'const pkg=require("./package.json"); ((pkg.dependencies&&pkg.dependencies.prisma)||(pkg.devDependencies&&pkg.devDependencies.prisma)||"").replace(/^[~^]/, "")')"
    npx --yes "prisma@${PRISMA_VERSION}" migrate deploy
  )
else
  echo "==> Skipping database migrations"
fi

echo "==> Smoke testing release on port ${HEALTH_PORT}"
(
  cd "${NEW_APP_DIR}"
  PORT="${HEALTH_PORT}" HOSTNAME="127.0.0.1" node scripts/start-standalone.js
) >"/tmp/${PM2_APP}-${RELEASE_NAME}.log" 2>&1 &
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
if ! curl -fsS "http://127.0.0.1:${PORT}/knowledge" >/dev/null; then
  rollback_pm2
  cleanup_failed_release
  exit 1
fi

pm2_cmd save
pm2_cmd status "${PM2_APP}"

echo "==> Deployment finished"
echo "==> Active release: ${NEW_APP_DIR}"
