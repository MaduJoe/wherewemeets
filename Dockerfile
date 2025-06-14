# STAGE 1: 의존성 설치 (Dependencies)
FROM node:18-slim AS deps
WORKDIR /app
COPY package.json ./
RUN npm install --production

# STAGE 2: 클라이언트 빌드 (Client Builder)
FROM node:18-slim AS client-builder
WORKDIR /app/client

# 빌드 프로세스에 메모리 할당
ENV NODE_OPTIONS="--max-old-space-size=4096"

COPY client/package.json ./
RUN npm install --legacy-peer-deps
COPY client/ ./
RUN npm run build

# STAGE 3: 최종 프로덕션 이미지 (Production)
FROM node:18-alpine AS production
WORKDIR /app

ENV NODE_ENV=production

# 백엔드/클라이언트 파일 복사
COPY --from=deps /app/node_modules ./node_modules
COPY --from=client-builder /app/client/build ./client/build
COPY . .

EXPOSE 3000
CMD ["npm", "start"] 