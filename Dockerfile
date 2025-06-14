# 멀티스테이지 빌드를 위한 Node.js 베이스 이미지
FROM node:18-alpine AS base

# 작업 디렉토리 설정
WORKDIR /app

# 백엔드 의존성 설치
COPY package*.json ./
RUN npm ci --only=production

# 클라이언트 빌드 스테이지
FROM node:18-alpine AS client-build
WORKDIR /app/client

# 클라이언트 의존성 설치
COPY client/package*.json ./
RUN npm ci

# 클라이언트 소스 코드 복사 및 빌드
COPY client/ ./
RUN npm run build

# 프로덕션 스테이지
FROM node:18-alpine AS production
WORKDIR /app

# 백엔드 의존성 복사
COPY --from=base /app/node_modules ./node_modules
COPY package*.json ./

# 백엔드 소스 코드 복사
COPY . .

# 클라이언트 빌드 결과 복사
COPY --from=client-build /app/client/build ./client/build

# 클라이언트 디렉토리에서 불필요한 파일들 제거 (빌드 결과만 유지)
RUN rm -rf ./client/src ./client/public ./client/package*.json ./client/node_modules

# 포트 노출
EXPOSE 3000

# 헬스체크 추가
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# 서버 시작
CMD ["npm", "start"] 