const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// 모델 import
const User = require('./models/User');
const Meeting = require('./models/Meeting');

const setupDatabase = async () => {
  try {
    console.log('🔄 데이터베이스 설정을 시작합니다...');

    // MongoDB 연결
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/wherewemeets', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('✅ MongoDB 연결 성공');

    // 기존 데이터 삭제 (개발 환경에서만)
    if (process.env.NODE_ENV !== 'production') {
      await User.deleteMany({});
      await Meeting.deleteMany({});
      console.log('🗑️  기존 데이터 삭제 완료');
    }

    // 테스트 사용자 생성
    console.log('👤 테스트 사용자 생성 중...');

    // 비밀번호 해싱
    const password1 = await bcrypt.hash('123456', 12);
    const password2 = await bcrypt.hash('premium123', 12);
    const password3 = await bcrypt.hash('user123', 12);

    const testUsers = [
      {
        name: '김철수',
        email: 'test@example.com',
        password: password1,
        subscription: 'premium',
        bio: '테스트 사용자입니다. 미팅 계획을 자주 세웁니다.',
        location: {
          city: '서울',
          address: '강남구'
        },
        preferences: {
          transportMode: 'driving',
          preferredCategories: ['restaurant', 'cafe'],
          maxDistance: 30,
          language: 'ko',
          notifications: {
            email: true,
            push: true,
            sms: false
          }
        },
        analytics: {
          totalMeetings: 5,
          totalVotes: 12,
          favoriteCategories: ['restaurant', 'cafe', 'park'],
          featureUsage: [
            { feature: 'smart-planner', count: 8, lastUsed: new Date() },
            { feature: 'group-voting', count: 12, lastUsed: new Date() },
            { feature: 'ai-recommendations', count: 5, lastUsed: new Date() }
          ]
        },
        isVerified: true
      },
      {
        name: '이영희',
        email: 'premium@example.com',
        password: password2,
        subscription: 'premium',
        bio: '프리미엄 사용자입니다. 다양한 기능을 활용합니다.',
        location: {
          city: '서울',
          address: '홍대입구'
        },
        preferences: {
          transportMode: 'transit',
          preferredCategories: ['cafe', 'entertainment', 'shopping'],
          maxDistance: 25,
          language: 'ko',
          notifications: {
            email: true,
            push: true,
            sms: true
          }
        },
        analytics: {
          totalMeetings: 8,
          totalVotes: 20,
          favoriteCategories: ['cafe', 'entertainment'],
          featureUsage: [
            { feature: 'smart-planner', count: 15, lastUsed: new Date() },
            { feature: 'group-voting', count: 20, lastUsed: new Date() },
            { feature: 'social-login', count: 3, lastUsed: new Date() }
          ]
        },
        isVerified: true
      },
      {
        name: '박민수',
        email: 'user@example.com',
        password: password3,
        subscription: 'free',
        bio: '일반 사용자입니다.',
        location: {
          city: '서울',
          address: '신촌'
        },
        preferences: {
          transportMode: 'walking',
          preferredCategories: ['restaurant', 'park'],
          maxDistance: 15,
          language: 'ko'
        },
        analytics: {
          totalMeetings: 2,
          totalVotes: 5,
          favoriteCategories: ['restaurant'],
          featureUsage: [
            { feature: 'group-voting', count: 5, lastUsed: new Date() }
          ]
        },
        isVerified: true
      }
    ];

    const createdUsers = await User.insertMany(testUsers);
    console.log(`✅ ${createdUsers.length}명의 테스트 사용자 생성 완료`);

    // 각 사용자의 로그인 정보 출력
    console.log('\n📋 테스트 계정 정보:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📧 test@example.com       | 🔐 123456      | 👑 Premium');
    console.log('📧 premium@example.com    | 🔐 premium123  | 👑 Premium');
    console.log('📧 user@example.com       | 🔐 user123     | 🆓 Free');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // 샘플 미팅 데이터 생성
    console.log('\n📅 샘플 미팅 생성 중...');

    const sampleMeetings = [
      {
        title: '주말 브런치 모임',
        description: '친구들과 함께하는 맛있는 브런치',
        organizer: createdUsers[0]._id,
        participants: [
          { user: createdUsers[0]._id, location: { lat: 37.5665, lng: 126.9780 } },
          { user: createdUsers[1]._id, location: { lat: 37.5563, lng: 126.9233 } }
        ],
        category: 'restaurant',
        scheduledDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 1주일 후
        status: 'planning',
        preferences: {
          transportMode: 'transit',
          maxDistance: 30,
          priceRange: 'medium'
        }
      },
      {
        title: '카페에서 스터디',
        description: '조용한 카페에서 공부하기',
        organizer: createdUsers[1]._id,
        participants: [
          { user: createdUsers[1]._id, location: { lat: 37.5563, lng: 126.9233 } },
          { user: createdUsers[2]._id, location: { lat: 37.5596, lng: 126.9375 } }
        ],
        category: 'cafe',
        scheduledDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3일 후
        status: 'planning',
        preferences: {
          transportMode: 'walking',
          maxDistance: 15,
          priceRange: 'low'
        }
      }
    ];

    const createdMeetings = await Meeting.insertMany(sampleMeetings);
    console.log(`✅ ${createdMeetings.length}개의 샘플 미팅 생성 완료`);

    console.log('\n🎉 데이터베이스 설정이 완료되었습니다!');
    console.log('💡 이제 애플리케이션을 시작할 수 있습니다.');
    console.log('🚀 npm run dev 명령어로 서버를 시작하세요.');

  } catch (error) {
    console.error('❌ 데이터베이스 설정 실패:', error);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 데이터베이스 연결 종료');
    process.exit(0);
  }
};

// 스크립트 실행
if (require.main === module) {
  setupDatabase();
}

module.exports = setupDatabase; 