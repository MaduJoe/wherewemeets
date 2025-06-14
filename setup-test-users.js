// 브라우저 콘솔에서 실행할 스크립트
const testUsers = [
  {
    id: 1,
    name: '김철수',
    email: 'test@example.com',
    password: '123456',
    subscription: 'premium',
    registeredAt: new Date().toISOString(),
    isGuest: false
  },
  {
    id: 2,
    name: '이영희',
    email: 'premium@example.com',
    password: 'premium123',
    subscription: 'premium',
    registeredAt: new Date().toISOString(),
    isGuest: false
  }
];

localStorage.setItem('registeredUsers', JSON.stringify(testUsers));
console.log('테스트 사용자 계정이 생성되었습니다.');
console.log('로그인 테스트:');
console.log('이메일: test@example.com, 비밀번호: 123456');
console.log('이메일: premium@example.com, 비밀번호: premium123'); 