import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { CheckIcon } from '@heroicons/react/24/outline';
import { loadStripe } from '@stripe/stripe-js';
import axios from 'axios';
import toast from 'react-hot-toast';

const stripePromise = loadStripe(
  process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY || 
  'pk_test_51234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'
);

const PricingPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [plans, setPlans] = useState({});

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    try {
      const response = await axios.get('/api/payments/plans');
      setPlans(response.data);
    } catch (error) {
      console.error('요금제 정보 조회 실패:', error);
    }
  };

  const handleUpgrade = async (planType) => {
    if (!user) {
      toast.error('로그인이 필요합니다.');
      navigate('/login');
      return;
    }

    if (user.subscription === planType) {
      toast.info('이미 해당 플랜을 사용 중입니다.');
      return;
    }

    setLoading(true);
    
    try {
      // 결제 인텐트 생성
      const response = await axios.post('/api/payments/create-payment-intent', {
        plan: planType
      });

      const { clientSecret } = response.data;
      const stripe = await stripePromise;

      // 간단한 결제 플로우 (실제로는 결제 폼이 필요)
      const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card: {
            number: '4242424242424242',
            exp_month: 12,
            exp_year: 2025,
            cvc: '123',
          },
        },
      });

      if (error) {
        toast.error('결제 실패: ' + error.message);
      } else if (paymentIntent.status === 'succeeded') {
        // 결제 성공 처리
        await axios.post('/api/payments/confirm-payment', {
          paymentIntentId: paymentIntent.id,
          plan: planType
        });

        toast.success('구독이 성공적으로 업그레이드되었습니다!');
        window.location.reload(); // 사용자 정보 새로고침
      }
    } catch (error) {
      console.error('결제 오류:', error);
      toast.error('결제 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const pricingTiers = [
    {
      name: 'Free',
      price: 0,
      description: '개인 사용자를 위한 기본 플랜',
      features: [
        '월 3개 미팅 생성',
        '기본 장소 추천',
        '최대 5명 참가자',
        '이메일 지원'
      ],
      limitations: [
        '고급 필터링 제한',
        '분석 리포트 없음'
      ],
      buttonText: user?.subscription === 'free' ? '현재 플랜' : '무료 시작',
      buttonAction: () => {
        if (!user) navigate('/register');
      },
      popular: false
    },
    {
      name: 'Premium',
      price: plans.premium?.price || 9900,
      description: '개인 및 소규모 팀을 위한 고급 플랜',
      features: [
        '무제한 미팅 생성',
        '고급 장소 추천 알고리즘',
        '최대 15명 참가자',
        '실시간 이동 시간 계산',
        '카테고리별 필터링',
        '이메일 알림',
        '우선 고객지원'
      ],
      buttonText: user?.subscription === 'premium' ? '현재 플랜' : '업그레이드',
      buttonAction: () => handleUpgrade('premium'),
      popular: true
    },
    {
      name: 'Pro',
      price: plans.pro?.price || 19900,
      description: '기업 및 대규모 팀을 위한 프로 플랜',
      features: [
        '모든 Premium 기능',
        '무제한 참가자',
        '팀 관리 기능',
        '상세 분석 리포트',
        '맞춤형 브랜딩',
        'API 접근',
        '24/7 전화 지원',
        '계정 매니저 배정'
      ],
      buttonText: user?.subscription === 'pro' ? '현재 플랜' : '업그레이드',
      buttonAction: () => handleUpgrade('pro'),
      popular: false
    }
  ];

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-16">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            요금제 선택
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            필요에 맞는 플랜을 선택하고 더 많은 기능을 이용해보세요
          </p>
          {user && (
            <div className="inline-flex items-center px-4 py-2 bg-primary-100 text-primary-800 rounded-full">
              현재 플랜: <span className="font-semibold ml-1 capitalize">{user.subscription}</span>
            </div>
          )}
        </div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-3 gap-8 mb-16">
          {pricingTiers.map((tier, index) => (
            <div
              key={index}
              className={`bg-white rounded-lg shadow-lg overflow-hidden relative ${
                tier.popular ? 'ring-2 ring-primary-500 transform scale-105' : ''
              }`}
            >
              {tier.popular && (
                <div className="absolute top-0 left-0 right-0 bg-primary-500 text-white text-center py-2 text-sm font-semibold">
                  가장 인기
                </div>
              )}
              
              <div className={`p-8 ${tier.popular ? 'pt-12' : ''}`}>
                <h3 className="text-2xl font-bold text-gray-900 mb-2">{tier.name}</h3>
                <p className="text-gray-600 mb-6">{tier.description}</p>
                
                <div className="mb-6">
                  <span className="text-4xl font-bold text-gray-900">
                    {tier.price.toLocaleString()}원
                  </span>
                  <span className="text-gray-600">/월</span>
                </div>

                <ul className="space-y-3 mb-8">
                  {tier.features.map((feature, featureIndex) => (
                    <li key={featureIndex} className="flex items-center">
                      <CheckIcon className="h-5 w-5 text-green-500 mr-3" />
                      <span className="text-gray-700">{feature}</span>
                    </li>
                  ))}
                  {tier.limitations?.map((limitation, limitIndex) => (
                    <li key={limitIndex} className="flex items-center text-gray-400">
                      <CheckIcon className="h-5 w-5 text-gray-300 mr-3" />
                      <span className="line-through">{limitation}</span>
                    </li>
                  ))}
                </ul>

                <button
                  onClick={tier.buttonAction}
                  disabled={loading || (user?.subscription === tier.name.toLowerCase())}
                  className={`w-full py-3 px-4 rounded-lg font-semibold transition duration-200 ${
                    tier.popular
                      ? 'bg-primary-600 hover:bg-primary-700 text-white'
                      : user?.subscription === tier.name.toLowerCase()
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-gray-900 hover:bg-gray-800 text-white'
                  }`}
                >
                  {loading ? '처리 중...' : tier.buttonText}
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* FAQ Section */}
        <div className="bg-white rounded-lg shadow-lg p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">
            자주 묻는 질문
          </h2>
          <div className="grid md:grid-cols-2 gap-8">
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">언제든지 플랜을 변경할 수 있나요?</h3>
              <p className="text-gray-600">네, 언제든지 플랜을 업그레이드하거나 다운그레이드할 수 있습니다. 변경 사항은 즉시 적용됩니다.</p>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">무료 플랜으로도 충분히 사용할 수 있나요?</h3>
              <p className="text-gray-600">무료 플랜으로도 기본적인 미팅 조율 기능을 충분히 이용할 수 있습니다. 더 많은 기능이 필요한 경우 유료 플랜을 고려해보세요.</p>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">결제는 안전한가요?</h3>
              <p className="text-gray-600">모든 결제는 Stripe를 통해 안전하게 처리되며, 카드 정보는 저장되지 않습니다.</p>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">환불 정책은 어떻게 되나요?</h3>
              <p className="text-gray-600">30일 무조건 환불 보장을 제공합니다. 만족하지 않으시면 전액 환불해드립니다.</p>
            </div>
          </div>
        </div>

        {/* Contact Section */}
        <div className="text-center mt-16">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            더 궁금한 점이 있으신가요?
          </h2>
          <p className="text-gray-600 mb-6">
            우리 팀이 도와드리겠습니다. 언제든지 문의해주세요.
          </p>
          <a
            href="mailto:support@wherewemeets.com"
            className="bg-primary-600 hover:bg-primary-700 text-white px-6 py-3 rounded-lg font-semibold transition duration-200"
          >
            문의하기
          </a>
        </div>
      </div>
    </div>
  );
};

export default PricingPage; 