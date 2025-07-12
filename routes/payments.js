const express = require('express');
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

// 토스페이먼츠 결제 승인
router.post('/toss/confirm', auth, async (req, res) => {
  try {
    const { paymentKey, orderId, amount, plan } = req.body;
    
    if (!PLANS[plan]) {
      return res.status(400).json({ message: '유효하지 않은 플랜입니다.' });
    }

    // 토스페이먼츠 결제 승인 요청
    const tossResponse = await fetch('https://api.tosspayments.com/v1/payments/confirm', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(process.env.TOSS_SECRET_KEY + ':').toString('base64')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        paymentKey,
        orderId,
        amount
      })
    });

    const payment = await tossResponse.json();

    if (tossResponse.ok && payment.status === 'DONE') {
      // 결제 성공 - 구독 정보 업데이트
      const user = await User.findById(req.userId);
      user.subscription = plan;
      user.subscriptionEndDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30일
      await user.save();

      res.json({ 
        success: true,
        message: '결제가 완료되었습니다.',
        subscription: {
          plan: user.subscription,
          endDate: user.subscriptionEndDate
        }
      });
    } else {
      console.error('토스페이먼츠 결제 실패:', payment);
      res.status(400).json({ 
        error: payment.message || '결제 처리 중 오류가 발생했습니다.' 
      });
    }
  } catch (error) {
    console.error('Payment confirmation error:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// 결제 인텐트 생성 (기존 Stripe 코드 - 호환성을 위해 유지)
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

    // Stripe Payment Intent 생성 (더 이상 사용되지 않음)
    res.status(400).json({ message: 'Stripe 결제는 더 이상 지원되지 않습니다. 토스페이먼츠를 사용해주세요.' });
  } catch (error) {
    console.error('Payment intent creation error:', error);
    res.status(500).json({ message: '결제 처리 중 오류가 발생했습니다.' });
  }
});

// 결제 성공 처리 (기존 Stripe 코드 - 호환성을 위해 유지)
router.post('/confirm-payment', auth, async (req, res) => {
  try {
    res.status(400).json({ message: 'Stripe 결제는 더 이상 지원되지 않습니다. 토스페이먼츠를 사용해주세요.' });
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