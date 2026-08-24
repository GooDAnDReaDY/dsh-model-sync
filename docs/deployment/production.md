# Production deployment

The only supported deployment entrypoint is deploy.sh from the tested RELEASE
tree. It installs an already-published package through DSH, restarts the selected
service once, verifies the service state, and optionally checks a caller-supplied
health URL.

Run it only after the Gitea PR is merged, staging smoke is complete, the package is
published, and the user has explicitly approved deployment:

    sudo env DSH_DEPLOY_APPROVED=1 DSH_RUNTIME_USER=<dsh-profile-owner> DSH_SERVICE=<dsh-service-unit> DSH_PROFILE=<dsh-profile> DSH_HEALTHCHECK_URL=<health-url> ./deploy.sh @goodandready/dsh-model-sync@<version>

DSH_PNPM_STORE_DIR may be supplied when the target profile uses a non-default pnpm
store. The script never copies files, uses rsync, changes credentials, or writes
secrets. If approval, required variables, or the root boundary is absent, it exits
before touching the profile.
