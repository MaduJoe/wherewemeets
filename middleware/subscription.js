const User = require('../models/User');

// 구독 레벨별 제한 설정
const SUBSCRIPTION_LIMITS = {
  guest: {
    maxMeetings: 0,
    canCreateMeeting: false,
    canUseAI: false,
    canAccessAnalytics: false,
    canManageMeetings: false
  },
  free: {
    maxMeetings: 3,
    canCreateMeeting: true,
    canUseAI: false,
    canAccessAnalytics: false,
    canManageMeetings: false
  },
  premium: {
    maxMeetings: -1, // 무제한
    canCreateMeeting: true,
    canUseAI: true,
    canAccessAnalytics: true,
    canManageMeetings: true
  },
  pro: {
    maxMeetings: -1, // 무제한
    canCreateMeeting: true,
    canUseAI: true,
    canAccessAnalytics: true,
    canManageMeetings: true
  }
};

// 구독 상태 확인
const checkSubscription = (requiredLevel) => {
  return async (req, res, next) => {
    try {
      // Guest 사용자 처리
      if (!req.user) {
        const guestLimits = SUBSCRIPTION_LIMITS.guest;
        
        if (requiredLevel === 'premium' && !guestLimits.canCreateMeeting) {
          return res.status(403).json({
            success: false,
            message: '미팅 생성은 회원가입 후 이용 가능합니다.',
            errorCode: 'GUEST_LIMIT',
            upgradeRequired: true,
            currentPlan: 'guest',
            requiredPlan: 'free'
          });
        }
        
        req.subscriptionLimits = guestLimits;
        return next();
      }

      // 로그인된 사용자 처리
      const user = await User.findById(req.user.userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: '사용자를 찾을 수 없습니다.'
        });
      }

      const userSubscription = user.subscription || 'free';
      const userLimits = SUBSCRIPTION_LIMITS[userSubscription];

      // 구독 만료 확인
      if (user.subscriptionEndDate && new Date() > user.subscriptionEndDate) {
        // 프리미엄 만료 시 무료로 다운그레이드
        user.subscription = 'free';
        await user.save();
        userLimits = SUBSCRIPTION_LIMITS.free;
      }

      // 권한 확인
      if (requiredLevel === 'premium') {
        if (userSubscription === 'free' && !userLimits.canUseAI) {
          return res.status(403).json({
            success: false,
            message: 'AI 추천 기능은 프리미엄 회원 전용입니다.',
            errorCode: 'UPGRADE_REQUIRED',
            upgradeRequired: true,
            currentPlan: userSubscription,
            requiredPlan: 'premium',
            features: ['AI 장소 추천', '무제한 미팅 생성', '고급 분석']
          });
        }
      }

      // 미팅 생성 제한 확인
      if (requiredLevel === 'create_meeting') {
        if (userLimits.maxMeetings !== -1) {
          const currentMeetingCount = user.analytics.totalMeetings || 0;
          if (currentMeetingCount >= userLimits.maxMeetings) {
            return res.status(403).json({
              success: false,
              message: `무료 계정은 월 ${userLimits.maxMeetings}개 미팅까지 생성 가능합니다.`,
              errorCode: 'MEETING_LIMIT_EXCEEDED',
              upgradeRequired: true,
              currentPlan: userSubscription,
              requiredPlan: 'premium',
              currentCount: currentMeetingCount,
              maxCount: userLimits.maxMeetings
            });
          }
        }
      }

      req.user.subscription = userSubscription;
      req.subscriptionLimits = userLimits;
      next();

    } catch (error) {
      console.error('구독 확인 에러:', error);
      res.status(500).json({
        success: false,
        message: '서버 오류가 발생했습니다.'
      });
    }
  };
};

// 프리미엄 전용 기능
const requirePremium = checkSubscription('premium');

// 미팅 생성 권한 확인
const checkMeetingCreation = checkSubscription('create_meeting');

// 구독 정보 조회
const getSubscriptionInfo = async (req, res) => {
  try {
    if (!req.user) {
      return res.json({
        success: true,
        data: {
          subscription: 'guest',
          limits: SUBSCRIPTION_LIMITS.guest,
          upgradeRequired: true
        }
      });
    }

    const user = await User.findById(req.user.userId);
    const subscription = user.subscription || 'free';
    const limits = SUBSCRIPTION_LIMITS[subscription];

    res.json({
      success: true,
      data: {
        subscription,
        limits,
        endDate: user.subscriptionEndDate,
        analytics: user.analytics,
        upgradeRequired: subscription === 'free'
      }
    });

  } catch (error) {
    console.error('구독 정보 조회 에러:', error);
    res.status(500).json({
      success: false,
      message: '서버 오류가 발생했습니다.'
    });
  }
};

module.exports = {
  checkSubscription,
  requirePremium,
  checkMeetingCreation,
  getSubscriptionInfo,
  SUBSCRIPTION_LIMITS
}; 