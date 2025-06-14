# STAGE 1: 의존성 설치 (Dependencies)
FROM node:18-alpine AS deps

WORKDIR /app
COPY package.json ./
RUN npm install --production

# STAGE 2: 클라이언트 빌드 (Client Builder)
FROM node:18-alpine AS client-builder

WORKDIR /app/client
COPY client/package.json ./
RUN npm install --legacy-peer-deps
COPY client/ ./
RUN npm run build

# STAGE 3: 최종 프로덕션 이미지 (Production)
FROM node:18-alpine AS production

ENV NODE_ENV=production
WORKDIR /app

# 백엔드 의존성 복사
COPY --from=deps /app/node_modules ./node_modules

# 빌드된 클라이언트 파일 복사
COPY --from=client-builder /app/client/build ./client/build

# 백엔드 소스코드 복사
COPY . .

EXPOSE 3000
CMD ["npm", "start"] 