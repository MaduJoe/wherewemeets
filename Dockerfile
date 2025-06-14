# STAGE 1: 의존성 설치 (Dependencies)
# 안정성을 위해 slim 이미지 사용
FROM node:18-slim AS deps

WORKDIR /app
COPY package.json ./
RUN npm install --production

# STAGE 2: 클라이언트 빌드 (Client Builder)
# 안정성을 위해 slim 이미지 사용
FROM node:18-slim AS client-builder

# ===================================================================
# 💡 빌드 실패를 해결하는 핵심 설정
# ===================================================================
# 1. CI 환경에서 경고를 오류로 처리하는 것을 방지
ENV CI=false
# 2. 소스맵 생성을 비활성화하여 메모리 사용량 대폭 감소
ENV GENERATE_SOURCEMAP=false
# 3. 빌드 프로세스에 더 많은 메모리 할당 (4GB)
ENV NODE_OPTIONS="--max-old-space-size=4096"
# ===================================================================

WORKDIR /app/client
COPY client/package.json ./
RUN npm install --legacy-peer-deps
COPY client/ ./
RUN npm run build

# STAGE 3: 최종 프로덕션 이미지 (Production)
# 최종 이미지는 가벼운 alpine 사용
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