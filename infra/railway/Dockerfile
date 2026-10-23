# check=skip=InvalidDefaultArgInFrom
# The Railway `app` service (25-personal-mode.md §1): TanStack Start + the Hono API as one Nitro
# node server. Built by Railway from the repository root (infra/railway/railway.ts), so the build
# needs no Docker of its own: dsp.wasm comes from the same pinned Emscripten image as
# `pnpm --filter @splitune/audio-dsp build` and must match dsp.wasm.sha256.

# packages/audio-dsp/emsdk-version
FROM emscripten/emsdk:6.0.10@sha256:e077d54e2b8970575ebc4f185ac1de0b95c05f2b266134d4ba27449af7aebf65 AS dsp
WORKDIR /src
COPY packages/audio-dsp/CMakeLists.txt packages/audio-dsp/dsp.wasm.sha256 ./
COPY packages/audio-dsp/include ./include
COPY packages/audio-dsp/src ./src
RUN emcmake cmake -S . -B /build -DCMAKE_BUILD_TYPE=Release \
  && cmake --build /build --target dsp_wasm \
  && echo "$(cat dsp.wasm.sha256)  /build/dsp.wasm" | sha256sum -c -

FROM node:24.22.1-bookworm-slim@sha256:55fb5f5a527ea2c5c4a95f963e48ef90aa38c7b346054fdc8ee9957a2b55d205 AS base
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable
WORKDIR /app

# Every workspace manifest, so the frozen lockfile resolves; installs are filtered below.
FROM base AS manifests
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY apps/listening/package.json apps/listening/
COPY apps/node-worker/package.json apps/node-worker/
COPY apps/web/package.json apps/web/
COPY packages/analytics/package.json packages/analytics/
COPY packages/audio-dsp/package.json packages/audio-dsp/
COPY packages/audio-engine/package.json packages/audio-engine/
COPY packages/config/package.json packages/config/
COPY packages/contracts/package.json packages/contracts/
COPY packages/db/package.json packages/db/
COPY packages/music-core/package.json packages/music-core/
COPY packages/notation/package.json packages/notation/
COPY packages/storage/package.json packages/storage/
COPY packages/ui-tokens/package.json packages/ui-tokens/
COPY services/ml/package.json services/ml/

FROM manifests AS build
RUN pnpm install --frozen-lockfile --filter "@splitune/web..."
COPY tsconfig.base.json .browserslistrc ./
COPY apps ./apps
COPY packages ./packages
COPY --from=dsp /build/dsp.wasm packages/audio-dsp/dist/dsp.wasm
RUN pnpm --filter @splitune/web build

# The pre-deploy migration (`node packages/db/scripts/migrate.ts`, what `pnpm db:migrate` runs)
# needs only @splitune/db and its production dependencies.
FROM manifests AS migrate
RUN pnpm install --frozen-lockfile --prod --filter "@splitune/db..."
COPY packages/db ./packages/db
COPY packages/contracts ./packages/contracts

FROM node:24.22.1-bookworm-slim@sha256:55fb5f5a527ea2c5c4a95f963e48ef90aa38c7b346054fdc8ee9957a2b55d205
ENV NODE_ENV=production
WORKDIR /app
COPY --from=migrate --chown=node:node /app ./
COPY --from=build --chown=node:node /app/apps/web/.output ./apps/web/.output
USER node
CMD ["node", "apps/web/.output/server/index.mjs"]
