# 🚀 WhereWeMeets 로컬 개발 환경 가이드

## 📋 개요
이 가이드는 WhereWeMeets 프로젝트를 로컬에서 개발하기 위한 설정 방법을 안내합니다.

## 🔧 초기 설정

### 1. 환경 변수 설정
```bash
# 로컬 개발 환경 자동 설정
npm run setup-local
```

### 2. 의존성 설치
```bash
# 루트와 클라이언트 의존성 한번에 설치
npm run install:all
```

## 🏃‍♂️ 개발 서버 실행

### 옵션 1: 한 번에 실행 (권장)
```bash
# 백엔드와 프론트엔드 동시 실행
npm run dev:full
```

### 옵션 2: 개별 실행
```bash
# 터미널 1: 백엔드 서버
npm run dev

# 터미널 2: 프론트엔드 서버  
cd client && npm start
```

## 🌐 접속 URL

| 서비스 | URL | 설명 |
|--------|-----|------|
| 프론트엔드 | http://localhost:3000 | React 개발 서버 |
| 백엔드 API | http://localhost:5000 | Express 서버 |
| 데이터베이스 | Railway MongoDB | 기존 프로덕션 데이터 |

## 📁 환경 파일 구조

```
wherewemeets/
├── .env                    # 백엔드 환경 변수
├── client/
│   └── .env               # 프론트엔드 환경 변수
└── env.example            # 환경 변수 템플릿
```

## 🔑 환경 변수 설명

### 백엔드 (.env)
- `PORT=5000` - 백엔드 서버 포트
- `NODE_ENV=development` - 개발 모드
- `MONGODB_URI` - MongoDB 연결 URL
- `JWT_SECRET` - JWT 토큰 시크릿
- `FRONTEND_URL=http://localhost:3000` - CORS용 프론트엔드 URL

### 프론트엔드 (client/.env)
- `REACT_APP_API_URL=http://localhost:5000` - 백엔드 API URL
- `REACT_APP_ENV=development` - 개발 모드

## 🐛 디버깅 팁

### 1. 포트 충돌 해결
```bash
# 포트 5000이 사용 중일 때
netstat -ano | findstr :5000
taskkill /PID <PID번호> /F
```

### 2. 캐시 초기화
```bash
# npm 캐시 클리어
npm cache clean --force

# 프론트엔드 캐시 클리어
cd client && npm start -- --reset-cache
```

### 3. 의존성 재설치
```bash
# 루트 의존성 재설치
rm -rf node_modules package-lock.json
npm install

# 클라이언트 의존성 재설치  
cd client
rm -rf node_modules package-lock.json
npm install
```

## 📊 데이터베이스

### 연결 방식
- **로컬 개발**: Railway MongoDB (프로덕션과 동일)
- **장점**: 실제 데이터로 테스트 가능
- **주의**: 프로덕션 데이터 변경 시 주의

### 테스트 데이터 생성 (선택)
```bash
# 테스트 사용자 생성
npm run setup-users
```

## 🚀 배포 워크플로우

### 1. 로컬 개발 → 테스트
```bash
# 로컬에서 개발
npm run dev:full

# 기능 테스트
# http://localhost:3000에서 확인
```

### 2. 프로덕션 배포
```bash
# Git 커밋 후 푸시
git add .
git commit -m "feat: 새로운 기능 추가"
git push origin main

# 자동 배포됨:
# - 백엔드: Railway
# - 프론트엔드: Vercel
```

## 💡 개발 팁

### 1. Hot Reload
- 백엔드: nodemon으로 자동 재시작
- 프론트엔드: React Hot Reload 활성화

### 2. 로그 확인
- 백엔드 로그: 터미널에서 실시간 확인
- 프론트엔드 로그: 브라우저 개발자 도구

### 3. API 테스트
```bash
# API 상태 확인
curl http://localhost:5000/api/health

# 인증 테스트
curl http://localhost:5000/api/auth/check
```

## 🔧 유용한 NPM 스크립트

| 명령어 | 설명 |
|--------|------|
| `npm run dev` | 백엔드만 실행 |
| `npm run client` | 프론트엔드만 실행 |
| `npm run dev:full` | 백엔드+프론트엔드 동시 실행 |
| `npm run setup-local` | 로컬 환경 자동 설정 |
| `npm run install:all` | 모든 의존성 설치 |
| `npm run build` | 프로덕션 빌드 |

## ❗ 주의사항

1. **환경 변수**: API 키들은 실제 값으로 교체 필요
2. **데이터베이스**: 프로덕션 DB 사용 시 데이터 수정 주의
3. **포트**: 5000, 3000 포트가 사용 중이지 않은지 확인
4. **CORS**: 로컬 개발 시 CORS 설정이 자동으로 허용됨

## 🆘 문제 해결

문제가 발생하면 다음 순서로 확인:
1. 환경 변수 파일 존재 확인
2. 의존성 설치 상태 확인
3. 포트 충돌 확인
4. MongoDB 연결 상태 확인
5. 로그 메시지 확인

---

**Happy Coding! 🎉** 