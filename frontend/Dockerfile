# ── Stage 1: Build ──────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Vite bakes these into the static JS bundle at build time (not read at
# container runtime), so they must arrive as build args, not environment
# variables on the running container. Each has a safe default matching
# frontend/.env.example so `docker compose build` works with zero setup —
# the app's own JS falls back gracefully (offline session storage) if
# Supabase vars are left blank.
ARG VITE_API_URL=http://127.0.0.1:8000
ARG VITE_SUPABASE_URL=
ARG VITE_SUPABASE_ANON_KEY=
ENV VITE_API_URL=${VITE_API_URL}
ENV VITE_SUPABASE_URL=${VITE_SUPABASE_URL}
ENV VITE_SUPABASE_ANON_KEY=${VITE_SUPABASE_ANON_KEY}

RUN npm run build

# ── Stage 2: Serve ───────────────────────────────────────────────────────────
FROM nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -qO- http://localhost:80/ > /dev/null || exit 1

CMD ["nginx", "-g", "daemon off;"]
