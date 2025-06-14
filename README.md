# 🎯 WhereWeMeets

**미팅 장소 추천 및 투표 플랫폼**

친구들과 만날 장소를 AI 추천받고, 그룹 투표로 공정하게 결정하세요!

## ✨ 주요 기능

- 🤖 **AI 장소 추천**: Gemini AI가 맞춤형 장소를 추천
- 🗺️ **지도 기반 검색**: Kakao Map API로 실제 장소 검색
- 🗳️ **그룹 투표**: 실시간 투표로 민주적 장소 결정
- 🎲 **공정한 랜덤 선택**: 룰렛으로 최종 장소 결정
- 💬 **실시간 채팅**: Socket.io 기반 실시간 소통
- 💳 **프리미엄 구독**: Stripe 결제 시스템

## 🛠️ 기술 스택

### Frontend
- React 18
- Tailwind CSS
- Heroicons
- Axios
- Socket.io Client

### Backend
- Node.js
- Express.js
- MongoDB (Mongoose)
- Socket.io
- JWT Authentication

### APIs
- Kakao Local API (장소 검색)
- Google Gemini AI (장소 추천)
- Stripe (결제)

## 🚀 배포

- **Production**: https://wherewemeets.com
- **Platform**: Railway
- **Database**: MongoDB Atlas

## 📦 설치 및 실행

### 개발 환경
```bash
# 의존성 설치
npm install
cd client && npm install

# 환경변수 설정
cp env.example .env
# .env 파일에 실제 API 키들 입력

# 개발 서버 실행
npm run dev
```

### 프로덕션 빌드
```bash
# 프론트엔드 빌드
npm run build

# 프로덕션 서버 실행
npm start
```

## 🔧 환경변수

```env
MONGODB_URI=mongodb+srv://...
JWT_SECRET=your-jwt-secret
KAKAO_API_KEY=your-kakao-key
GEMINI_API_KEY=your-gemini-key
NODE_ENV=production
PORT=3000
```

## 📱 주요 페이지

- `/` - 홈페이지
- `/login` - 로그인
- `/register` - 회원가입
- `/meeting-planner/:id` - 미팅 플래너
- `/subscription` - 구독 관리

## 🎨 UI/UX

- 반응형 디자인 (모바일 최적화)
- 다크모드 지원
- 직관적인 사용자 인터페이스
- 실시간 피드백

## 📄 라이센스

MIT License

---

**Made with ❤️ by WhereWeMeets Team** 