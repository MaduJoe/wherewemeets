import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

const SocialLoginPrompt = ({ 
  isOpen, 
  onClose, 
  trigger,
  title = "친구들과 함께하기",
  subtitle = "간편하게 로그인하고 함께 계획해보세요"
}) => {
  const { user, upgradeToPremium } = useAuth();
  const [loading, setLoading] = useState('');

  const loginReasons = {
    'share-meeting': {
      icon: '🤝',
      title: '친구들과 미팅 공유하기',
      subtitle: '생성한 미팅을 친구들에게 공유하고 함께 결정해보세요',
      benefits: [
        '실시간 친구 초대 및 응답 확인',
        '공동 투표 및 의견 취합',
        '결과 자동 알림 및 공유'
      ]
    },
    'save-results': {
      icon: '💾',
      title: '결과를 영구 저장하기',
      subtitle: '미팅 계획과 결과를 안전하게 보관하세요',
      benefits: [
        '모든 기기에서 접근 가능',
        '미팅 히스토리 관리',
        '즐겨찾는 장소 저장'
      ]
    },
    'premium-features': {
      icon: '⭐',
      title: '프리미엄 기능 이용하기',
      subtitle: '더 정확한 AI 추천과 고급 분석을 경험해보세요',
      benefits: [
        '고급 AI 개인화 추천',
        '상세한 그룹 분석 리포트',
        '무제한 미팅 생성'
      ]
    }
  };

  const currentReason = loginReasons[trigger] || loginReasons['share-meeting'];

  const handleSocialLogin = async (provider) => {
    setLoading(provider);
    
    try {
      // AuthContext의 upgradeToPremium 함수 사용
      const result = await upgradeToPremium(provider, 'premium');
      
      if (result.success) {
        onClose();
      } else {
        console.error(`${provider} 로그인 실패:`, result.error);
      }
      
    } catch (error) {
      console.error(`${provider} 로그인 실패:`, error);
    } finally {
      setLoading('');
    }
  };

  const socialProviders = [
    {
      id: 'kakao',
      name: '카카오',
      icon: '💬',
      bgColor: 'bg-yellow-400 hover:bg-yellow-500',
      textColor: 'text-black'
    },
    {
      id: 'google',
      name: '구글',
      icon: '🌐',
      bgColor: 'bg-white hover:bg-gray-50 border border-gray-300',
      textColor: 'text-gray-700'
    },
    {
      id: 'naver',
      name: '네이버',
      icon: '🟢',
      bgColor: 'bg-green-500 hover:bg-green-600',
      textColor: 'text-white'
    }
  ];

  if (!isOpen || user?.isGuest === false) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-md w-full mx-4 overflow-hidden shadow-2xl">
        
        {/* 헤더 */}
        <div className="bg-gradient-to-r from-blue-500 to-purple-500 text-white p-6 relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-white hover:text-gray-200 text-2xl"
          >
            ×
          </button>
          
          <div className="text-center">
            <div className="text-4xl mb-2">{currentReason.icon}</div>
            <h3 className="text-xl font-bold">{currentReason.title}</h3>
            <p className="text-blue-100 mt-1">{currentReason.subtitle}</p>
          </div>
        </div>

        <div className="p-6">
          {/* 혜택 설명 */}
          <div className="mb-6">
            <h4 className="font-semibold text-gray-900 mb-3">
              🎁 로그인하면 이런 것들이 가능해져요
            </h4>
            <ul className="space-y-2">
              {currentReason.benefits.map((benefit, index) => (
                <li key={index} className="flex items-center text-sm text-gray-600">
                  <span className="text-green-500 mr-2">✓</span>
                  {benefit}
                </li>
              ))}
            </ul>
          </div>

          {/* 소셜 로그인 버튼들 */}
          <div className="space-y-3">
            <h5 className="text-sm font-medium text-gray-700 text-center mb-4">
              간편하게 3초만에 시작하세요
            </h5>
            
            {socialProviders.map((provider) => (
              <button
                key={provider.id}
                onClick={() => handleSocialLogin(provider.id)}
                disabled={loading === provider.id}
                className={`w-full py-3 px-4 rounded-lg font-medium transition duration-200 flex items-center justify-center ${provider.bgColor} ${provider.textColor}`}
              >
                {loading === provider.id ? (
                  <div className="flex items-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
                    연결 중...
                  </div>
                ) : (
                  <div className="flex items-center">
                    <span className="text-xl mr-3">{provider.icon}</span>
                    {provider.name}로 계속하기
                  </div>
                )}
              </button>
            ))}
          </div>

          {/* 게스트 계속 사용 옵션 */}
          <div className="mt-6 pt-4 border-t border-gray-200">
            <button
              onClick={onClose}
              className="w-full text-gray-500 hover:text-gray-700 text-sm transition duration-200"
            >
              나중에 하기 (게스트로 계속 사용)
            </button>
          </div>

          {/* 안내 메시지 */}
          <div className="mt-4 text-xs text-gray-500 text-center bg-gray-50 p-3 rounded-lg">
            🔒 로그인 정보는 안전하게 보호되며, 스팸이나 불필요한 알림을 보내지 않습니다.
          </div>
        </div>
      </div>
    </div>
  );
};

export default SocialLoginPrompt; 