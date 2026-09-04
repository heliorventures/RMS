# syntax=docker/dockerfile:1.7

FROM node:22-bookworm-slim AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY public ./public
COPY scripts ./scripts
RUN npm run build:assets

FROM node:22-bookworm-slim AS deps

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

FROM node:22-bookworm-slim AS runtime

ENV NODE_ENV=production
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json ./
COPY server.js ./server.js
COPY server ./server
COPY public ./public
COPY --from=build /app/public/dist ./public/dist

RUN mkdir -p /app/logs /app/public/uploads \
    && chown -R node:node /app/logs /app/public/uploads

USER node

EXPOSE 3000

CMD ["node", "server.js"]
