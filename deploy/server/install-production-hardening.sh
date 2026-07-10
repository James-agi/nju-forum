#!/usr/bin/env bash
set -Eeuo pipefail

SOURCE_DIR="${1:-}"
DEPLOY_PUBLIC_KEY="${2:-}"
DEPLOY_USER="${DEPLOY_USER:-njuknowdeploy}"
BACKUP_ROOT="${BACKUP_ROOT:-/var/backups/njuknow}"

if [ "$(id -u)" -ne 0 ]; then
  echo "ERROR: run this installer as root."
  exit 1
fi

if [ -z "${SOURCE_DIR}" ] || [ -z "${DEPLOY_PUBLIC_KEY}" ]; then
  echo "Usage: install-production-hardening.sh /tmp/staging /tmp/deploy-key.pub"
  exit 1
fi

SOURCE_DIR="$(realpath -e -- "${SOURCE_DIR}")"
DEPLOY_PUBLIC_KEY="$(realpath -e -- "${DEPLOY_PUBLIC_KEY}")"

case "${SOURCE_DIR}" in
  /tmp/njuknow-hardening-*) ;;
  *)
    echo "ERROR: staging directory must be under /tmp/njuknow-hardening-*"
    exit 1
    ;;
esac

case "${DEPLOY_PUBLIC_KEY}" in
  "${SOURCE_DIR}"/*) ;;
  *)
    echo "ERROR: deploy public key must be inside the staging directory."
    exit 1
    ;;
esac

required_files=(
  "deploy-artifact-production.sh"
  "njuknow-deploy"
  "njuknow-deploy.sudoers"
  "99-njuknow-hardening.conf"
  "default"
  "njuknow"
  "njuknow-proxy-params.conf"
  "njuknow-security.conf"
  "njuknow-security-headers.conf"
)

for file_name in "${required_files[@]}"; do
  candidate="${SOURCE_DIR}/${file_name}"
  if [ ! -f "${candidate}" ] || [ -L "${candidate}" ]; then
    echo "ERROR: missing or unsafe staging file: ${candidate}"
    exit 1
  fi
done

bash -n "${SOURCE_DIR}/deploy-artifact-production.sh"
bash -n "${SOURCE_DIR}/njuknow-deploy"
ssh-keygen -lf "${DEPLOY_PUBLIC_KEY}" >/dev/null

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
backup_dir="${BACKUP_ROOT}/${timestamp}"
install -d -o root -g root -m 700 "${backup_dir}"

backup_target() {
  local target="$1"
  local relative="${target#/}"
  local destination="${backup_dir}/${relative}"

  install -d -o root -g root -m 700 "$(dirname "${destination}")"
  if [ -e "${target}" ] || [ -L "${target}" ]; then
    cp -a -- "${target}" "${destination}"
  else
    touch "${destination}.absent"
  fi
}

restore_target() {
  local target="$1"
  local relative="${target#/}"
  local source="${backup_dir}/${relative}"

  rm -f -- "${target}"
  if [ -e "${source}" ] || [ -L "${source}" ]; then
    install -d -o root -g root -m 755 "$(dirname "${target}")"
    cp -a -- "${source}" "${target}"
  fi
}

nginx_targets=(
  "/etc/nginx/sites-available/default"
  "/etc/nginx/sites-available/njuknow"
  "/etc/nginx/sites-enabled/default"
  "/etc/nginx/sites-enabled/njuknow"
  "/etc/nginx/snippets/njuknow-proxy-params.conf"
  "/etc/nginx/snippets/njuknow-security-headers.conf"
  "/etc/nginx/conf.d/njuknow-security.conf"
)

other_targets=(
  "/usr/local/lib/njuknow/deploy-artifact-production.sh"
  "/usr/local/sbin/njuknow-deploy"
  "/etc/sudoers.d/njuknow-deploy"
  "/etc/ssh/sshd_config.d/99-njuknow-hardening.conf"
)

for target in "${nginx_targets[@]}" "${other_targets[@]}"; do
  backup_target "${target}"
done

if ! id "${DEPLOY_USER}" >/dev/null 2>&1; then
  useradd --create-home --shell /bin/bash "${DEPLOY_USER}"
fi
passwd -l "${DEPLOY_USER}" >/dev/null

deploy_home="$(getent passwd "${DEPLOY_USER}" | cut -d: -f6)"
deploy_group="$(id -gn "${DEPLOY_USER}")"
install -d -o "${DEPLOY_USER}" -g "${deploy_group}" -m 700 "${deploy_home}/.ssh"

public_key="$(tr -d '\r\n' < "${DEPLOY_PUBLIC_KEY}")"
case "${public_key}" in
  ssh-ed25519\ *) ;;
  *)
    echo "ERROR: deployment key must be ED25519."
    exit 1
    ;;
esac

printf 'restrict %s\n' "${public_key}" > "${deploy_home}/.ssh/authorized_keys"
chown "${DEPLOY_USER}:${deploy_group}" "${deploy_home}/.ssh/authorized_keys"
chmod 600 "${deploy_home}/.ssh/authorized_keys"

sshd -t -f "${SOURCE_DIR}/99-njuknow-hardening.conf"
ssh_changed=1
rollback_ssh() {
  local exit_code="$?"
  trap - ERR
  if [ "${ssh_changed}" -eq 1 ]; then
    echo "ERROR: SSH update failed; restoring ${backup_dir}."
    restore_target /etc/ssh/sshd_config.d/99-njuknow-hardening.conf
    sshd -t
    systemctl reload ssh
  fi
  exit "${exit_code}"
}
trap rollback_ssh ERR

install -o root -g root -m 644 \
  "${SOURCE_DIR}/99-njuknow-hardening.conf" \
  /etc/ssh/sshd_config.d/99-njuknow-hardening.conf
sshd -t
systemctl reload ssh
systemctl is-active --quiet ssh
ssh_changed=0
trap - ERR

install -d -o root -g root -m 755 /usr/local/lib/njuknow
install -o root -g root -m 755 \
  "${SOURCE_DIR}/deploy-artifact-production.sh" \
  /usr/local/lib/njuknow/deploy-artifact-production.sh
install -o root -g root -m 755 \
  "${SOURCE_DIR}/njuknow-deploy" \
  /usr/local/sbin/njuknow-deploy

visudo -cf "${SOURCE_DIR}/njuknow-deploy.sudoers" >/dev/null
install -o root -g root -m 440 \
  "${SOURCE_DIR}/njuknow-deploy.sudoers" \
  /etc/sudoers.d/njuknow-deploy
visudo -cf /etc/sudoers >/dev/null

nginx_changed=1
rollback_nginx() {
  local exit_code="$?"
  trap - ERR
  if [ "${nginx_changed}" -eq 1 ]; then
    echo "ERROR: Nginx update failed; restoring ${backup_dir}."
    for target in "${nginx_targets[@]}"; do
      restore_target "${target}"
    done
    nginx -t
    systemctl reload nginx
  fi
  exit "${exit_code}"
}
trap rollback_nginx ERR

install -o root -g root -m 644 "${SOURCE_DIR}/default" /etc/nginx/sites-available/default
install -o root -g root -m 644 "${SOURCE_DIR}/njuknow" /etc/nginx/sites-available/njuknow
install -o root -g root -m 644 \
  "${SOURCE_DIR}/njuknow-proxy-params.conf" \
  /etc/nginx/snippets/njuknow-proxy-params.conf
install -o root -g root -m 644 \
  "${SOURCE_DIR}/njuknow-security-headers.conf" \
  /etc/nginx/snippets/njuknow-security-headers.conf
install -o root -g root -m 644 \
  "${SOURCE_DIR}/njuknow-security.conf" \
  /etc/nginx/conf.d/njuknow-security.conf
ln -sfn /etc/nginx/sites-available/default /etc/nginx/sites-enabled/default
ln -sfn /etc/nginx/sites-available/njuknow /etc/nginx/sites-enabled/njuknow

nginx -t
old_workers="$(pgrep -P "$(cat /run/nginx.pid)" | sort -n || true)"
systemctl reload nginx
sleep 1
new_workers="$(pgrep -P "$(cat /run/nginx.pid)" | sort -n || true)"
if [ -z "${new_workers}" ] || [ "${new_workers}" = "${old_workers}" ]; then
  echo "ERROR: Nginx workers did not reload."
  false
fi
nginx_changed=0
trap - ERR

echo "Hardening installation completed."
echo "Backup: ${backup_dir}"
echo "Deploy user: ${DEPLOY_USER}"
