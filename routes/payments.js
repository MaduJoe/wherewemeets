const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { auth } = require('../middleware/auth');
const User = require('../models/User');

const router = express.Router();

// 구독 플랜 정보
const PLANS = {
  premium: {
    name: 'Premium',
    price: 9900, // 원 (9,900원)
    features: ['무제한 미팅 생성', '고급 장소 추천', '이메일 알림']
  },
  pro: {
    name: 'Pro',
    price: 19900, // 원 (19,900원)
    features: ['모든 Premium 기능', '팀 관리', '분석 리포트', '우선 고객지원']
  }
};

// 결제 인텐트 생성
router.post('/create-payment-intent', auth, async (req, res) => {
  try {
    const { plan } = req.body;
    
    if (!PLANS[plan]) {
      return res.status(400).json({ message: '유효하지 않은 플랜입니다.' });
    }

    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ message: '사용자를 찾을 수 없습니다.' });
    }

    // Stripe Payment Intent 생성
    const paymentIntent = await stripe.paymentIntents.create({
      amount: PLANS[plan].price,
      currency: 'krw',
      metadata: {
        userId: user._id.toString(),
        plan: plan
      }
    });

    res.json({
      clientSecret: paymentIntent.client_secret,
      plan: PLANS[plan]
    });
  } catch (error) {
    console.error('Payment intent creation error:', error);
    res.status(500).json({ message: '결제 처리 중 오류가 발생했습니다.' });
  }
});

// 결제 성공 처리
router.post('/confirm-payment', auth, async (req, res) => {
  try {
    const { paymentIntentId, plan } = req.body;

    // Stripe에서 결제 확인
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    
    if (paymentIntent.status !== 'succeeded') {
      return res.status(400).json({ message: '결제가 완료되지 않았습니다.' });
    }

    // 사용자 구독 업데이트
    const user = await User.findById(req.userId);
    user.subscription = plan;
    user.subscriptionEndDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30일
    await user.save();

    res.json({ 
      message: '구독이 성공적으로 활성화되었습니다.',
      subscription: {
        plan: user.subscription,
        endDate: user.subscriptionEndDate
      }
    });
  } catch (error) {
    console.error('Payment confirmation error:', error);
    res.status(500).json({ message: '결제 확인 중 오류가 발생했습니다.' });
  }
});

// 구독 플랜 정보 조회
router.get('/plans', (req, res) => {
  res.json(PLANS);
});

// 결제 내역 조회
router.get('/history', auth, async (req, res) => {
  try {
    // 실제로는 결제 내역을 별도 모델에 저장해야 함
    // 여기서는 간단히 사용자의 구독 정보만 반환
    const user = await User.findById(req.userId).select('subscription subscriptionEndDate');
    res.json(user);
  } catch (error) {
    console.error('Payment history error:', error);
    res.status(500).json({ message: '결제 내역 조회 중 오류가 발생했습니다.' });
  }
});

module.exports = router; 