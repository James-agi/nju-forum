#!/usr/bin/env bash
set -euo pipefail

ARTIFACT_PATH="${1:-${ARTIFACT_PATH:-}}"
RELEASES_DIR="${RELEASES_DIR:-/var/www/njuknow-releases}"
SHARED_DIR="${SHARED_DIR:-/var/www/njuknow}"
PM2_APP="${PM2_APP:-njuknow}"
PORT="${PORT:-3000}"
APP_HOST="${APP_HOST:-127.0.0.1}"
APP_RUN_USER="${APP_RUN_USER:-njuknowapp}"
APP_RUN_GROUP="${APP_RUN_GROUP:-${APP_RUN_USER}}"
APP_RUN_HOME="${APP_RUN_HOME:-${SHARED_DIR}}"
PM2_HOME_DIR="${PM2_HOME_DIR:-${APP_RUN_HOME}/.pm2}"
LEGACY_ROOT_PM2_CLEANUP="${LEGACY_ROOT_PM2_CLEANUP:-1}"
PROCESS_MANAGER="${PROCESS_MANAGER:-systemd}"
SYSTEMD_SERVICE="${SYSTEMD_SERVICE:-njuknow}"
HEALTH_PORT="${HEALTH_PORT:-3100}"
RUN_DB_MIGRATIONS="${RUN_DB_MIGRATIONS:-0}"
KEEP_FAILED_RELEASE="${KEEP_FAILED_RELEASE:-1}"
PM2_USE_SUDO="${PM2_USE_SUDO:-auto}"
RELEASE_NAME="${RELEASE_NAME:-$(date +%Y%m%d%H%M%S)-artifact}"
DEPLOY_OWNER="${DEPLOY_OWNER:-${SUDO_USER:-$(id -un)}}"

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

deploy_owner_cmd() {
  if [ "$(id -un)" = "${DEPLOY_OWNER}" ]; then
    "$@"
  elif [ "$(id -u)" -eq 0 ]; then
    sudo -n -u "${DEPLOY_OWNER}" "$@"
  else
    sudo -n -u "${DEPLOY_OWNER}" "$@"
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

  if [ -f "${cwd}/server.js" ] && [ -f "${cwd}/scripts/start-standalone.js" ]; then
    root_cmd env PORT="${PORT}" HOSTNAME="${APP_HOST}" pm2 start node --name "${PM2_APP}" --cwd "${cwd}" -- scripts/start-standalone.js
    return $?
  fi
  if [ -f "${cwd}/package.json" ]; then
    root_cmd env PORT="${PORT}" HOSTNAME="${APP_HOST}" pm2 start npm --name "${PM2_APP}" --cwd "${cwd}" -- start
    return $?
  fi

  echo "ERROR: cannot restore legacy root PM2 app from ${cwd}"
  return 1
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
ProtectSystem=strict
ProtectHome=true
ReadOnlyPaths=${cwd}
ReadWritePaths=-${SHARED_DIR}/public/knowledge-images -${SHARED_DIR}/public/pdfs -${SHARED_DIR}/public/forum-images -${SHARED_DIR}/public/avatars -${SHARED_DIR}/storage/feedback-materials -${SHARED_DIR}/cache/next -${SHARED_DIR}/agent-workflows/card-batch -${SHARED_DIR}/temp-card-vectors.json /tmp
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
ProtectProc=invisible
ProcSubset=pid
LockPersonality=true
RestrictAddressFamilies=AF_UNIX AF_INET AF_INET6
SystemCallArchitectures=native
MemoryHigh=768M
MemoryMax=1G
TasksMax=512
LimitNOFILE=65536

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
    return 0
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

  if [ -f "${cwd}/server.js" ] && [ -f "${cwd}/scripts/start-standalone.js" ]; then
    if [ -n "${APP_RUN_USER}" ]; then
      app_user_cmd env PORT="${PORT}" HOSTNAME="${APP_HOST}" pm2 start node --name "${PM2_APP}" --cwd "${cwd}" -- scripts/start-standalone.js
    elif [ "${PM2_SUDO_DETECTED}" = "1" ]; then
      sudo -n env PORT="${PORT}" HOSTNAME="${APP_HOST}" pm2 start node --name "${PM2_APP}" --cwd "${cwd}" -- scripts/start-standalone.js
    else
      PORT="${PORT}" HOSTNAME="${APP_HOST}" pm2 start node --name "${PM2_APP}" --cwd "${cwd}" -- scripts/start-standalone.js
    fi
    return $?
  fi

  if [ -f "${cwd}/package.json" ]; then
    if [ -n "${APP_RUN_USER}" ]; then
      app_user_cmd env PORT="${PORT}" HOSTNAME="${APP_HOST}" pm2 start npm --name "${PM2_APP}" --cwd "${cwd}" -- start
    elif [ "${PM2_SUDO_DETECTED}" = "1" ]; then
      sudo -n env PORT="${PORT}" HOSTNAME="${APP_HOST}" pm2 start npm --name "${PM2_APP}" --cwd "${cwd}" -- start
    else
      PORT="${PORT}" HOSTNAME="${APP_HOST}" pm2 start npm --name "${PM2_APP}" --cwd "${cwd}" -- start
    fi
    return $?
  fi

  echo "ERROR: cannot start app from ${cwd}"
  return 1
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

  root_cmd mkdir -p "${APP_RUN_HOME}" "${PM2_HOME_DIR}" "${SHARED_DIR}/public" "${SHARED_DIR}/storage" "${SHARED_DIR}/cache" "${SHARED_DIR}/agent-workflows"
  root_cmd chown "root:${APP_RUN_GROUP}" "${APP_RUN_HOME}" "${SHARED_DIR}/public" "${SHARED_DIR}/storage" "${SHARED_DIR}/cache" "${SHARED_DIR}/agent-workflows"
  root_cmd chmod 750 "${APP_RUN_HOME}" "${SHARED_DIR}/public" "${SHARED_DIR}/storage" "${SHARED_DIR}/cache" "${SHARED_DIR}/agent-workflows"
  root_cmd chown "${APP_RUN_USER}:${APP_RUN_GROUP}" "${PM2_HOME_DIR}"
  root_cmd chmod 750 "${PM2_HOME_DIR}"
  if [ -f "${SHARED_DIR}/.env" ]; then
    root_cmd chown "root:${APP_RUN_GROUP}" "${SHARED_DIR}/.env"
    root_cmd chmod 640 "${SHARED_DIR}/.env"
  fi
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
    "${SHARED_DIR}/storage/feedback-materials" \
    "${SHARED_DIR}/cache/next" \
    "${SHARED_DIR}/agent-workflows/card-batch"; do
    root_cmd mkdir -p "${path_name}"
    root_cmd chown -R "${APP_RUN_USER}:${APP_RUN_GROUP}" "${path_name}"
    root_cmd find "${path_name}" -type d -exec chmod 750 {} +
    root_cmd find "${path_name}" -type f -exec chmod 640 {} +
  done

  root_cmd touch "${SHARED_DIR}/temp-card-vectors.json"
  root_cmd chown "${APP_RUN_USER}:${APP_RUN_GROUP}" "${SHARED_DIR}/temp-card-vectors.json"
  root_cmd chmod 600 "${SHARED_DIR}/temp-card-vectors.json"
}

prepare_release_permissions() {
  if [ -z "${APP_RUN_USER}" ]; then
    return
  fi

  root_cmd chown -R "root:${APP_RUN_GROUP}" "${NEW_APP_DIR}"
  root_cmd chmod -R u=rwX,g=rX,o= "${NEW_APP_DIR}"
  if [ -f "${NEW_APP_DIR}/.env" ]; then
    root_cmd chmod 640 "${NEW_APP_DIR}/.env"
  fi
}

validate_release_symlinks() {
  local link_path target_path resolved_path
  while IFS= read -r -d '' link_path; do
    target_path="$(readlink "${link_path}")"
    case "${target_path}" in
      /*)
        echo "ERROR: artifact contains an absolute symlink: ${link_path}"
        return 1
        ;;
    esac
    resolved_path="$(realpath -m "$(dirname "${link_path}")/${target_path}")"
    case "${resolved_path}" in
      "${NEW_APP_DIR}" | "${NEW_APP_DIR}/"*) ;;
      *)
        echo "ERROR: artifact symlink escapes the release directory: ${link_path}"
        return 1
        ;;
    esac
  done < <(find "${NEW_APP_DIR}" -type l -print0)
}

start_smoke_server() {
  local cwd="$1"
  local log_file="$2"

  if [ -n "${APP_RUN_USER}" ]; then
    (
      cd "${cwd}"
      app_user_cmd env PORT="${HEALTH_PORT}" HOSTNAME="127.0.0.1" node scripts/start-standalone.js
    ) >"${log_file}" 2>&1 &
  else
    (
      cd "${cwd}"
      PORT="${HEALTH_PORT}" HOSTNAME="127.0.0.1" node scripts/start-standalone.js
    ) >"${log_file}" 2>&1 &
  fi
  TEMP_PID="$!"
}

prepare_app_runtime_user

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

ENV_SOURCE="${ENV_SOURCE:-}"
if [ -z "${ENV_SOURCE}" ] && [ -n "${PM2_CWD}" ] && [ -f "${PM2_CWD}/.env" ]; then
  ENV_SOURCE="${PM2_CWD}/.env"
elif [ -z "${ENV_SOURCE}" ] && [ -n "${LEGACY_ROOT_PM2_CWD}" ] && [ -f "${LEGACY_ROOT_PM2_CWD}/.env" ]; then
  ENV_SOURCE="${LEGACY_ROOT_PM2_CWD}/.env"
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

safe_link_shared_runtime_path() {
  local relative_path="$1"
  local shared_path="${SHARED_DIR}/${relative_path}"
  local target_path="${NEW_APP_DIR}/${relative_path}"

  mkdir -p "${shared_path}" "$(dirname "${target_path}")"
  if [ -e "${target_path}" ] || [ -L "${target_path}" ]; then
    case "${target_path}" in
      "${NEW_APP_DIR}/"*) rm -rf "${target_path}" ;;
      *)
        echo "ERROR: refusing to remove unexpected path: ${target_path}"
        exit 1
        ;;
    esac
  fi

  ln -s "${shared_path}" "${target_path}"
}

root_cmd install -d -o "${DEPLOY_OWNER}" -g "$(id -gn "${DEPLOY_OWNER}")" -m 750 "${NEW_APP_DIR}"
deploy_owner_cmd tar --no-same-owner --no-same-permissions -xzf "${ARTIFACT_PATH}" -C "${NEW_APP_DIR}"
validate_release_symlinks || {
  cleanup_failed_release
  exit 1
}

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

root_cmd cp -p "${ENV_SOURCE}" "${NEW_APP_DIR}/.env"
safe_link_shared_path "knowledge-images"
safe_link_shared_path "pdfs"
safe_link_shared_path "forum-images"
safe_link_shared_path "avatars"
safe_link_shared_storage_path "feedback-materials"
safe_link_shared_runtime_path ".next/cache"
safe_link_shared_runtime_path "agent-workflows/card-batch"

ln -s "${SHARED_DIR}/temp-card-vectors.json" "${NEW_APP_DIR}/temp-card-vectors.json"

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

prepare_release_permissions
prepare_app_writable_paths

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
if ! switch_to_new_release; then
  echo "ERROR: failed to start the new release; attempting rollback"
  rollback_pm2 || echo "ERROR: rollback also failed; manual recovery is required"
  cleanup_failed_release
  exit 1
fi

echo "==> Health check"
for _ in $(seq 1 30); do
  if curl -fsS "http://127.0.0.1:${PORT}/login" >/dev/null; then
    break
  fi
  sleep 1
done
if ! curl -fsS "http://127.0.0.1:${PORT}/login" >/dev/null; then
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
