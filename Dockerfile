# Multi-stage Dockerfile for Boredgame Discord Activity server
#
# Build stage — install dependencies
FROM node:22-alpine AS builder
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json tsconfig.json vite.config.ts ./
COPY src/ ./src/
COPY sample-project/ ./sample-project/

RUN pnpm install --frozen-lockfile

# ── Production image ──────────────────────────────────────
FROM node:22-alpine
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

ENV NODE_ENV=production
ENV PORT=3001

# Copy only what's needed at runtime
COPY --from=builder /app .

EXPOSE 3001

# Uses tsx (TypeScript executor) — see docs/deployment.md for
# switching to compiled JavaScript for stricter production builds.
CMD ["pnpm", "--filter", "@boredgame/server", "start"]
