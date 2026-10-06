# Build context is the repository root (see docker-compose.yml), because this
# is a pnpm workspace: the issuance app depends on sibling packages/* that must
# be present for `pnpm install` to resolve the workspace graph.

FROM node:22-slim AS base
RUN corepack enable
WORKDIR /repo

FROM base AS build
COPY . .
RUN pnpm install --frozen-lockfile
# Generated Prisma client is git-ignored and not produced by `pnpm install`.
RUN pnpm --filter @moraspirit/db exec prisma generate
# predev/prebuild hooks copy these explicitly elsewhere in this repo (see
# apps/issuance/package.json's "test" script) rather than relying on pnpm to
# run custom pre-script hooks, so do the same here.
RUN node packages/certificate-assets/sync.mjs apps/issuance/public/certificate-assets
RUN pnpm --filter issuance build

FROM node:22-slim AS runtime
RUN apt-get update \
    && apt-get install -y --no-install-recommends chromium ca-certificates fonts-liberation \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production \
    CHROMIUM_PATH=/usr/bin/chromium \
    CHROMIUM_NO_SANDBOX=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

WORKDIR /app
COPY --from=build /repo/apps/issuance/.next/standalone ./
COPY --from=build /repo/apps/issuance/.next/static ./apps/issuance/.next/static
COPY --from=build /repo/apps/issuance/public ./apps/issuance/public

EXPOSE 3000
CMD ["node", "apps/issuance/server.js"]
