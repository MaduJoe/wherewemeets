# Node.js 18 이미지 사용
FROM node:18-alpine

# 작업 디렉토리 설정
WORKDIR /app

# 모든 파일 복사
COPY . .

# 서버 의존성 설치
RUN npm install

# 클라이언트 의존성 설치 및 빌드
RUN cd client && npm install --legacy-peer-deps && npm run build

# 포트 노출
EXPOSE 5000

# 애플리케이션 시작
CMD ["npm", "start"] 