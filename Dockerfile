# Node.js 18 이미지 사용
FROM node:18-alpine

# 작업 디렉토리 설정
WORKDIR /app

# 환경 변수 설정
ENV NODE_ENV=production

# package.json과 package-lock.json 복사
COPY package*.json ./

# 서버 의존성 설치
RUN npm install

# 서버 소스 코드 복사 (클라이언트 제외)
COPY server.js ./
COPY routes/ ./routes/
COPY middleware/ ./middleware/
COPY models/ ./models/
COPY services/ ./services/
COPY setup-database.js ./
COPY setup-test-users.js ./

# 포트 노출
EXPOSE 5000

# 애플리케이션 시작
CMD ["npm", "start"] 