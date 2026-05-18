# ──────────────────────────────────────────────────────────
# Ranobe Viewer — сайт для чтения (Solid.js + Vite, статика)
# ──────────────────────────────────────────────────────────

FROM oven/bun:1-alpine AS build
WORKDIR /app

ARG VITE_BACKEND_URL=http://localhost:8080
ENV VITE_BACKEND_URL=$VITE_BACKEND_URL

COPY package.json ./
RUN bun install

COPY . .
RUN bun run build

# ── Production (static-web-server) ─────────────────────
FROM joseluisq/static-web-server:2-alpine

ENV SERVER_PORT=80
ENV SERVER_ROOT=/public
ENV SERVER_FALLBACK_PAGE=/public/index.html
ENV SERVER_ERROR_PAGE_404=/public/index.html
ENV SERVER_REDIRECT_TRAILING_SLASH=false

COPY --from=build /app/dist /public

EXPOSE 80
