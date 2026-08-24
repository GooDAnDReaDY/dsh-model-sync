#!/usr/bin/env bash
set -Eeuo pipefail

: "${DSH_DEPLOY_APPROVED:?Set DSH_DEPLOY_APPROVED=1 after explicit deploy approval}"
: "${DSH_RUNTIME_USER:?Set DSH_RUNTIME_USER to the DSH profile owner}"
: "${DSH_SERVICE:?Set DSH_SERVICE to the service that must be restarted}"
: "${DSH_PROFILE:?Set DSH_PROFILE to the target DSH profile}"
package="${1:-}"
if [[ -z "$package" ]]; then
  printf 'usage: DSH_DEPLOY_APPROVED=1 DSH_RUNTIME_USER=<user> DSH_SERVICE=<service> DSH_PROFILE=<profile> %s <package>@<version>\n' "$0" >&2
  exit 2
fi
if [[ "${EUID}" -ne 0 ]]; then
  echo "deploy.sh must run as root so the service restart is explicit and auditable" >&2
  exit 2
fi

command -v dsh >/dev/null
command -v runuser >/dev/null
command -v systemctl >/dev/null

plugin_runner=(runuser -u "$DSH_RUNTIME_USER" --)
if [[ -n "${DSH_PNPM_STORE_DIR:-}" ]]; then
  plugin_runner+=(env "PNPM_CONFIG_STORE_DIR=${DSH_PNPM_STORE_DIR}")
fi
"${plugin_runner[@]}" dsh plugin --profile "$DSH_PROFILE" add "$package"
systemctl restart "$DSH_SERVICE"
systemctl is-active --quiet "$DSH_SERVICE"

if [[ -n "${DSH_HEALTHCHECK_URL:-}" ]]; then
  command -v curl >/dev/null
  curl --fail --silent --show-error --max-time "${DSH_HEALTHCHECK_TIMEOUT:-15}" "$DSH_HEALTHCHECK_URL" >/dev/null
fi

echo "Deployed $package to profile $DSH_PROFILE; service $DSH_SERVICE is active."
