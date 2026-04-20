# Multi-stage build.
#   Stage 1: React dist 빌드 (node 환경, 결과물만 꺼내옴)
#   Stage 2: nginx 이미지에 Stage 1의 dist를 박아 최종 배포 이미지 생성
# nginx 설정(conf)은 compose에서 volume mount로 주입 (dev/prod 분리용)

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

# --- Stage 2: 배포용 nginx 이미지 ---
FROM nginx:1.29-alpine

COPY --from=frontend-builder /app/dist /usr/share/nginx/html

EXPOSE 80
