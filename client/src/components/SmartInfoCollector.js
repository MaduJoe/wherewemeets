import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { 
  XMarkIcon, 
  GiftIcon, 
  StarIcon, 
  ShareIcon,
  DevicePhoneMobileIcon,
  EnvelopeIcon
} from '@heroicons/react/24/outline';

const SmartInfoCollector = ({ 
  isOpen, 
  onClose, 
  trigger, 
  onSuccess,
  title = "더 나은 서비스를 위해",
  subtitle = "간단한 정보만 입력하시면 됩니다"
}) => {
  const { userAnalytics } = useAuth();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: ''
  });
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // 사용자 가치 점수 계산 함수
  const getUserValueScore = () => {
    if (!userAnalytics) return 0;
    
    const visitScore = Math.min(userAnalytics.visitCount * 10, 50);
    const featureScore = Math.min(userAnalytics.featuresUsed.length * 5, 30);
    const recencyScore = userAnalytics.lastVisit ? 20 : 0;
    
    return visitScore + featureScore + recencyScore;
  };

  const collectionReasons = {
    'save-results': {
      icon: '💾',
      title: '결과를 저장하고 공유하기',
      subtitle: '나중에 다시 볼 수 있도록 결과를 저장해드릴게요',
      benefits: ['결과 영구 저장', '친구들과 쉬운 공유', '이력 관리'],
      required: ['email']
    },
    'premium-features': {
      icon: '⭐',
      title: '프리미엄 기능 이용하기',
      subtitle: '더 정확한 추천과 고급 기능을 사용해보세요',
      benefits: ['고급 AI 추천', '무제한 미팅 생성', '상세 분석'],
      required: ['name', 'email']
    },
    'share-invitation': {
      icon: '📲',
      title: '친구들에게 초대장 보내기',
      subtitle: '미팅 초대를 편리하게 전송해드릴게요',
      benefits: ['자동 초대 발송', '응답 상황 추적', 'SMS/이메일 알림'],
      required: ['name', 'phone']
    },
    'analytics-export': {
      icon: '📊',
      title: '상세 분석 보고서 받기',
      subtitle: '그룹의 선호도와 패턴을 분석해드릴게요',
      benefits: ['개인화된 인사이트', '미팅 최적화 팁', '주간 요약 리포트'],
      required: ['email']
    }
  };

  const currentReason = collectionReasons[trigger] || collectionReasons['save-results'];
  const valueScore = getUserValueScore();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // 필수 필드만 수집
      const requiredData = {};
      currentReason.required.forEach(field => {
        if (formData[field]) {
          requiredData[field] = formData[field];
        }
      });

      // collectOptionalInfo 함수가 없으므로 임시로 localStorage에 저장
      localStorage.setItem('userInfo', JSON.stringify(requiredData));
      
      // 성공 스텝으로 이동
      setStep(2);
      
      // 3초 후 콜백 실행하고 모달 닫기
      setTimeout(() => {
        onSuccess && onSuccess(requiredData);
        onClose();
        setStep(1);
        setFormData({ name: '', email: '', phone: '' });
      }, 2000);

    } catch (error) {
      console.error('정보 수집 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-md w-full mx-4 overflow-hidden shadow-2xl">
        
        {step === 1 && (
          <>
            {/* 헤더 */}
            <div className="bg-gradient-to-r from-primary-500 to-secondary-500 text-white p-6 relative">
              <button
                onClick={onClose}
                className="absolute top-4 right-4 text-white hover:text-gray-200"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
              
              <div className="text-center">
                <div className="text-4xl mb-2">{currentReason.icon}</div>
                <h3 className="text-xl font-bold">{currentReason.title}</h3>
                <p className="text-primary-100 mt-1">{currentReason.subtitle}</p>
              </div>
            </div>

            {/* 혜택 섹션 */}
            <div className="p-6">
              <div className="mb-6">
                <h4 className="font-semibold text-gray-900 mb-3 flex items-center">
                  <GiftIcon className="h-5 w-5 mr-2 text-primary-600" />
                  이런 혜택을 받으실 수 있어요
                </h4>
                <ul className="space-y-2">
                  {currentReason.benefits.map((benefit, index) => (
                    <li key={index} className="flex items-center text-sm text-gray-600">
                      <StarIcon className="h-4 w-4 text-yellow-500 mr-2 flex-shrink-0" />
                      {benefit}
                    </li>
                  ))}
                </ul>
              </div>

              {/* 사용자 가치 표시 */}
              {valueScore > 50 && (
                <div className="mb-6 p-3 bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-200 rounded-lg">
                  <div className="flex items-center">
                    <div className="text-2xl mr-3">🌟</div>
                    <div>
                      <h5 className="font-medium text-yellow-800">VIP 사용자님!</h5>
                      <p className="text-sm text-yellow-700">
                        활발한 이용에 감사드려요. 특별 혜택을 준비했습니다! 
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* 폼 */}
              <form onSubmit={handleSubmit} className="space-y-4">
                {currentReason.required.includes('name') && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      이름 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                      placeholder="홍길동"
                    />
                  </div>
                )}

                {currentReason.required.includes('email') && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      이메일 <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <EnvelopeIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                      <input
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleChange}
                        required
                        className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                        placeholder="example@email.com"
                      />
                    </div>
                  </div>
                )}

                {currentReason.required.includes('phone') && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      연락처 <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <DevicePhoneMobileIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                      <input
                        type="tel"
                        name="phone"
                        value={formData.phone}
                        onChange={handleChange}
                        required
                        className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                        placeholder="010-1234-5678"
                      />
                    </div>
                  </div>
                )}

                <div className="text-xs text-gray-500 bg-gray-50 p-3 rounded-lg">
                  🔒 개인정보는 안전하게 보호되며, 서비스 개선 목적으로만 사용됩니다.
                  언제든지 삭제 요청이 가능합니다.
                </div>

                <div className="flex space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={onClose}
                    className="flex-1 px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition duration-200"
                  >
                    나중에
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 px-4 py-2 bg-gradient-to-r from-primary-600 to-secondary-600 text-white rounded-lg hover:from-primary-700 hover:to-secondary-700 transition duration-200 disabled:opacity-50"
                  >
                    {loading ? (
                      <div className="flex items-center justify-center">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        처리중...
                      </div>
                    ) : (
                      '계속하기'
                    )}
                  </button>
                </div>
              </form>
            </div>
          </>
        )}

        {step === 2 && (
          <div className="p-8 text-center">
            <div className="text-6xl mb-4">🎉</div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">완료되었습니다!</h3>
            <p className="text-gray-600 mb-4">
              정보가 안전하게 저장되었습니다.<br />
              이제 {currentReason.title.toLowerCase()}을(를) 이용하실 수 있어요.
            </p>
            <div className="animate-pulse text-primary-600 text-sm">
              잠시만 기다려주세요...
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SmartInfoCollector; 