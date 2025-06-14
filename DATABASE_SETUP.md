# 데이터베이스 설정 가이드

## 🚀 빠른 시작

### 1. MongoDB 설치 (로컬 개발)

#### Windows:
```bash
# MongoDB Community Server 다운로드 및 설치
# https://www.mongodb.com/try/download/community

# MongoDB 서비스 시작
net start MongoDB
```

#### macOS:
```bash
# Homebrew로 설치
brew tap mongodb/brew
brew install mongodb-community

# MongoDB 서비스 시작
brew services start mongodb/brew/mongodb-community
```

#### Ubuntu/Linux:
```bash
# MongoDB 설치
sudo apt update
sudo apt install mongodb

# MongoDB 서비스 시작
sudo systemctl start mongodb
sudo systemctl enable mongodb
```

### 2. 프로젝트 설정

```bash
# 의존성 설치
npm install

# 환경 변수 설정 (선택사항)
cp .env.example .env

# 데이터베이스 초기 설정 및 테스트 데이터 생성
npm run setup-db

# 서버 시작
npm run dev
```

## 📋 테스트 계정

데이터베이스 설정 후 다음 계정으로 로그인할 수 있습니다:

| 이메일 | 비밀번호 | 권한 | 설명 |
|--------|----------|------|------|
| `test@example.com` | `123456` | Premium | 기본 테스트 계정 |
| `premium@example.com` | `premium123` | Premium | 프리미엄 기능 테스트 |
| `user@example.com` | `user123` | Free | 무료 사용자 테스트 |

## 🛠 주요 기능

### 1. 사용자 관리
- ✅ 회원가입/로그인 (JWT 인증)
- ✅ 소셜 로그인 (Google, Kakao)
- ✅ 프로필 편집
- ✅ 비밀번호 변경
- ✅ 계정 삭제

### 2. 대시보드
- ✅ 사용자 통계 조회
- ✅ 기능 사용 이력
- ✅ 미팅 참여 내역
- ✅ 선호도 분석

### 3. 데이터베이스 구조
- **Users**: 사용자 정보, 프로필, 분석 데이터
- **Meetings**: 미팅 정보, 참가자, 투표 결과
- **Analytics**: 사용자 행동 분석

## 🔧 환경 변수

`.env` 파일에서 다음 변수들을 설정할 수 있습니다:

```env
# 데이터베이스
MONGODB_URI=mongodb://localhost:27017/wherewemeets

# JWT 시크릿
JWT_SECRET=your_jwt_secret_key

# 서버 포트
PORT=5000

# 개발 환경
NODE_ENV=development

# AI 기능 (선택사항)
GEMINI_API_KEY=your_gemini_api_key_here

# 장소 검색 API
KAKAO_API_KEY=your_kakao_api_key_here
GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here
```

### AI 기능 설정

**Gemini API 키 획득:**
1. [Google AI Studio](https://makersuite.google.com/app/apikey) 방문
2. 새 API 키 생성
3. `.env` 파일에 `GEMINI_API_KEY` 추가

⚠️ **주의사항**: 
- API 키가 없어도 서비스는 정상 작동합니다 (더미 데이터 제공)
- 개발 환경에서는 프리미엄 제한이 우회됩니다
- 프로덕션에서는 유효한 API 키가 필요합니다

## 📊 API 엔드포인트

### 인증
- `POST /api/auth/register` - 회원가입
- `POST /api/auth/login` - 로그인
- `POST /api/auth/social-login` - 소셜 로그인
- `GET /api/auth/me` - 사용자 정보 조회
- `PUT /api/auth/profile` - 프로필 업데이트
- `PUT /api/auth/password` - 비밀번호 변경
- `GET /api/auth/dashboard` - 대시보드 데이터
- `POST /api/auth/track-feature` - 기능 사용 추적
- `DELETE /api/auth/account` - 계정 삭제

### 미팅
- `GET /api/meetings` - 미팅 목록
- `POST /api/meetings` - 미팅 생성
- `GET /api/meetings/:id` - 미팅 상세
- `PUT /api/meetings/:id` - 미팅 수정
- `DELETE /api/meetings/:id` - 미팅 삭제

### 장소
- `POST /api/locations/recommend` - 장소 추천 (규칙 기반)
- `GET /api/locations/search` - 장소 검색
- `POST /api/places/search` - 카카오 API 장소 검색

### AI 도우미 (프리미엄)
- `POST /api/aiAssistant/chat` - AI 대화
- `POST /api/aiAssistant/recommend-places` - AI 장소 추천
- `GET /api/aiAssistant/status` - AI 서비스 상태

## 🚨 문제 해결

### MongoDB 연결 실패
```bash
# MongoDB 서비스 상태 확인
# Windows
net start MongoDB

# macOS
brew services list | grep mongodb

# Linux
sudo systemctl status mongodb
```

### 포트 충돌
```bash
# 포트 사용 확인
netstat -ano | findstr :5000  # Windows
lsof -i :5000                 # macOS/Linux

# 프로세스 종료 후 재시작
```

### 권한 문제
```bash
# 데이터베이스 폴더 권한 확인
# MongoDB 로그 확인: /var/log/mongodb/mongod.log
```

## 📝 개발 노트

- **프론트엔드**: React (client 폴더)
- **백엔드**: Node.js + Express
- **데이터베이스**: MongoDB + Mongoose
- **인증**: JWT + bcrypt
- **실시간**: Socket.io (예정)

## 🔄 배포

### Production 환경
```bash
# 빌드
npm run build

# 프로덕션 시작
npm start
```

### MongoDB Atlas (클라우드)
```env
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/wherewemeets
```

---

💡 **도움이 필요하신가요?** 이슈를 생성하거나 개발팀에 문의해주세요! 