const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { auth } = require('../middleware/auth');
const router = express.Router();

// 회원가입
router.post('/register', async (req, res) => {
  try {
    console.log('회원가입 요청 받음:', req.body);
    console.log('Content-Type:', req.get('Content-Type'));
    
    const { name, email, password } = req.body;

    // 입력 검증
    if (!name || !email || !password) {
      return res.status(400).json({ 
        message: '모든 필드를 입력해주세요.',
        missing: {
          name: !name,
          email: !email, 
          password: !password
        }
      });
    }

    if (name.length < 2) {
      return res.status(400).json({ message: '이름은 2글자 이상 입력해주세요.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: '비밀번호는 6글자 이상 입력해주세요.' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: '올바른 이메일 형식을 입력해주세요.' });
    }

    // 사용자 존재 확인
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: '이미 등록된 이메일입니다.' });
    }

    // 새 사용자 생성
    const user = new User({
      name,
      email,
      password,
      subscription: 'premium' // 회원가입 시 프리미엄 제공
    });

    await user.save();

    // JWT 토큰 생성
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET || 'fallback_secret',
      { expiresIn: '7d' }
    );

    // 로그인 이력 추가
    await user.addLoginHistory(req.ip, req.get('User-Agent'), 'local');

    res.status(201).json({
      message: '회원가입이 완료되었습니다.',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        subscription: user.subscription,
        isGuest: false,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    console.error('회원가입 에러:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

// 로그인
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // 사용자 찾기
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: '이메일 또는 비밀번호가 올바르지 않습니다.' });
    }

    // 비밀번호 확인
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(400).json({ message: '이메일 또는 비밀번호가 올바르지 않습니다.' });
    }

    // JWT 토큰 생성
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET || 'fallback_secret',
      { expiresIn: '7d' }
    );

    // 로그인 이력 추가
    await user.addLoginHistory(req.ip, req.get('User-Agent'), 'local');

    res.json({
      message: '로그인 성공',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        subscription: user.subscription,
        isGuest: false,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    console.error('로그인 에러:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

// 소셜 로그인
router.post('/social-login', async (req, res) => {
  try {
    const { provider, providerId, name, email } = req.body;

    let user = await User.findOne({
      $or: [
        { email },
        { 'socialLogin.providerId': providerId }
      ]
    });

    if (!user) {
      // 새 소셜 사용자 생성
      user = new User({
        name: name || `${provider} 사용자`,
        email: email || `${providerId}@${provider}.com`,
        password: Math.random().toString(36).slice(-8), // 임시 비밀번호
        subscription: 'premium',
        socialLogin: {
          provider,
          providerId
        }
      });
      await user.save();
    } else if (!user.socialLogin.providerId) {
      // 기존 이메일 사용자에 소셜 정보 연동
      user.socialLogin = { provider, providerId };
      await user.save();
    }

    // JWT 토큰 생성
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET || 'fallback_secret',
      { expiresIn: '7d' }
    );

    // 로그인 이력 추가
    await user.addLoginHistory(req.ip, req.get('User-Agent'), provider);

    res.json({
      message: `${provider} 로그인 성공`,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        subscription: user.subscription,
        provider: user.socialLogin.provider,
        isGuest: false,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    console.error('소셜 로그인 에러:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

// 현재 사용자 정보 조회
router.get('/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('-password');
    if (!user) {
      return res.status(404).json({ message: '사용자를 찾을 수 없습니다.' });
    }

    res.json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        bio: user.bio,
        avatar: user.avatar,
        location: user.location,
        subscription: user.subscription,
        preferences: user.preferences,
        analytics: user.analytics,
        isGuest: false,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    console.error('사용자 정보 조회 에러:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

// 프로필 업데이트
router.put('/profile', auth, async (req, res) => {
  try {
    console.log('프로필 업데이트 요청:', req.body);
    
    const {
      name,
      phone,
      bio,
      location,
      preferences
    } = req.body;

    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ message: '사용자를 찾을 수 없습니다.' });
    }

    console.log('현재 사용자 preferences:', user.preferences);

    // preferences validation
    if (preferences) {
      console.log('업데이트할 preferences:', preferences);
      
      // transportMode validation
      if (preferences.transportMode && !['driving', 'walking', 'transit', 'bicycling'].includes(preferences.transportMode)) {
        return res.status(400).json({ 
          message: `유효하지 않은 교통수단입니다: ${preferences.transportMode}` 
        });
      }
      
      // language validation
      if (preferences.language && !['ko', 'en'].includes(preferences.language)) {
        return res.status(400).json({ 
          message: `유효하지 않은 언어입니다: ${preferences.language}` 
        });
      }
      
      // preferredCategories validation
      if (preferences.preferredCategories && Array.isArray(preferences.preferredCategories)) {
        const validCategories = ['restaurant', 'cafe', 'park', 'shopping', 'entertainment', 'bar'];
        const invalidCategories = preferences.preferredCategories.filter(cat => !validCategories.includes(cat));
        if (invalidCategories.length > 0) {
          return res.status(400).json({ 
            message: `유효하지 않은 카테고리입니다: ${invalidCategories.join(', ')}` 
          });
        }
      }
      
      // maxDistance validation
      if (preferences.maxDistance !== undefined && (preferences.maxDistance < 1 || preferences.maxDistance > 100)) {
        return res.status(400).json({ 
          message: `최대 이동거리는 1-100km 사이여야 합니다: ${preferences.maxDistance}` 
        });
      }
      
      // notifications validation
      if (preferences.notifications) {
        const { email, push, sms } = preferences.notifications;
        if (email !== undefined && typeof email !== 'boolean') {
          return res.status(400).json({ 
            message: `이메일 알림 설정은 boolean 값이어야 합니다: ${email}` 
          });
        }
        if (push !== undefined && typeof push !== 'boolean') {
          return res.status(400).json({ 
            message: `푸시 알림 설정은 boolean 값이어야 합니다: ${push}` 
          });
        }
        if (sms !== undefined && typeof sms !== 'boolean') {
          return res.status(400).json({ 
            message: `SMS 알림 설정은 boolean 값이어야 합니다: ${sms}` 
          });
        }
      }
    }

    // 이름이 변경되는 경우 투표 데이터도 함께 업데이트
    const isNameChanged = name && name !== user.name;
    const oldName = user.name;

    // 프로필 정보 업데이트
    if (name) user.name = name;
    if (phone !== undefined) user.phone = phone;
    if (bio !== undefined) user.bio = bio;
    
    // location 업데이트
    if (location) {
      user.location = {
        ...user.location,
        ...location
      };
    }
    
    // preferences 안전하게 업데이트
    if (preferences) {
      // 기존 preferences가 없으면 기본값으로 초기화
      if (!user.preferences) {
        user.preferences = {
          transportMode: 'driving',
          preferredCategories: [],
          maxDistance: 30,
          language: 'ko',
          notifications: {
            email: true,
            push: true,
            sms: false
          }
        };
      }
      
      // 각 필드별로 안전하게 업데이트
      if (preferences.transportMode !== undefined) {
        user.preferences.transportMode = preferences.transportMode;
      }
      
      if (preferences.preferredCategories !== undefined) {
        user.preferences.preferredCategories = preferences.preferredCategories;
      }
      
      if (preferences.maxDistance !== undefined) {
        user.preferences.maxDistance = preferences.maxDistance;
      }
      
      if (preferences.language !== undefined) {
        user.preferences.language = preferences.language;
      }
      
      // notifications 깊은 병합
      if (preferences.notifications) {
        if (!user.preferences.notifications) {
          user.preferences.notifications = {
            email: true,
            push: true,
            sms: false
          };
        }
        
        if (preferences.notifications.email !== undefined) {
          user.preferences.notifications.email = preferences.notifications.email;
        }
        
        if (preferences.notifications.push !== undefined) {
          user.preferences.notifications.push = preferences.notifications.push;
        }
        
        if (preferences.notifications.sms !== undefined) {
          user.preferences.notifications.sms = preferences.notifications.sms;
        }
      }
    }

    console.log('업데이트 후 preferences:', user.preferences);

    // MongoDB 업데이트 수행
    const updateData = {};
    
    if (name) updateData.name = name;
    if (phone !== undefined) updateData.phone = phone;
    if (bio !== undefined) updateData.bio = bio;
    if (location) {
      updateData.location = {
        ...user.location,
        ...location
      };
    }
    if (user.preferences) {
      updateData.preferences = user.preferences;
    }
    updateData.updatedAt = new Date();

    console.log('MongoDB 업데이트 데이터:', updateData);

    const updatedUser = await User.findByIdAndUpdate(
      req.user.userId,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    if (!updatedUser) {
      return res.status(404).json({ message: '사용자 업데이트에 실패했습니다.' });
    }

    console.log('업데이트 완료된 사용자:', updatedUser.preferences);

    // 이름이 변경된 경우 투표 데이터의 voter.name도 업데이트
    if (isNameChanged) {
      const Vote = require('../models/Vote');
      await Vote.updateMany(
        { 'voter.id': req.user.userId },
        { $set: { 'voter.name': name } }
      );
      console.log(`사용자 ${oldName} → ${name} 이름 변경 및 투표 데이터 업데이트 완료`);
    }

    res.json({
      message: '프로필이 업데이트되었습니다.',
      user: {
        id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        phone: updatedUser.phone,
        bio: updatedUser.bio,
        location: updatedUser.location,
        subscription: updatedUser.subscription,
        preferences: updatedUser.preferences,
        isGuest: false,
        createdAt: updatedUser.createdAt
      }
    });
  } catch (error) {
    console.error('프로필 업데이트 에러:', error);
    console.error('에러 스택:', error.stack);
    res.status(500).json({ 
      message: '프로필 업데이트 중 오류가 발생했습니다.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// 비밀번호 변경
router.put('/password', auth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ message: '사용자를 찾을 수 없습니다.' });
    }

    // 현재 비밀번호 확인 (소셜 로그인 사용자는 제외)
    if (user.socialLogin.provider === 'local') {
      const isCurrentPasswordValid = await user.comparePassword(currentPassword);
      if (!isCurrentPasswordValid) {
        return res.status(400).json({ message: '현재 비밀번호가 올바르지 않습니다.' });
      }
    }

    // 새 비밀번호 설정
    user.password = newPassword;
    await user.save();

    res.json({ message: '비밀번호가 변경되었습니다.' });
  } catch (error) {
    console.error('비밀번호 변경 에러:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

// 대시보드 데이터 조회
router.get('/dashboard', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('-password');
    if (!user) {
      return res.status(404).json({ message: '사용자를 찾을 수 없습니다.' });
    }

    // 최근 미팅 데이터 (Meeting 모델과 연동 필요)
    // const recentMeetings = await Meeting.find({ participants: user._id })
    //   .sort({ createdAt: -1 })
    //   .limit(5);

    // 통계 데이터
    const stats = {
      totalMeetings: user.analytics.totalMeetings,
      totalVotes: user.analytics.totalVotes,
      favoriteCategories: user.analytics.favoriteCategories,
      featureUsage: user.analytics.featureUsage.sort((a, b) => b.count - a.count).slice(0, 5),
      recentActivity: user.analytics.lastActivity
    };

    res.json({
      stats,
      user: {
        name: user.name,
        subscription: user.subscription,
        memberSince: user.createdAt
      }
      // recentMeetings: recentMeetings || []
    });
  } catch (error) {
    console.error('대시보드 데이터 조회 에러:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

// 기능 사용 추적
router.post('/track-feature', auth, async (req, res) => {
  try {
    const { featureName } = req.body;

    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ message: '사용자를 찾을 수 없습니다.' });
    }

    await user.trackFeatureUsage(featureName);

    res.json({ message: '기능 사용이 추적되었습니다.' });
  } catch (error) {
    console.error('기능 사용 추적 에러:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

// 계정 삭제
router.delete('/account', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ message: '사용자를 찾을 수 없습니다.' });
    }

    // 사용자 비활성화 (실제 삭제 대신)
    user.isActive = false;
    user.email = `deleted_${Date.now()}_${user.email}`;
    await user.save();

    res.json({ message: '계정이 삭제되었습니다.' });
  } catch (error) {
    console.error('계정 삭제 에러:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

module.exports = router; 