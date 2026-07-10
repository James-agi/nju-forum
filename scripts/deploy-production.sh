#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-$(pwd)}"
DEPLOY_BRANCH="${DEPLOY_BRANCH:-001-nju-knowledge-p0}"
PM2_APP="${PM2_APP:-njuknow}"
PORT="${PORT:-3000}"
APP_HOST="${APP_HOST:-127.0.0.1}"
HEALTH_PORT="${HEALTH_PORT:-3100}"
RUN_DB_MIGRATIONS="${RUN_DB_MIGRATIONS:-0}"
RELEASES_DIR="${RELEASES_DIR:-$(dirname "${APP_DIR}")}"
SHARED_DIR="${SHARED_DIR:-/var/www/njuknow}"
APP_RUN_USER="${APP_RUN_USER:-njuknowapp}"
APP_RUN_GROUP="${APP_RUN_GROUP:-${APP_RUN_USER}}"
APP_RUN_HOME="${APP_RUN_HOME:-${SHARED_DIR}}"
PM2_HOME_DIR="${PM2_HOME_DIR:-${APP_RUN_HOME}/.pm2}"
LEGACY_ROOT_PM2_CLEANUP="${LEGACY_ROOT_PM2_CLEANUP:-1}"
PROCESS_MANAGER="${PROCESS_MANAGER:-systemd}"
SYSTEMD_SERVICE="${SYSTEMD_SERVICE:-njuknow}"
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
  if [ -n "${APP_RUN_USER}" ]; then
    PM2_SUDO_DETECTED="0"
  elif pm2 describe "${PM2_APP}" >/dev/null 2>&1; then
    PM2_SUDO_DETECTED="0"
  elif sudo -n pm2 describe "${PM2_APP}" >/dev/null 2>&1; then
    PM2_SUDO_DETECTED="1"
  fi
elif [ "${PM2_USE_SUDO}" = "1" ] || [ "${PM2_USE_SUDO}" = "true" ]; then
  PM2_SUDO_DETECTED="1"
fi

root_cmd() {
  if [ "$(id -u)" -eq 0 ]; then
    "$@"
  else
    sudo -n "$@"
  fi
}

app_user_cmd() {
  if [ -z "${APP_RUN_USER}" ]; then
    "$@"
  else
    sudo -n -u "${APP_RUN_USER}" env HOME="${APP_RUN_HOME}" PM2_HOME="${PM2_HOME_DIR}" "$@"
  fi
}

pm2_cmd() {
  if [ -n "${APP_RUN_USER}" ]; then
    app_user_cmd pm2 "$@"
  elif [ "${PM2_SUDO_DETECTED}" = "1" ]; then
    sudo -n pm2 "$@"
  else
    pm2 "$@"
  fi
}

legacy_root_pm2_cmd() {
  root_cmd pm2 "$@"
}

get_legacy_root_pm2_cwd() {
  legacy_root_pm2_cmd jlist | PM2_NAME="${PM2_APP}" node -e 'const fs=require("fs"); const apps=JSON.parse(fs.readFileSync(0,"utf8")); const app=apps.find((p)=>p.name===process.env.PM2_NAME); process.stdout.write(app?.pm2_env?.pm_cwd || "");'
}

legacy_root_pm2_start_app() {
  local cwd="$1"
  root_cmd env PORT="${PORT}" HOSTNAME="${APP_HOST}" pm2 start npm --name "${PM2_APP}" --cwd "${cwd}" -- start
}

systemd_unit_name() {
  case "${SYSTEMD_SERVICE}" in
    *.service) printf "%s" "${SYSTEMD_SERVICE}" ;;
    *) printf "%s.service" "${SYSTEMD_SERVICE}" ;;
  esac
}

get_systemd_cwd() {
  root_cmd systemctl show "$(systemd_unit_name)" -p WorkingDirectory --value 2>/dev/null || true
}

write_systemd_service() {
  local cwd="$1"
  local unit_name
  unit_name="$(systemd_unit_name)"

  if [ -z "${APP_RUN_USER}" ]; then
    echo "ERROR: PROCESS_MANAGER=systemd requires APP_RUN_USER."
    return 1
  fi

  root_cmd tee "/etc/systemd/system/${unit_name}" >/dev/null <<SERVICE
[Unit]
Description=NJU Know Next.js application
After=network-online.target postgresql.service
Wants=network-online.target

[Service]
Type=simple
User=${APP_RUN_USER}
Group=${APP_RUN_GROUP}
WorkingDirectory=${cwd}
Environment=NODE_ENV=production
Environment=PORT=${PORT}
Environment=HOSTNAME=${APP_HOST}
Environment=HOME=${APP_RUN_HOME}
ExecStart=/usr/bin/node scripts/start-standalone.js
Restart=always
RestartSec=5
UMask=0077
NoNewPrivileges=true
PrivateTmp=true
PrivateDevices=true
ProtectSystem=full
ProtectHome=true
ReadWritePaths=${SHARED_DIR} ${cwd} /tmp
CapabilityBoundingSet=
RestrictSUIDSGID=true
RestrictRealtime=true
RestrictNamespaces=true
ProtectClock=true
ProtectHostname=true
ProtectKernelLogs=true
ProtectKernelTunables=true
ProtectKernelModules=true
ProtectControlGroups=true
LockPersonality=true
RestrictAddressFamilies=AF_UNIX AF_INET AF_INET6
SystemCallArchitectures=native

[Install]
WantedBy=multi-user.target
SERVICE
}

systemd_start_app() {
  local cwd="$1"
  local unit_name
  unit_name="$(systemd_unit_name)"

  write_systemd_service "${cwd}" || return 1
  root_cmd systemctl daemon-reload || return 1
  root_cmd systemctl enable "${unit_name}" >/dev/null || return 1
  root_cmd systemctl restart "${unit_name}" || return 1
}

systemd_status_app() {
  root_cmd systemctl --no-pager --lines=20 status "$(systemd_unit_name)"
}

cleanup_legacy_root_pm2() {
  if [ -z "${APP_RUN_USER}" ] || [ "${LEGACY_ROOT_PM2_CLEANUP}" != "1" ]; then
    return
  fi

  if legacy_root_pm2_cmd describe "${PM2_APP}" >/dev/null 2>&1; then
    echo "==> Removing legacy root PM2 app: ${PM2_APP}"
    legacy_root_pm2_cmd delete "${PM2_APP}" >/dev/null 2>&1 || return 1
    legacy_root_pm2_cmd save >/dev/null 2>&1 || return 1
  fi
  return 0
}

pm2_start_app() {
  local cwd="$1"
  if [ -n "${APP_RUN_USER}" ]; then
    app_user_cmd env PORT="${PORT}" HOSTNAME="${APP_HOST}" pm2 start npm --name "${PM2_APP}" --cwd "${cwd}" -- start
  elif [ "${PM2_SUDO_DETECTED}" = "1" ]; then
    sudo -n env PORT="${PORT}" HOSTNAME="${APP_HOST}" pm2 start npm --name "${PM2_APP}" --cwd "${cwd}" -- start
  else
    PORT="${PORT}" HOSTNAME="${APP_HOST}" pm2 start npm --name "${PM2_APP}" --cwd "${cwd}" -- start
  fi
}

prepare_app_runtime_user() {
  if [ -z "${APP_RUN_USER}" ]; then
    return
  fi

  if ! id "${APP_RUN_USER}" >/dev/null 2>&1; then
    echo "ERROR: runtime user does not exist: ${APP_RUN_USER}"
    echo "Create it on the server first, or set APP_RUN_USER= to use the current user."
    exit 1
  fi

  root_cmd mkdir -p "${APP_RUN_HOME}" "${PM2_HOME_DIR}" "${SHARED_DIR}/public" "${SHARED_DIR}/storage"
  root_cmd chown "${APP_RUN_USER}:${APP_RUN_GROUP}" "${APP_RUN_HOME}" "${PM2_HOME_DIR}"
}

prepare_app_writable_paths() {
  if [ -z "${APP_RUN_USER}" ]; then
    return
  fi

  local path_name
  for path_name in \
    "${SHARED_DIR}/public/knowledge-images" \
    "${SHARED_DIR}/public/pdfs" \
    "${SHARED_DIR}/public/forum-images" \
    "${SHARED_DIR}/public/avatars" \
    "${SHARED_DIR}/storage/feedback-materials"; do
    root_cmd mkdir -p "${path_name}"
    root_cmd chown -R "${APP_RUN_USER}:${APP_RUN_GROUP}" "${path_name}"
  done
}

prepare_release_permissions() {
  if [ -z "${APP_RUN_USER}" ]; then
    return
  fi

  root_cmd chown -R "${APP_RUN_USER}:${APP_RUN_GROUP}" "${NEW_APP_DIR}"
  if [ -f "${NEW_APP_DIR}/.env" ]; then
    root_cmd chmod 600 "${NEW_APP_DIR}/.env"
  fi
}

start_smoke_server() {
  local cwd="$1"
  local log_file="$2"

  if [ -n "${APP_RUN_USER}" ]; then
    (
      cd "${cwd}"
      app_user_cmd env PORT="${HEALTH_PORT}" HOSTNAME="127.0.0.1" npm start
    ) >"${log_file}" 2>&1 &
  else
    (
      cd "${cwd}"
      PORT="${HEALTH_PORT}" HOSTNAME="127.0.0.1" npm start
    ) >"${log_file}" 2>&1 &
  fi
  TEMP_PID="$!"
}

prepare_app_runtime_user

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
LEGACY_ROOT_PM2_CWD=""
if [ "${PROCESS_MANAGER}" = "systemd" ]; then
  PM2_CWD="$(get_systemd_cwd)"
elif pm2_cmd describe "${PM2_APP}" >/dev/null 2>&1; then
  PM2_CWD="$(pm2_cmd jlist | PM2_NAME="${PM2_APP}" node -e 'const fs=require("fs"); const apps=JSON.parse(fs.readFileSync(0,"utf8")); const app=apps.find((p)=>p.name===process.env.PM2_NAME); process.stdout.write(app?.pm2_env?.pm_cwd || "");')"
fi
if [ -n "${APP_RUN_USER}" ] && [ "${LEGACY_ROOT_PM2_CLEANUP}" = "1" ] && legacy_root_pm2_cmd describe "${PM2_APP}" >/dev/null 2>&1; then
  LEGACY_ROOT_PM2_CWD="$(get_legacy_root_pm2_cwd)"
fi

TEMP_PID=""
rollback_pm2() {
  if [ -n "${TEMP_PID}" ] && kill -0 "${TEMP_PID}" >/dev/null 2>&1; then
    kill "${TEMP_PID}" >/dev/null 2>&1 || true
  fi

  if [ -n "${PM2_CWD}" ] && [ -d "${PM2_CWD}" ]; then
    if [ "${PROCESS_MANAGER}" = "systemd" ]; then
      echo "==> Rolling systemd service back to ${PM2_CWD}"
      systemd_start_app "${PM2_CWD}" || return 1
    else
      echo "==> Rolling PM2 back to ${PM2_CWD}"
      pm2_cmd delete "${PM2_APP}" >/dev/null 2>&1 || true
      pm2_start_app "${PM2_CWD}" || return 1
      pm2_cmd save || return 1
    fi
    return 0
  fi

  if [ -n "${LEGACY_ROOT_PM2_CWD}" ] && [ -d "${LEGACY_ROOT_PM2_CWD}" ]; then
    echo "==> Rolling legacy root PM2 app back to ${LEGACY_ROOT_PM2_CWD}"
    if [ "${PROCESS_MANAGER}" = "systemd" ]; then
      root_cmd systemctl stop "$(systemd_unit_name)" >/dev/null 2>&1 || true
    fi
    legacy_root_pm2_start_app "${LEGACY_ROOT_PM2_CWD}" || return 1
    legacy_root_pm2_cmd save || return 1
    return 0
  fi

  echo "ERROR: no previous application directory is available for rollback"
  return 1
}

switch_to_new_release() {
  if [ "${PROCESS_MANAGER}" = "systemd" ]; then
    cleanup_legacy_root_pm2 || return 1
    systemd_start_app "${NEW_APP_DIR}" || return 1
    return 0
  fi

  if pm2_cmd describe "${PM2_APP}" >/dev/null 2>&1; then
    pm2_cmd delete "${PM2_APP}" || return 1
  fi
  cleanup_legacy_root_pm2 || return 1
  pm2_start_app "${NEW_APP_DIR}" || return 1
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
safe_link_shared_path "avatars"
safe_link_shared_storage_path "feedback-materials"
prepare_app_writable_paths

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
prepare_release_permissions

echo "==> Smoke testing release on port ${HEALTH_PORT}"
start_smoke_server "${NEW_APP_DIR}" "/tmp/${PM2_APP}-${RELEASE_NAME}.log"
for _ in $(seq 1 30); do
  if curl -fsS "http://127.0.0.1:${HEALTH_PORT}/login" >/dev/null; then
    break
  fi
  sleep 1
done
curl -fsS "http://127.0.0.1:${HEALTH_PORT}/login" >/dev/null
curl -fsS "http://127.0.0.1:${HEALTH_PORT}/knowledge" >/dev/null
finish_temp_server

echo "==> Switching app with ${PROCESS_MANAGER}"
export PORT
export HOSTNAME="${APP_HOST}"
if ! switch_to_new_release; then
  echo "ERROR: failed to start the new release; attempting rollback"
  rollback_pm2 || echo "ERROR: rollback also failed; manual recovery is required"
  cleanup_failed_release
  exit 1
fi

echo "==> Health check"
if ! curl -fsS "http://127.0.0.1:${PORT}/login" >/dev/null; then
  rollback_pm2 || echo "ERROR: rollback failed; manual recovery is required"
  cleanup_failed_release
  exit 1
fi
if ! curl -fsS "http://127.0.0.1:${PORT}/forum" >/dev/null; then
  rollback_pm2 || echo "ERROR: rollback failed; manual recovery is required"
  cleanup_failed_release
  exit 1
fi
if ! curl -fsS "http://127.0.0.1:${PORT}/knowledge" >/dev/null; then
  rollback_pm2 || echo "ERROR: rollback failed; manual recovery is required"
  cleanup_failed_release
  exit 1
fi

if [ "${PROCESS_MANAGER}" = "systemd" ]; then
  systemd_status_app
else
  pm2_cmd save
  pm2_cmd status "${PM2_APP}"
fi

echo "==> Deployment finished"
echo "==> Active release: ${NEW_APP_DIR}"
