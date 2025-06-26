const fs = require('fs');
const path = require('path');

console.log('🚀 WhereWeMeets 로컬 개발 환경 설정을 시작합니다...\n');

// .env 파일 생성 (루트 디렉토리)
const envContent = `# WhereWeMeets 로컬 개발 환경 설정

# 서버 설정
PORT=5000
NODE_ENV=development

# 데이터베이스 (Railway MongoDB 계속 사용)
MONGODB_URI=mongodb+srv://wherewemeets:QBOe2I6reMXaBdjW@cluster.mongodb.net/wherewemeets

# JWT 시크릿 (로컬용)
JWT_SECRET=local-development-jwt-secret-key-very-long-and-secure

# API 키들 (개발용 - 필요시 실제 값으로 교체)
KAKAO_API_KEY=your-kakao-api-key
GEMINI_API_KEY=your-gemini-api-key  
GOOGLE_PLACES_API_KEY=your-google-places-api-key

# 로컬 개발 도메인 설정
FRONTEND_URL=http://localhost:3000
BACKEND_URL=http://localhost:5000

# CORS 설정 (로컬 개발용)
CORS_ORIGIN=http://localhost:3000

# Stripe (개발용 테스트 키)
STRIPE_SECRET_KEY=sk_test_your-stripe-test-secret-key
STRIPE_PUBLISHABLE_KEY=pk_test_your-stripe-test-publishable-key
`;

// 클라이언트용 .env 파일 생성
const clientEnvContent = `# 프론트엔드 로컬 개발 환경 설정

# API URL (로컬 백엔드 서버)
REACT_APP_API_URL=http://localhost:5000

# Stripe (프론트엔드용 테스트 키)
REACT_APP_STRIPE_PUBLISHABLE_KEY=pk_test_your-stripe-test-publishable-key

# 기타 설정
REACT_APP_ENV=development
`;

try {
  // 루트 .env 파일 생성
  if (!fs.existsSync('.env')) {
    fs.writeFileSync('.env', envContent);
    console.log('✅ 루트 .env 파일이 생성되었습니다.');
  } else {
    console.log('⚠️  루트 .env 파일이 이미 존재합니다.');
  }

  // 클라이언트 .env 파일 생성
  const clientEnvPath = path.join('client', '.env');
  if (!fs.existsSync(clientEnvPath)) {
    fs.writeFileSync(clientEnvPath, clientEnvContent);
    console.log('✅ 클라이언트 .env 파일이 생성되었습니다.');
  } else {
    console.log('⚠️  클라이언트 .env 파일이 이미 존재합니다.');
  }

  console.log('\n🎉 로컬 개발 환경 설정 완료!\n');
  
  console.log('📋 다음 단계를 따라하세요:\n');
  console.log('1. 백엔드 서버 실행:');
  console.log('   npm run dev\n');
  console.log('2. 새 터미널에서 프론트엔드 서버 실행:');
  console.log('   cd client && npm start\n');
  console.log('3. 브라우저에서 확인:');
  console.log('   http://localhost:3000\n');
  
  console.log('💡 팁:');
  console.log('- 백엔드: http://localhost:5000');
  console.log('- 프론트엔드: http://localhost:3000');
  console.log('- 데이터베이스: Railway MongoDB (기존 데이터 유지)');
  console.log('- 로그: 터미널에서 실시간 확인 가능\n');

} catch (error) {
  console.error('❌ 설정 중 오류 발생:', error.message);
} 