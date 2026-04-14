FROM node:24-alpine AS builder

WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY index.html ./
COPY tsconfig.json tsconfig.app.json tsconfig.node.json vite.config.ts eslint.config.js ./
COPY public ./public
COPY src ./src

ARG VITE_API_BASE_URL=http://backend:8080
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

RUN pnpm build

FROM nginx:1.29-alpine

COPY app/frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80
