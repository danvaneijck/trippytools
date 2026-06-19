# syntax=docker/dockerfile:1.7
#
# trippytools — Vite/React static SPA (the public Injective toolkit).
#
# Three stages:
#   deps    — install node_modules (+ the native-module toolchain wallet-strategy
#             needs) once, cached on package.json/yarn.lock.
#   builder — bake the VITE_* config into the static bundle via `yarn build`.
#   prod    — nginx-alpine serving the bundle on :80. TLS is terminated upstream
#             by Traefik (see the trippytools service in trippinj_docker_env).
#
# Replaces the Vercel build + vercel.json SPA rewrite (the rewrite now lives in
# nginx.conf as a try_files fallback to /index.html).

FROM node:22-alpine AS deps
WORKDIR /app
# @injectivelabs/wallet-strategy pulls native node modules (usb / node-hid for
# the Ledger transport) whose postinstall runs node-gyp. alpine ships none of the
# toolchain, so add it (+ libusb/eudev headers) to keep --frozen-lockfile from
# failing. The browser bundle never actually reaches those transports.
RUN apk add --no-cache python3 make g++ linux-headers eudev-dev libusb-dev
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile --network-timeout 600000 \
    && yarn cache clean

FROM node:22-alpine AS builder
WORKDIR /app
# Build-time config baked into the static bundle. trippytools is a mainnet-only
# toolkit, so a single env. Vite reads VITE_*-prefixed vars already present in
# the environment (highest priority), so these ENV lines are what the bundle
# ships with; CI overrides via --build-arg. The TG vars default empty (the
# client-side Telegram notify feature self-disables when unset).
ARG VITE_HASURA_URL=https://api.trippyinj.xyz/v1/graphql
ARG VITE_CHOICE_URL=https://api.choice.exchange/v1/graphql
ARG VITE_TG_BOT_TOKEN=
ARG VITE_TG_CHAT_ID=
ENV VITE_HASURA_URL=${VITE_HASURA_URL} \
    VITE_CHOICE_URL=${VITE_CHOICE_URL} \
    VITE_TG_BOT_TOKEN=${VITE_TG_BOT_TOKEN} \
    VITE_TG_CHAT_ID=${VITE_TG_CHAT_ID} \
    NODE_OPTIONS=--max-old-space-size=8192
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN yarn build

FROM nginx:1.27-alpine AS prod
# Pull the latest patched alpine packages at build time — the nginx:alpine tag
# lags Alpine's published CVE fixes between rebuilds.
RUN apk upgrade --no-cache
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget -q -O- http://127.0.0.1/ >/dev/null || exit 1
CMD ["nginx", "-g", "daemon off;"]
