# Node.js 18 Alpine 이미지 사용
FROM node:18-alpine

# 작업 디렉토리 설정
WORKDIR /app

# 전체 프로젝트 복사
COPY . .

# 백엔드 의존성 설치
RUN npm install --production

# 클라이언트로 이동하여 빌드
WORKDIR /app/client
RUN npm install --legacy-peer-deps && npm run build

# 다시 루트로 이동
WORKDIR /app

# 불필요한 파일 정리
RUN rm -rf client/src client/public client/package*.json client/node_modules client/.npmrc

# 포트 노출
EXPOSE 3000

# 서버 시작
CMD ["npm", "start"] 