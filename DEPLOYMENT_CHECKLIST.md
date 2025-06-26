# 🚀 WhereWeMeets 프로덕션 배포 체크리스트

## 📋 배포 전 체크리스트

### ✅ 1. 환경 변수 설정 확인

#### Railway (백엔드) 환경 변수:
```bash
NODE_ENV=production
PORT=5000
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/wherewemeets
JWT_SECRET=your-super-secret-jwt-key-here
KAKAO_API_KEY=your-kakao-api-key
GEMINI_API_KEY=your-gemini-api-key
GOOGLE_PLACES_API_KEY=your-google-places-api-key
STRIPE_SECRET_KEY=your-stripe-secret-key
STRIPE_PUBLISHABLE_KEY=your-stripe-publishable-key
CORS_ORIGIN=https://www.wherewemeets.com
NPM_CONFIG_LEGACY_PEER_DEPS=true
CI=false
NODE_OPTIONS=--max-old-space-size=4096
```

#### Vercel (프론트엔드) 환경 변수:
```bash
NODE_ENV=production
CI=false
GENERATE_SOURCEMAP=false
```

### ✅ 2. 도메인 설정 확인

- **프론트엔드**: `https://www.wherewemeets.com` (Vercel)
- **백엔드**: `https://wherewemeets-production.up.railway.app` (Railway)

### ✅ 3. 코드 설정 확인

#### 자동 URL 전환 (이미 설정됨):
- `client/src/utils/api.js` ✅
- `client/src/contexts/AuthContext.js` ✅  
- `client/src/components/RandomSelector.js` ✅

#### CORS 설정 (이미 설정됨):
- `server.js`에 프로덕션 도메인들 포함 ✅

### ✅ 4. 배포 설정 파일 확인

- `railway.json` ✅ (헬스체크, 재시작 정책 포함)
- `client/vercel.json` ✅ (정적 파일 캐싱, 라우팅 설정)
- `package.json` ✅ (build:server 스크립트 추가)

## 🚀 배포 순서

### 1단계: 백엔드 배포 (Railway)
```bash
# 1. 코드 푸시
git add .
git commit -m "feat: 프로덕션 배포 준비 완료"
git push origin main

# 2. Railway에서 자동 배포 확인
# - https://railway.app 대시보드에서 배포 상태 확인
# - 환경 변수들이 모두 설정되었는지 확인
# - 헬스체크 엔드포인트 작동 확인: /api/health
```

### 2단계: 프론트엔드 배포 (Vercel)
```bash
# Vercel에서 자동 배포 확인
# - https://vercel.com 대시보드에서 배포 상태 확인
# - 환경 변수들이 모두 설정되었는지 확인
# - 도메인 연결 확인
```

### 3단계: 도메인 설정
1. **Vercel에서 도메인 연결**:
   - `www.wherewemeets.com` → Vercel 프로젝트
   - `wherewemeets.com` → `www.wherewemeets.com`로 리다이렉트

2. **DNS 설정**:
   - A 레코드: `wherewemeets.com` → Vercel IP
   - CNAME 레코드: `www` → Vercel 도메인

## 🧪 배포 후 테스트

### API 서버 테스트:
```bash
# 헬스체크
curl https://wherewemeets-production.up.railway.app/api/health

# 기본 API 테스트
curl https://wherewemeets-production.up.railway.app/api/test
```

### 프론트엔드 테스트:
1. `https://www.wherewemeets.com` 접속
2. 회원가입/로그인 테스트
3. 미팅 생성 테스트
4. 장소 추천 테스트
5. 투표 기능 테스트
6. 룰렛 기능 테스트

### 기능별 테스트 체크리스트:
- [ ] 홈페이지 로딩
- [ ] 회원가입/로그인
- [ ] 게스트 모드
- [ ] 미팅 생성
- [ ] AI 장소 추천
- [ ] 장소 검색 (PlaceExplorer)
- [ ] 후보 장소 추가
- [ ] 그룹 투표
- [ ] 실시간 채팅
- [ ] 룰렛 선정
- [ ] 미팅 히스토리
- [ ] 프로필 관리

## 🛠️ 트러블슈팅

### 일반적인 문제들:

#### 1. CORS 에러
```javascript
// server.js에서 도메인 확인
const allowedOrigins = [
  'https://wherewemeets.com',
  'https://www.wherewemeets.com',
  // ...
];
```

#### 2. API 연결 실패
- Railway 서버 상태 확인
- 환경 변수 설정 확인
- 헬스체크 엔드포인트 확인

#### 3. 빌드 실패
- Node.js 버전 확인 (18.x)
- 의존성 설치 확인
- 환경 변수 확인

#### 4. 데이터베이스 연결 실패
- MongoDB URI 확인
- 네트워크 접근 권한 확인
- IP 화이트리스트 확인

## 📊 모니터링

### 배포 후 모니터링 항목:
1. **서버 상태**: Railway 대시보드
2. **프론트엔드 상태**: Vercel 대시보드  
3. **데이터베이스**: MongoDB Atlas 모니터링
4. **에러 로그**: Railway/Vercel 로그 확인
5. **성능**: 응답 시간, 메모리 사용량

### 알림 설정:
- Railway: 서버 다운 알림
- Vercel: 빌드 실패 알림
- MongoDB: 연결 실패 알림

## 🔒 보안 체크리스트

- [ ] 환경 변수에 민감한 정보 저장
- [ ] JWT 시크릿 복잡하게 설정
- [ ] API 키들 보안 설정
- [ ] CORS 도메인 제한
- [ ] HTTPS 강제 사용
- [ ] Rate Limiting 설정

## 📝 배포 완료 후 해야할 일

1. **문서 업데이트**: README.md, API 문서
2. **모니터링 설정**: 에러 추적, 성능 모니터링
3. **백업 설정**: 데이터베이스 백업 스케줄
4. **보안 검토**: 보안 취약점 점검
5. **성능 최적화**: CDN 설정, 이미지 최적화

---

## 🎉 배포 성공!

모든 체크리스트를 완료하면 WhereWeMeets가 프로덕션 환경에서 정상 작동합니다!

**프로덕션 URL**: https://www.wherewemeets.com
**API 서버**: https://wherewemeets-production.up.railway.app 