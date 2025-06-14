# Node.js 18 사용
FROM node:18-alpine

# 작업 디렉토리 설정
WORKDIR /app

# 시스템 패키지 업데이트
RUN apk add --no-cache git

# 환경변수 설정
ENV NODE_ENV=production
ENV NPM_CONFIG_LEGACY_PEER_DEPS=true
ENV CI=false

# 루트 package.json과 package-lock.json 복사
COPY package*.json ./

# 서버 의존성 설치
RUN npm ci --only=production

# client 디렉토리 생성 및 package.json 복사
COPY client/package*.json ./client/
COPY client/.npmrc ./client/

# 클라이언트 의존성 설치
WORKDIR /app/client
RUN npm install --legacy-peer-deps --no-audit --no-fund

# 전체 소스 코드 복사
WORKDIR /app
COPY . .

# 클라이언트 빌드
WORKDIR /app/client
RUN npm run build

# 작업 디렉토리를 루트로 변경
WORKDIR /app

# 포트 노출
EXPOSE 3000

# 애플리케이션 시작
CMD ["npm", "start"] 