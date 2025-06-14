# Node.js 18 이미지 사용
FROM node:18-alpine

# 작업 디렉토리 설정
WORKDIR /app

# package.json과 package-lock.json 복사
COPY package*.json ./

# 서버 의존성 설치
RUN npm ci --only=production

# 클라이언트 디렉토리로 이동하여 의존성 설치 및 빌드
COPY client/package*.json ./client/
WORKDIR /app/client
RUN npm ci --legacy-peer-deps --only=production
RUN npm run build

# 다시 루트 디렉토리로 이동
WORKDIR /app

# 나머지 파일들 복사
COPY . .

# 포트 노출
EXPOSE 5000

# 애플리케이션 시작
CMD ["npm", "start"] 