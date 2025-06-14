import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  ChartBarIcon,
  CurrencyDollarIcon,
  UserGroupIcon,
  TrendingUpIcon,
  EnvelopeIcon,
  DevicePhoneMobileIcon,
  MapPinIcon,
  SparklesIcon
} from '@heroicons/react/24/outline';

const MonetizationDashboard = () => {
  const { userAnalytics, getUserValueScore } = useAuth();
  const [revenueOpportunities, setRevenueOpportunities] = useState([]);
  const [partnershipData, setPartnershipData] = useState({});

  useEffect(() => {
    calculateRevenueOpportunities();
    loadPartnershipData();
  }, [userAnalytics]);

  const calculateRevenueOpportunities = () => {
    const opportunities = [];
    const score = getUserValueScore();

    // 프리미엄 기능 업그레이드 기회
    if (score > 30 && userAnalytics.featuresUsed.length > 3) {
      opportunities.push({
        type: 'premium-upgrade',
        title: '프리미엄 구독',
        potential: '월 ₩9,900',
        probability: Math.min(score, 85) + '%',
        description: '고급 AI 추천, 무제한 미팅, 상세 분석 제공',
        icon: '⭐',
        color: 'yellow'
      });
    }

    // 비즈니스 플랜 기회
    if (userAnalytics.meetingsCreated > 2) {
      opportunities.push({
        type: 'business-plan',
        title: '비즈니스 플랜',
        potential: '월 ₩29,900',
        probability: '45%',
        description: '팀 협업 도구, 고급 분석, 브랜딩 옵션',
        icon: '🏢',
        color: 'blue'
      });
    }

    // 광고 수익 기회
    if (userAnalytics.visitCount > 3) {
      opportunities.push({
        type: 'ad-revenue',
        title: '위치 기반 광고',
        potential: '클릭당 ₩200',
        probability: '65%',
        description: '추천 장소와 관련된 맞춤형 광고 수익',
        icon: '📍',
        color: 'green'
      });
    }

    // 제휴 수수료 기회
    opportunities.push({
      type: 'affiliate',
      title: '제휴 예약 수수료',
      potential: '예약당 3-5%',
      probability: '70%',
      description: '레스토랑, 카페 예약 시 제휴 수수료',
      icon: '🤝',
      color: 'purple'
    });

    setRevenueOpportunities(opportunities);
  };

  const loadPartnershipData = () => {
    // 시뮬레이션된 제휴 데이터
    setPartnershipData({
      restaurants: {
        count: 1250,
        revenue: '₩850,000',
        growth: '+15%'
      },
      cafes: {
        count: 890,
        revenue: '₩420,000',
        growth: '+22%'
      },
      entertainment: {
        count: 340,
        revenue: '₩280,000',
        growth: '+8%'
      }
    });
  };

  const getColorClasses = (color) => {
    const colors = {
      yellow: 'bg-yellow-50 border-yellow-200 text-yellow-800',
      blue: 'bg-blue-50 border-blue-200 text-blue-800',
      green: 'bg-green-50 border-green-200 text-green-800',
      purple: 'bg-purple-50 border-purple-200 text-purple-800'
    };
    return colors[color] || colors.blue;
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center mb-6">
        <CurrencyDollarIcon className="h-6 w-6 text-green-600 mr-2" />
        <h3 className="text-lg font-semibold text-gray-900">수익화 대시보드</h3>
        <span className="ml-2 text-sm text-gray-500">(로그인 없는 전략)</span>
      </div>

      {/* 사용자 가치 점수 */}
      <div className="mb-8 p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border">
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-medium text-gray-900 flex items-center">
            <TrendingUpIcon className="h-5 w-5 mr-2 text-blue-600" />
            현재 사용자 가치 점수
          </h4>
          <div className="text-2xl font-bold text-blue-600">
            {getUserValueScore()}/100
          </div>
        </div>
        
        <div className="w-full bg-gray-200 rounded-full h-3 mb-3">
          <div
            className="bg-gradient-to-r from-blue-500 to-purple-500 h-3 rounded-full transition-all duration-500"
            style={{ width: `${getUserValueScore()}%` }}
          ></div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div className="text-center">
            <div className="font-medium text-gray-600">방문 횟수</div>
            <div className="text-lg font-bold text-blue-600">{userAnalytics.visitCount}</div>
          </div>
          <div className="text-center">
            <div className="font-medium text-gray-600">기능 사용</div>
            <div className="text-lg font-bold text-purple-600">{userAnalytics.featuresUsed.length}</div>
          </div>
          <div className="text-center">
            <div className="font-medium text-gray-600">미팅 생성</div>
            <div className="text-lg font-bold text-green-600">{userAnalytics.meetingsCreated}</div>
          </div>
          <div className="text-center">
            <div className="font-medium text-gray-600">정보 제공</div>
            <div className="text-lg font-bold text-yellow-600">
              {userAnalytics.userInfo?.hasEmail ? '✓' : '✗'}
            </div>
          </div>
        </div>
      </div>

      {/* 수익화 기회 */}
      <div className="mb-8">
        <h4 className="font-medium text-gray-900 mb-4 flex items-center">
          <SparklesIcon className="h-5 w-5 mr-2 text-yellow-600" />
          현재 수익화 기회
        </h4>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {revenueOpportunities.map((opportunity, index) => (
            <div
              key={index}
              className={`p-4 rounded-lg border-2 ${getColorClasses(opportunity.color)}`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center">
                  <span className="text-2xl mr-3">{opportunity.icon}</span>
                  <div>
                    <h5 className="font-semibold">{opportunity.title}</h5>
                    <p className="text-sm opacity-75">{opportunity.description}</p>
                  </div>
                </div>
              </div>
              
              <div className="flex justify-between items-center">
                <div>
                  <div className="text-sm font-medium">수익 잠재력</div>
                  <div className="font-bold">{opportunity.potential}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium">전환 확률</div>
                  <div className="font-bold">{opportunity.probability}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 제휴 수익 현황 */}
      <div className="mb-8">
        <h4 className="font-medium text-gray-900 mb-4 flex items-center">
          <MapPinIcon className="h-5 w-5 mr-2 text-green-600" />
          제휴 파트너 수익 현황
        </h4>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
            <div className="flex items-center mb-2">
              <span className="text-2xl mr-2">🍽️</span>
              <h5 className="font-semibold text-orange-800">레스토랑</h5>
            </div>
            <div className="text-sm text-orange-700 space-y-1">
              <div>제휴사: {partnershipData.restaurants?.count}개</div>
              <div>월 수익: {partnershipData.restaurants?.revenue}</div>
              <div className="text-green-600 font-medium">
                성장률: {partnershipData.restaurants?.growth}
              </div>
            </div>
          </div>

          <div className="bg-brown-50 p-4 rounded-lg border border-yellow-800/20">
            <div className="flex items-center mb-2">
              <span className="text-2xl mr-2">☕</span>
              <h5 className="font-semibold text-yellow-800">카페</h5>
            </div>
            <div className="text-sm text-yellow-700 space-y-1">
              <div>제휴사: {partnershipData.cafes?.count}개</div>
              <div>월 수익: {partnershipData.cafes?.revenue}</div>
              <div className="text-green-600 font-medium">
                성장률: {partnershipData.cafes?.growth}
              </div>
            </div>
          </div>

          <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
            <div className="flex items-center mb-2">
              <span className="text-2xl mr-2">🎮</span>
              <h5 className="font-semibold text-purple-800">오락시설</h5>
            </div>
            <div className="text-sm text-purple-700 space-y-1">
              <div>제휴사: {partnershipData.entertainment?.count}개</div>
              <div>월 수익: {partnershipData.entertainment?.revenue}</div>
              <div className="text-green-600 font-medium">
                성장률: {partnershipData.entertainment?.growth}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 정보 수집 전략 */}
      <div className="mb-6">
        <h4 className="font-medium text-gray-900 mb-4 flex items-center">
          <UserGroupIcon className="h-5 w-5 mr-2 text-blue-600" />
          스마트 정보 수집 전략
        </h4>
        
        <div className="bg-gray-50 p-4 rounded-lg">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h5 className="font-medium text-gray-900 mb-2">📧 이메일 수집 포인트</h5>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• 결과 저장 및 공유 시</li>
                <li>• 프리미엄 기능 체험 시</li>
                <li>• 상세 분석 리포트 요청 시</li>
                <li>• 미팅 결과 알림 설정 시</li>
              </ul>
            </div>
            <div>
              <h5 className="font-medium text-gray-900 mb-2">📱 연락처 수집 포인트</h5>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• 친구 초대 기능 사용 시</li>
                <li>• SMS 알림 설정 시</li>
                <li>• 위치 기반 추천 개선 시</li>
                <li>• 실시간 미팅 알림 요청 시</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* 수익 예측 */}
      <div className="bg-gradient-to-r from-green-50 to-blue-50 p-6 rounded-lg border border-green-200">
        <h4 className="font-medium text-gray-900 mb-4 flex items-center">
          <ChartBarIcon className="h-5 w-5 mr-2 text-green-600" />
          예상 월간 수익
        </h4>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold text-green-600">₩1.2M</div>
            <div className="text-sm text-gray-600">제휴 수수료</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-blue-600">₩850K</div>
            <div className="text-sm text-gray-600">프리미엄 구독</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-purple-600">₩400K</div>
            <div className="text-sm text-gray-600">광고 수익</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-yellow-600">₩300K</div>
            <div className="text-sm text-gray-600">비즈니스 플랜</div>
          </div>
        </div>
        
        <div className="mt-4 text-center">
          <div className="text-3xl font-bold text-gray-900">총 ₩2.75M</div>
          <div className="text-sm text-gray-600">예상 월간 수익 (로그인 없는 모델)</div>
        </div>
      </div>

      {/* 추천 액션 */}
      <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
        <h5 className="font-medium text-yellow-800 mb-2">💡 수익화 최적화 제안</h5>
        <ul className="text-sm text-yellow-700 space-y-1">
          <li>• 가치 있는 순간에 정보 수집을 자연스럽게 유도</li>
          <li>• 위치 기반 제휴 파트너십 확대로 수수료 수익 증대</li>
          <li>• 프리미엄 기능의 체험 기회를 늘려 전환율 향상</li>
          <li>• 사용 패턴 분석을 통한 개인화된 수익화 전략 적용</li>
        </ul>
      </div>
    </div>
  );
};

export default MonetizationDashboard; 