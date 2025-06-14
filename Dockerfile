# Node.js 18 Alpine 사용
FROM node:18-alpine

# 작업 디렉토리를 /src로 설정 (app 충돌 방지)
WORKDIR /src

# package.json 복사 및 백엔드 의존성 설치
COPY package*.json ./
RUN npm install --production

# 클라이언트 의존성 설치 및 빌드
COPY client/package*.json client/.npmrc ./client/
WORKDIR /src/client
RUN npm install --legacy-peer-deps
COPY client/ ./
RUN npm run build

# 전체 소스 복사
WORKDIR /src
COPY . .

# 포트 노출
EXPOSE 3000

# 서버 시작
CMD ["npm", "start"] 