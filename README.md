# 🎯 WhereWeMeets

**미팅 장소 추천 및 투표 플랫폼**

친구들과 만날 장소를 AI 추천받고, 그룹 투표로 공정하게 결정하세요!

## ✨ 주요 기능

- 🤖 **AI 장소 추천**: Gemini AI가 맞춤형 장소를 추천
- 🎭 **감성 키워드 분석**: "분위기 좋은", "맛있는" 등 감성 표현을 분석하여 Google Maps 리뷰 기반 정확한 추천
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
- Google Places API (리뷰 분석)
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
GOOGLE_PLACES_API_KEY=your-google-places-key
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

## 🎭 감성 키워드 기반 추천 시스템

### 개요
사용자가 "분위기 좋은", "맛있는", "아늑한" 등의 감성적인 표현을 사용할 때, 단순한 키워드 매칭이 아닌 실제 사용자 리뷰를 분석하여 더 정확한 장소를 추천하는 시스템입니다.

### 작동 원리
1. **감성 키워드 감지**: 사용자 입력에서 감성적 표현을 자동 감지
2. **Kakao API 검색**: 기본 장소 정보 수집
3. **Google Places API 연동**: 해당 장소의 실제 사용자 리뷰 수집
4. **감성 분석**: 리뷰에서 감성 키워드 매칭 및 점수 계산
5. **스마트 랭킹**: 감성 점수와 평점을 종합하여 최적의 장소 추천

### 지원 감성 카테고리
- **분위기**: 분위기 좋은, 아늑한, 편안한, 로맨틱, 세련된
- **음식**: 맛있는, 신선한, 유명한, 인기있는
- **서비스**: 친절한, 빠른, 정확한, 세심한
- **가격**: 가성비, 저렴한, 합리적
- **위치**: 접근성, 편리한, 가까운

### API 엔드포인트
```javascript
// 감성 키워드 기반 장소 검색
GET /api/places/search/sentiment?query=분위기 좋은 카페

// 감성 키워드 추출 (테스트용)
POST /api/places/sentiment/extract
```

### 테스트
감성 키워드 기능을 테스트하려면 `/test/sentiment-test.html` 파일을 브라우저에서 열어보세요.

## 📄 라이센스

MIT License

---

**Made with ❤️ by WhereWeMeets Team** 