const express = require('express');
const User = require('../models/User');
const { auth } = require('../middleware/auth');
const { getSubscriptionInfo } = require('../middleware/subscription');
const router = express.Router();

// 구독 정보 조회
router.get('/info', auth, getSubscriptionInfo);

// 프리미엄 구독 업그레이드
router.post('/upgrade', auth, async (req, res) => {
  try {
    const { plan } = req.body; // 'premium' 또는 'pro'
    
    if (!['premium', 'pro'].includes(plan)) {
      return res.status(400).json({
        success: false,
        message: '유효하지 않은 구독 플랜입니다.'
      });
    }

    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: '사용자를 찾을 수 없습니다.'
      });
    }

    // 구독 업그레이드
    user.subscription = plan;
    user.subscriptionEndDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30일
    await user.save();

    res.json({
      success: true,
      message: `${plan} 구독이 활성화되었습니다.`,
      data: {
        subscription: user.subscription,
        endDate: user.subscriptionEndDate
      }
    });

  } catch (error) {
    console.error('구독 업그레이드 에러:', error);
    res.status(500).json({
      success: false,
      message: '서버 오류가 발생했습니다.'
    });
  }
});

// 구독 취소
router.post('/cancel', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: '사용자를 찾을 수 없습니다.'
      });
    }

    user.subscription = 'free';
    user.subscriptionEndDate = null;
    await user.save();

    res.json({
      success: true,
      message: '구독이 취소되었습니다.',
      data: {
        subscription: user.subscription
      }
    });

  } catch (error) {
    console.error('구독 취소 에러:', error);
    res.status(500).json({
      success: false,
      message: '서버 오류가 발생했습니다.'
    });
  }
});

// 플랜별 기능 안내
router.get('/plans', (req, res) => {
  res.json({
    success: true,
    data: {
      plans: [
        {
          id: 'guest',
          name: 'Guest',
          price: 0,
          period: '영구',
          features: [
            '미팅 참여만 가능',
            '투표 참여',
            '기본 기능 체험'
          ],
          limitations: [
            '미팅 생성 불가',
            'AI 추천 불가',
            '분석 기능 불가'
          ]
        },
        {
          id: 'free',
          name: 'Free',
          price: 0,
          period: '영구',
          features: [
            '월 3개 미팅 생성',
            '기본 투표 기능',
            '간단한 장소 추천'
          ],
          limitations: [
            'AI 추천 불가',
            '분석 기능 제한',
            '미팅 관리 제한'
          ]
        },
        {
          id: 'premium',
          name: 'Premium',
          price: 9900,
          period: '월',
          features: [
            '무제한 미팅 생성',
            'AI 장소 추천',
            '고급 분석 리포트',
            '미팅 이력 관리',
            '참여자 통계',
            '우선 고객 지원'
          ],
          recommended: true
        }
      ]
    }
  });
});

module.exports = router; 