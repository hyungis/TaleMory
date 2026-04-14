FROM node:24-alpine AS frontend-builder

WORKDIR /app

RUN corepack enable

COPY app/frontend/package.json app/frontend/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY app/frontend/index.html ./
COPY app/frontend/tsconfig.json app/frontend/tsconfig.app.json app/frontend/tsconfig.node.json app/frontend/vite.config.ts app/frontend/eslint.config.js ./
COPY app/frontend/public ./public
COPY app/frontend/src ./src

ARG VITE_API_BASE_URL=/api
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

RUN pnpm build

FROM nginx:1.29-alpine

COPY deploy/app/nginx/default.conf /etc/nginx/conf.d/default.conf
COPY --from=frontend-builder /app/dist /usr/share/nginx/html

EXPOSE 80
