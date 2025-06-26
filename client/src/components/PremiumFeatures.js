import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import SocialLoginPrompt from './SocialLoginPrompt';
import {
  ChartBarIcon,
  SparklesIcon,
  ClockIcon,
  ShareIcon,
  BellIcon,
  UserGroupIcon,
  LockClosedIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline';

const PremiumFeatures = () => {
  const { user, userAnalytics } = useAuth();
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  const [selectedFeature, setSelectedFeature] = useState('');

  const premiumFeatures = [
    {
      id: 'dashboard',
      icon: <ChartBarIcon className="h-8 w-8" />,
      title: '개인 대시보드',
      description: '과거 모임 이력과 앞으로의 약속을 체계적으로 관리하세요',
      benefits: [
        '모든 미팅 기록 영구 보관',
        '다가오는 약속 자동 알림',
        '즐겨찾는 장소 북마크',
        '참가자별 통계 및 히스토리'
      ],
      color: 'from-blue-500 to-blue-600',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200'
    },
    {
      id: 'unlimited-ai',
      icon: <SparklesIcon className="h-8 w-8" />,
      title: 'AI 추천 무제한',
      description: '고급 AI 알고리즘으로 더 정확하고 개인화된 장소를 추천받으세요',
      benefits: [
        '일일 사용 제한 없음',
        '개인 취향 학습 및 맞춤 추천',
        '실시간 교통/날씨 정보 반영',
        '우선 처리로 빠른 응답'
      ],
      color: 'from-purple-500 to-purple-600',
      bgColor: 'bg-purple-50',
      borderColor: 'border-purple-200'
    },
    {
      id: 'smart-insights',
      icon: <UserGroupIcon className="h-8 w-8" />,
      title: '스마트 그룹 인사이트',
      description: '그룹의 선호도 패턴을 분석하여 완벽한 미팅을 만들어보세요',
      benefits: [
        '그룹 선호도 패턴 분석 리포트',
        '개인별 취향 및 성향 인사이트',
        '성공한 미팅 패턴 학습',
        '맞춤형 장소 큐레이션'
      ],
      color: 'from-green-500 to-green-600',
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200'
    },
    {
      id: 'premium-sharing',
      icon: <ShareIcon className="h-8 w-8" />,
      title: '자동 공유 & 알림',
      description: '미팅 결과를 자동으로 공유하고 스마트한 알림을 받아보세요',
      benefits: [
        '카카오톡/문자 자동 공유',
        '출발 시간 및 교통상황 알림',
        '원클릭 예약 및 결제 연동',
        '참가자 자동 초대 시스템'
      ],
      color: 'from-orange-500 to-orange-600',
      bgColor: 'bg-orange-50',
      borderColor: 'border-orange-200'
    }
  ];

  const handleFeatureClick = (featureId) => {
    if (!user || user.isGuest) {
      setSelectedFeature(featureId);
      setShowLoginPrompt(true);
    } else {
      // 이미 로그인된 사용자는 해당 기능으로 이동
      console.log(`${featureId} 기능으로 이동`);
    }
  };

  const currentPlan = user?.subscription || 'free';

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          🌟 프리미엄 기능으로 업그레이드
        </h2>
        <p className="text-gray-600">
          더 스마트하고 편리한 미팅 계획을 경험해보세요
        </p>
      </div>

      {/* 현재 사용량 표시 (게스트 사용자만) */}
      {user?.isGuest && (
        <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium text-yellow-800">현재 무료 체험 중</h4>
              <p className="text-sm text-yellow-700">
                AI 추천: {userAnalytics.featuresUsed?.length || 0}/5회 사용
              </p>
            </div>
            <button
              onClick={() => setShowLoginPrompt(true)}
              className="bg-yellow-500 text-white px-4 py-2 rounded-lg hover:bg-yellow-600 transition duration-200"
            >
              제한 해제하기
            </button>
          </div>
        </div>
      )}

      {/* 프리미엄 기능 카드들 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {premiumFeatures.map((feature) => (
          <div
            key={feature.id}
            className={`relative p-6 rounded-xl border-2 ${feature.bgColor} ${feature.borderColor} hover:shadow-lg transition-all duration-300 cursor-pointer transform hover:scale-105`}
            onClick={() => handleFeatureClick(feature.id)}
          >
            {/* 프리미엄 뱃지 */}
            {user?.isGuest && (
              <div className="absolute -top-2 -right-2 bg-gradient-to-r from-yellow-400 to-orange-500 text-white text-xs font-bold px-2 py-1 rounded-full flex items-center">
                <LockClosedIcon className="h-3 w-3 mr-1" />
                PRO
              </div>
            )}

            {/* 이미 구독 중인 경우 체크 표시 */}
            {currentPlan === 'premium' && (
              <div className="absolute -top-2 -right-2 bg-green-500 text-white rounded-full p-1">
                <CheckCircleIcon className="h-4 w-4" />
              </div>
            )}

            <div className={`inline-flex p-3 rounded-lg bg-gradient-to-r ${feature.color} text-white mb-4`}>
              {feature.icon}
            </div>

            <h3 className="text-xl font-bold text-gray-900 mb-2">
              {feature.title}
            </h3>
            
            <p className="text-gray-600 mb-4 text-sm">
              {feature.description}
            </p>

            <ul className="space-y-2">
              {feature.benefits.map((benefit, index) => (
                <li key={index} className="flex items-center text-sm text-gray-700">
                  <CheckCircleIcon className="h-4 w-4 text-green-500 mr-2 flex-shrink-0" />
                  {benefit}
                </li>
              ))}
            </ul>

            {user?.isGuest && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <button className={`w-full py-2 px-4 rounded-lg font-medium transition duration-200 bg-gradient-to-r ${feature.color} text-white hover:opacity-90`}>
                  사용해보기
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* 가격 정보 */}
      <div className="mt-8 p-6 bg-gradient-to-r from-gray-50 to-blue-50 rounded-xl border">
        <div className="text-center">
          <h3 className="text-xl font-bold text-gray-900 mb-2">
            🎯 프리미엄 플랜
          </h3>
          <div className="text-3xl font-bold text-blue-600 mb-2">
            월 ₩9,900
            <span className="text-lg text-gray-500 font-normal">/월</span>
          </div>
          <p className="text-sm text-gray-600 mb-4">
            언제든지 취소 가능 • 첫 7일 무료 체험
          </p>
          
          {user?.isGuest ? (
            <button
              onClick={() => setShowLoginPrompt(true)}
              className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-8 py-3 rounded-lg font-semibold hover:from-blue-700 hover:to-purple-700 transition duration-200"
            >
              7일 무료로 시작하기
            </button>
          ) : (
            <div className="text-green-600 font-medium">
              ✅ 현재 {currentPlan === 'premium' ? '프리미엄' : '무료'} 플랜 사용 중
            </div>
          )}
        </div>
      </div>

      {/* 소셜 로그인 프롬프트 */}
      <SocialLoginPrompt
        isOpen={showLoginPrompt}
        onClose={() => setShowLoginPrompt(false)}
        trigger="premium-features"
      />
    </div>
  );
};

export default PremiumFeatures; 