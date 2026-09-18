# Multi-stage production Dockerfile
FROM node:22-bookworm-slim AS build

WORKDIR /app

# Install native compilation tools for node-gyp (better-sqlite3)
RUN apt-get update && apt-get install -y python3 make g++ python-is-python3 && rm -rf /var/lib/apt/lists/*

# Prevent external headless browser downloads and enforce legacy peer dependency resolution
ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV npm_config_legacy_peer_deps=true

COPY package.json package-lock.json* ./
RUN npm install --legacy-peer-deps --no-audit

COPY . .
RUN npm run build
RUN npm prune --omit=dev --legacy-peer-deps --no-audit

FROM node:22-bookworm-slim AS production

WORKDIR /app

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/public ./public
COPY --from=build /app/db.json* ./

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["node", "dist/server.cjs"]
