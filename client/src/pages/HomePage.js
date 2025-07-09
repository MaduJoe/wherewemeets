import React, { useState, useLayoutEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import SmartInfoCollector from '../components/SmartInfoCollector';
import { 
  RocketLaunchIcon,
  SparklesIcon,
  ClockIcon,
  HeartIcon,
  ChatBubbleLeftRightIcon,
  PlayIcon,
  ArrowPathIcon,
  ChartBarIcon,
  LightBulbIcon
} from '@heroicons/react/24/outline';

const HomePage = () => {
  const { trackFeatureUsage, userAnalytics, user, isAuthenticated, loading } = useAuth();
  const [showInfoCollector, setShowInfoCollector] = useState(false);
  const [collectorTrigger, setCollectorTrigger] = useState('premium-features');

  // 페이지 로드 시 즉시 스크롤 최상단으로 이동
  useLayoutEffect(() => {
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, []);

  // 로딩 중일 때 로딩 스피너 표시
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 text-lg">WhereWeMeets 로딩 중...</p>
          <p className="text-gray-500 text-sm mt-2">잠시만 기다려주세요</p>
        </div>
      </div>
    );
  }

  // 디버그 정보 (개발 중에만 표시)
  console.log('HomePage 렌더링:', { loading, isAuthenticated, user });

  const handleStartTrial = (feature) => {
    trackFeatureUsage(`homepage_${feature}`);
    
    // 고가치 기능일 경우 정보 수집 유도
    if (feature === 'smart-planner' && userAnalytics.visitCount >= 2) {
      setCollectorTrigger('premium-features');
      setShowInfoCollector(true);
    }
  };

  const handleInfoCollectorSuccess = (data) => {
    console.log('사용자 정보 수집 완료:', data);
    // 여기서 추가 혜택 제공 가능
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      
      {/* 히어로 섹션 */}
      <section className="relative pt-20 pb-32 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-primary-600/10 to-secondary-600/10"></div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6">
              친구들과 만날 
              <span className="bg-gradient-to-r from-primary-600 to-secondary-600 bg-clip-text text-transparent">
                완벽한 장소
              </span>
              를 찾아보세요
            </h1>
            <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto leading-relaxed">
              AI가 분석하는 지능형 추천부터 공정한 랜덤 선정까지,<br/>
              모든 친구가 만족하는 만남의 장소를 쉽고 재미있게 결정하세요
            </p>
            
            {/* CTA 버튼 */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-8">
              <Link
                to="/meeting-planner"
                onClick={() => handleStartTrial('smart-planner')}
                className="bg-gradient-to-r from-primary-600 to-secondary-600 text-white px-8 py-4 rounded-full text-lg font-semibold hover:from-primary-700 hover:to-secondary-700 transition duration-200 transform hover:scale-105 shadow-lg flex items-center"
              >
                <PlayIcon className="h-8 w-8 mr-4" />
                {isAuthenticated && user?.subscription === 'premium' 
                  ? '나만의 AI 미팅 만들기' 
                  : '지금 무료로 시작하기'
                }
              </Link>
            </div>

            {/* 로그인/회원가입 버튼 섹션 */}
            {!isAuthenticated || user?.isGuest ? (
              <div className="mb-8">
                <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
                  <Link
                    to="/login"
                    className="bg-white text-primary-600 border-2 border-primary-600 px-6 py-3 rounded-full font-semibold hover:bg-primary-50 transition duration-200 transform hover:scale-105 shadow-md"
                  >
                    로그인
                  </Link>
                  <Link
                    to="/register"
                    className="bg-white text-primary-600 border-2 border-primary-600 px-6 py-3 rounded-full font-semibold hover:bg-primary-50 transition duration-200 transform hover:scale-105 shadow-md"

                  >
                    회원가입
                  </Link>
                </div>
                <p className="text-center text-sm text-gray-500 mt-3">
                  {user?.isGuest 
                    ? '게스트 모드입니다. 로그인하면 더 많은 기능을 이용할 수 있어요!'
                    : '로그인 없이도 모든 기능을 체험할 수 있습니다'
                  }
                </p>
              </div>
            ) : (
              <div className="mb-8">
                <p className="text-green-600 font-medium mb-4">
                  🎉 {user.name}님, 환영합니다! 
                  {user.subscription === 'premium' 
                    ? '모든 프리미엄 기능을 이용하세요' 
                    : '더 많은 기능을 이용하려면 프리미엄을 구독하세요'
                  }
                </p>
                {/* {user.subscription === 'premium' && (
                  <Link
                    to="/dashboard"
                    className="bg-gradient-to-r from-green-500 to-blue-500 text-white px-6 py-3 rounded-full font-semibold hover:from-green-600 hover:to-blue-600 transition duration-200 transform hover:scale-105 shadow-md"
                  >
                    내 대시보드로 이동
                  </Link>
                )} */}
              </div>
            )}

            {/* 실시간 통계 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-16">
              <div className="text-center">
                <div className="text-3xl font-bold text-primary-600">
                  {userAnalytics.visitCount + 1247}+
                </div>
                <div className="text-gray-600">누적 미팅 생성</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-secondary-600">98%</div>
                <div className="text-gray-600">사용자 만족도</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-green-600">
                  {Math.min(userAnalytics.featuresUsed.length + 4, 12)}
                </div>
                <div className="text-gray-600">평균 기능 사용</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 핵심 기능 소개 */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              왜 WhereWeMeets를 선택해야 할까요?
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              단순한 장소 검색을 넘어, 공정하고 즐거운 협업 의사결정 플랫폼
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {/* 지능형 AI 추천 */}
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-8 rounded-2xl border border-blue-200 hover:shadow-lg transition-all duration-300 transform hover:scale-105">
              <div className="bg-blue-500 w-12 h-12 rounded-full flex items-center justify-center mb-6">
                <SparklesIcon className="h-6 w-6 text-white" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">AI 대화형 추천</h3>
              <p className="text-gray-600 mb-4 text-sm">
                "친구들과 맛있는 한식집 찾고 있어요" → AI가 자동으로 분석해서 맞춤 추천
              </p>
              <Link
                to="/meeting-planner"
                className="text-blue-600 font-medium text-sm hover:text-blue-800 flex items-center"
              >
                체험해보기 →
              </Link>
            </div>

            {/* 감정 기반 협업 */}
            <div className="bg-gradient-to-br from-pink-50 to-pink-100 p-8 rounded-2xl border border-pink-200 hover:shadow-lg transition-all duration-300 transform hover:scale-105">
              <div className="bg-pink-500 w-12 h-12 rounded-full flex items-center justify-center mb-6">
                <HeartIcon className="h-6 w-6 text-white" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">감정 반응 시스템</h3>
              <p className="text-gray-600 mb-4 text-sm">
                😍👍🤔😐 이모지로 감정을 표현하고 그룹의 진짜 마음을 확인하세요
              </p>
              <Link
                to="/meeting-planner"
                className="text-pink-600 font-medium text-sm hover:text-pink-800 flex items-center"
              >
                체험해보기 →
              </Link>
            </div>

            {/* 공정한 선정 */}
            <div className="bg-gradient-to-br from-green-50 to-green-100 p-8 rounded-2xl border border-green-200 hover:shadow-lg transition-all duration-300 transform hover:scale-105">
              <div className="bg-green-500 w-12 h-12 rounded-full flex items-center justify-center mb-6">
                <ArrowPathIcon className="h-6 w-6 text-white" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">공정성 알고리즘</h3>
              <p className="text-gray-600 mb-4 text-sm">
                4가지 공정성 모드로 모든 친구에게 균등한 기회를 제공하는 선정 시스템
              </p>
              <Link
                to="/meeting-planner"
                className="text-green-600 font-medium text-sm hover:text-green-800 flex items-center"
              >
                체험해보기 →
              </Link>
            </div>

            {/* 데이터 인사이트 */}
            <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-8 rounded-2xl border border-purple-200 hover:shadow-lg transition-all duration-300 transform hover:scale-105">
              <div className="bg-purple-500 w-12 h-12 rounded-full flex items-center justify-center mb-6">
                <ChartBarIcon className="h-6 w-6 text-white" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">스마트 분석</h3>
              <p className="text-gray-600 mb-4 text-sm">
                그룹의 선호도 패턴을 분석해서 더 나은 미팅 장소를 추천해드려요
              </p>
              <button
                onClick={() => {
                  setCollectorTrigger('analytics-export');
                  setShowInfoCollector(true);
                }}
                className="text-purple-600 font-medium text-sm hover:text-purple-800 flex items-center"
              >
                분석 받기 →
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 차별화 포인트 & 사용자 후기 통합 섹션 */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              다른 앱과 뭐가 다른가요?
            </h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
            {/* 차별화 포인트 */}
            <div>
              <h3 className="text-2xl font-bold text-gray-900 mb-8 text-center">
                차별화 포인트
              </h3>
              <div className="space-y-6">
                <div className="bg-red-50 p-6 rounded-2xl border border-red-200 flex items-start">
                  <div className="bg-red-100 p-3 rounded-lg mr-4 flex-shrink-0">
                    <div className="text-red-600 font-bold text-lg">vs</div>
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-3 text-lg">기존 앱: "어디서 만날까?"</h4>
                    <p className="text-gray-600">단순히 중간 지점만 찾아주는 정보 전달 중심</p>
                  </div>
                </div>

                <div className="bg-green-50 p-6 rounded-2xl border border-green-200 flex items-start">
                  <div className="bg-green-100 p-3 rounded-lg mr-4 flex-shrink-0">
                    <div className="text-green-600 font-bold text-lg">✓</div>
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-3 text-lg">WhereWeMeets: "어떻게 공정하게 결정할까?"</h4>
                    <p className="text-gray-600">감정과 협업을 중시하는 의사결정 플랫폼</p>
                  </div>
                </div>

                <div className="bg-gradient-to-r from-primary-50 to-secondary-50 p-8 rounded-2xl border border-primary-200">
                  <h5 className="font-semibold text-gray-900 mb-4 flex items-center text-lg">
                    <LightBulbIcon className="h-6 w-6 mr-3 text-primary-600" />
                    핵심 차별점
                  </h5>
                  <ul className="text-gray-700 space-y-2">
                    <li className="flex items-center">
                      <span className="mr-3">🤖</span>
                      <span>자연어 대화로 AI가 니즈 파악</span>
                    </li>
                    <li className="flex items-center">
                      <span className="mr-3">😊</span>
                      <span>감정 반응으로 진짜 선호도 확인</span>
                    </li>
                    <li className="flex items-center">
                      <span className="mr-3">⚖️</span>
                      <span>공정성 알고리즘으로 모든 친구 배려</span>
                    </li>
                    <li className="flex items-center">
                      <span className="mr-3">💬</span>
                      <span>실시간 채팅으로 소통하며 결정</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            {/* 사용자 후기 */}
            <div>
              <h3 className="text-2xl font-bold text-gray-900 mb-8 text-center">
                사용자들의 생생한 후기
              </h3>
              <div className="space-y-6">
                <div className="bg-blue-50 p-6 rounded-2xl border border-blue-200">
                  <div className="flex items-center mb-4">
                    <div className="text-2xl mr-3">🙋‍♀️</div>
                    <div>
                      <h4 className="font-semibold">이수진님</h4>
                      <div className="text-yellow-400">★★★★★</div>
                    </div>
                  </div>
                  <p className="text-gray-700 text-sm">
                    "드디어 친구들과 만날 때 '어디서 만날까' 고민이 사라졌어요! 
                    AI가 대화만으로 우리가 원하는 걸 정확히 파악해서 놀랍네요."
                  </p>
                </div>

                <div className="bg-green-50 p-6 rounded-2xl border border-green-200">
                  <div className="flex items-center mb-4">
                    <div className="text-2xl mr-3">🙋‍♂️</div>
                    <div>
                      <h4 className="font-semibold">박현우님</h4>
                      <div className="text-yellow-400">★★★★★</div>
                    </div>
                  </div>
                  <p className="text-gray-700 text-sm">
                    "공정성 알고리즘이 정말 좋아요. 항상 같은 사람만 선정되던 문제가 해결됐고, 
                    모든 친구들이 만족하는 결과가 나와요!"
                  </p>
                </div>

                <div className="bg-purple-50 p-6 rounded-2xl border border-purple-200">
                  <div className="flex items-center mb-4">
                    <div className="text-2xl mr-3">👨‍💼</div>
                    <div>
                      <h4 className="font-semibold">김대리님</h4>
                      <div className="text-yellow-400">★★★★★</div>
                    </div>
                  </div>
                  <p className="text-gray-700 text-sm">
                    "회사 동료들과의 회식 장소 정하기가 이렇게 쉬울 줄 몰랐어요. 
                    감정 반응 시스템으로 다들 진짜 원하는 곳을 알 수 있어서 좋네요."
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA 섹션 */}
      <section className="py-20 bg-gradient-to-r from-primary-600 to-secondary-600 text-white">
        <div className="max-w-4xl mx-auto text-center px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold mb-4">
            지금 바로 완벽한 만남 장소를 찾아보세요
          </h2>
          <p className="text-xl text-primary-100 mb-8">
            복잡한 회원가입 없이 30초 만에 시작할 수 있어요
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/meeting-planner"
              className="bg-white text-primary-600 px-8 py-4 rounded-full text-lg font-semibold hover:bg-gray-100 transition duration-200 transform hover:scale-105"
            >
              {isAuthenticated && user?.subscription === 'premium' 
                ? '나만의 AI 미팅 만들기 🚀' 
                : '무료로 시작하기 🚀'
              }
            </Link>
            <Link
              to="/register"
              className="border-2 border-white text-white px-8 py-4 rounded-full text-lg font-semibold hover:bg-white hover:text-primary-600 transition duration-200"
            >
              프리미엄 기능 체험 ⭐
            </Link>
          </div>
        </div>
      </section>

      {/* 스마트 정보 수집 모달 */}
      <SmartInfoCollector
        isOpen={showInfoCollector}
        onClose={() => setShowInfoCollector(false)}
        trigger={collectorTrigger}
        onSuccess={handleInfoCollectorSuccess}
      />
    </div>
  );
};

export default HomePage; 