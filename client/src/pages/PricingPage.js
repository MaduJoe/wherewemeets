import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { loadTossPayments } from '@tosspayments/tosspayments-sdk';

const PricingPage = () => {
  const [paymentWidget, setPaymentWidget] = useState(null);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();

  const clientKey = process.env.REACT_APP_TOSS_CLIENT_KEY;
  const customerKey = user?.id || 'anonymous-' + Date.now();

  // 플랜 정보
  const plans = {
    premium: {
      name: 'Premium',
      price: 9900,
      features: ['무제한 미팅 생성', '고급 장소 추천', '이메일 알림']
    },
    pro: {
      name: 'Pro', 
      price: 19900,
      features: ['모든 Premium 기능', '팀 관리', '분석 리포트', '우선 고객지원']
    }
  };

  // 토스페이먼츠 초기화
  useEffect(() => {
    const initializePaymentWidget = async () => {
      try {
        const tossPayments = await loadTossPayments(clientKey);
        const widgets = tossPayments.widgets({ customerKey });
        setPaymentWidget(widgets);
      } catch (error) {
        console.error('토스페이먼츠 초기화 실패:', error);
      }
    };

    if (clientKey && user) {
      initializePaymentWidget();
    }
  }, [clientKey, customerKey, user]);

  // 결제 시작
  const handleSelectPlan = async (planType) => {
    if (!user) {
      alert('로그인이 필요합니다.');
      navigate('/login');
      return;
    }

    if (!paymentWidget) {
      alert('결제 시스템을 초기화하는 중입니다. 잠시 후 다시 시도해주세요.');
      return;
    }

    setSelectedPlan(planType);
    setIsLoading(true);

    try {
      const plan = plans[planType];
      const orderId = `order-${user.id}-${Date.now()}`;

      // 결제 금액 설정
      await paymentWidget.setAmount({
        value: plan.price,
        currency: 'KRW'
      });

      // 결제위젯 렌더링
      await paymentWidget.renderPaymentMethods({
        selector: '#payment-widget',
        variantKey: 'DEFAULT'
      });

      // 이용약관 렌더링
      await paymentWidget.renderAgreement({
        selector: '#agreement'
      });

      // 결제 창 열기를 위한 버튼 이벤트 처리
      window.requestPayment = () => {
        paymentWidget.requestPayment({
          orderId,
          orderName: `${plan.name} 구독`,
          customerName: user.name || user.email,
          customerEmail: user.email,
          successUrl: `${window.location.origin}/payment/success?plan=${planType}`,
          failUrl: `${window.location.origin}/payment/fail`
        });
      };

    } catch (error) {
      console.error('결제 초기화 실패:', error);
      alert('결제 초기화에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setIsLoading(false);
    }
  };

  // 결제 취소
  const handleCancelPayment = () => {
    setSelectedPlan(null);
    setPaymentWidget(null);
    
    // 결제위젯 재초기화
    const initializePaymentWidget = async () => {
      try {
        const tossPayments = await loadTossPayments(clientKey);
        const widgets = tossPayments.widgets({ customerKey });
        setPaymentWidget(widgets);
      } catch (error) {
        console.error('토스페이먼츠 재초기화 실패:', error);
      }
    };

    if (clientKey && user) {
      initializePaymentWidget();
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            요금제 선택
          </h1>
          <p className="text-lg text-gray-600">
            나에게 맞는 플랜을 선택하고 더 많은 기능을 이용해보세요
          </p>
        </div>

        {!selectedPlan ? (
          // 플랜 선택 화면
          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {Object.entries(plans).map(([planType, plan]) => (
              <div key={planType} className="bg-white rounded-lg shadow-lg p-8 border-2 border-gray-200 hover:border-blue-500 transition-colors">
                <div className="text-center mb-6">
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">{plan.name}</h3>
                  <div className="text-4xl font-bold text-blue-600 mb-1">
                    {plan.price.toLocaleString()}원
                  </div>
                  <p className="text-gray-500">월 구독료</p>
                </div>
                
                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="flex items-center">
                      <svg className="w-5 h-5 text-green-500 mr-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      <span className="text-gray-700">{feature}</span>
                    </li>
                  ))}
                </ul>
                
                <button
                  onClick={() => handleSelectPlan(planType)}
                  disabled={isLoading}
                  className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {isLoading ? '초기화 중...' : '이 플랜 선택'}
                </button>
              </div>
            ))}
          </div>
        ) : (
          // 결제 화면
          <div className="max-w-2xl mx-auto">
            <div className="bg-white rounded-lg shadow-lg p-8">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900">
                  {plans[selectedPlan].name} 구독 결제
                </h2>
                <button
                  onClick={handleCancelPayment}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-medium">월 구독료</span>
                  <span className="text-2xl font-bold text-blue-600">
                    {plans[selectedPlan].price.toLocaleString()}원
                  </span>
                </div>
              </div>

              {/* 토스페이먼츠 결제위젯 */}
              <div id="payment-widget" className="mb-6"></div>
              
              {/* 이용약관 */}
              <div id="agreement" className="mb-6"></div>

              {/* 결제하기 버튼 */}
              <button
                onClick={() => window.requestPayment && window.requestPayment()}
                className="w-full bg-blue-600 text-white py-4 px-6 rounded-lg font-semibold text-lg hover:bg-blue-700 transition-colors"
              >
                {plans[selectedPlan].price.toLocaleString()}원 결제하기
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PricingPage; 