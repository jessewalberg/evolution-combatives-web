#!/usr/bin/env bash
# Generate visual regression baselines inside the official Playwright Linux image.
# Never commit baselines produced on macOS hosts.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
cd "$ROOT"

if [[ ! -f .env.test.local ]]; then
  echo "Missing .env.test.local - populate it from 1Password first (see e2e/README.md)." >&2
  exit 1
fi

if ! command -v pnpm >/dev/null 2>&1; then
  echo "pnpm is required on the host to resolve the Playwright version." >&2
  exit 1
fi

PW_VERSION="$(pnpm exec playwright --version | awk '{print $2}')"
if [[ -z "${PW_VERSION}" ]]; then
  echo "Could not resolve Playwright version via pnpm exec playwright --version." >&2
  exit 1
fi

IMAGE="mcr.microsoft.com/playwright:v${PW_VERSION}-jammy"
echo "Using Playwright Docker image: ${IMAGE}"

if docker image inspect "${IMAGE}" >/dev/null 2>&1; then
  echo "Image already present locally - skipping pull."
else
  if ! docker pull "${IMAGE}"; then
    IMAGE="mcr.microsoft.com/playwright:v${PW_VERSION}-noble"
    echo "Jammy tag missing; trying ${IMAGE}"
    docker pull "${IMAGE}"
  fi
fi

# Isolate node_modules in a named Docker volume rather than the live bind-mount.
# The repo directory is bind-mounted read-write for source + committed snapshot
# output, but /work/node_modules is backed by a separate named volume so the
# container's Linux-targeted `pnpm install` NEVER overwrites the host's
# macOS node_modules (which would break local tsc/eslint/playwright until the
# host re-runs `pnpm install`). The named volume persists across runs to speed
# up repeat baseline updates; delete it with
# `docker volume rm evolution-combatives-visual-node-modules` to force a clean install.
NODE_MODULES_VOLUME="evolution-combatives-visual-node-modules"
docker volume create "${NODE_MODULES_VOLUME}" >/dev/null

# NODE_ENV from .env.test.local must not be production during pnpm install
# (would skip @playwright/test). Override after --env-file so install keeps
# devDependencies; playwright.config webServer.env still sets production for
# the app server process itself.
docker run --rm \
  --ipc=host \
  -v "${ROOT}:/work" \
  -v "${NODE_MODULES_VOLUME}:/work/node_modules" \
  -w /work \
  --env-file .env.test.local \
  -e CI=true \
  -e NODE_ENV= \
  -e NEXT_PUBLIC_APP_URL=http://127.0.0.1:3000 \
  "${IMAGE}" \
  /bin/bash -lc '
    set -euo pipefail
    unset NODE_ENV
    corepack enable
    corepack prepare pnpm@9.15.0 --activate
    pnpm install --frozen-lockfile
    pnpm exec playwright install chromium --with-deps
    pnpm exec playwright test --grep @visual --update-snapshots --retries=0
  '

echo "Baselines updated under e2e/visual/**/*-snapshots/. Review and commit on Linux-generated PNGs only."
