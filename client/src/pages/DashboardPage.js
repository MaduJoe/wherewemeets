import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import {
  UserIcon,
  ChartBarIcon,
  ClockIcon,
  CogIcon,
  PencilIcon,
  CheckIcon,
  XMarkIcon,
  EyeIcon,
  LockClosedIcon,
  DocumentTextIcon
} from '@heroicons/react/24/outline';
import { toast } from 'react-hot-toast';
import MeetingHistory from '../components/MeetingHistory';
import PremiumOnly from '../components/PremiumOnly';

// 기능명을 한글로 맵핑하는 함수
const getFeatureDisplayName = (featureName) => {
  const featureMap = {
    // 홈페이지에서 호출되는 기능들
    'homepage_smart-planner': '스마트 플래너 (홈)',
    'homepage_group-voting': '그룹 투표 (홈)',
    'homepage_ai-recommendations': 'AI 추천 (홈)',
    'homepage_place-explorer': '장소 탐색 (홈)',
    'homepage_meeting-history': '미팅 히스토리 (홈)',
    'homepage_premium-features': '프리미엄 기능 (홈)',
    
    // 일반 기능들
    'smart-planner': '스마트 플래너',
    'group-voting': '그룹 투표',
    'ai-recommendations': 'AI 장소 추천',
    'place-explorer': '장소 탐색',
    'meeting-history': '미팅 히스토리',
    'premium-features': '프리미엄 기능',
    'random-selector': '랜덤 선택',
    'rule-based-places': '규칙 기반 장소',
    'chat-assistance': '채팅 도움',
    'voice-input': '음성 입력',
    'location-sharing': '위치 공유',
    'meeting-analytics': '미팅 분석',
    'social-integration': '소셜 연동',
    'notification-settings': '알림 설정',
    'profile-management': '프로필 관리',
    'payment-features': '결제 기능',
    'mobile-app': '모바일 앱',
    'export-data': '데이터 내보내기',
    
    // 소셜 로그인
    'social_login_google': '구글 로그인',
    'social_login_kakao': '카카오 로그인',
    'social_login_naver': '네이버 로그인',
    'social_login_github': '깃허브 로그인',
    
    // 기타
    'dashboard': '대시보드',
    'settings': '설정',
    'help': '도움말',
    'feedback': '피드백'
  };
  
  return featureMap[featureName] || featureName;
};

const DashboardPage = () => {
  const { user, logout, isAuthenticated, updateProfile, changePassword, getDashboardData } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  const [isEditing, setIsEditing] = useState(false);
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  
  const [profileForm, setProfileForm] = useState({
    name: '',
    phone: '',
    bio: '',
    location: {
      city: '',
      address: ''
    },
    preferences: {
      transportMode: 'driving',
      maxDistance: 30,
      preferredCategories: [],
      language: 'ko',
      notifications: {
        email: true,
        push: true,
        sms: false
      }
    }
  });

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  useEffect(() => {
    // 인증되지 않은 사용자는 로그인 페이지로
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    
    // 게스트 사용자나 무료 사용자는 대시보드 접근 불가
    if (user?.isGuest || user?.subscription !== 'premium') {
      // PremiumOnly 컴포넌트에서 처리하므로 리다이렉트하지 않음
      return;
    }

    loadDashboardData();
  }, [isAuthenticated, user, navigate]);

  useEffect(() => {
    if (user) {
      setProfileForm({
        name: user.name || '',
        phone: user.phone || '',
        bio: user.bio || '',
        location: {
          city: user.location?.city || '',
          address: user.location?.address || ''
        },
        preferences: {
          transportMode: user.preferences?.transportMode || 'driving',
          maxDistance: user.preferences?.maxDistance || 30,
          preferredCategories: user.preferences?.preferredCategories || [],
          language: user.preferences?.language || 'ko',
          notifications: {
            email: user.preferences?.notifications?.email ?? true,
            push: user.preferences?.notifications?.push ?? true,
            sms: user.preferences?.notifications?.sms ?? false
          }
        }
      });
    }
  }, [user]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const result = await getDashboardData();
      
      if (result.success) {
        setDashboardData(result.data);
      } else {
        // API 실패 시 mock 데이터 사용
        const mockData = {
          stats: {
            totalMeetings: 12,
            totalVotes: 45,
            favoriteCategories: ['restaurant', 'cafe', 'park'],
            featureUsage: [
              { feature: 'homepage_smart-planner', count: 76, lastUsed: new Date() },
              { feature: 'group-voting', count: 12, lastUsed: new Date() },
              { feature: 'smart-planner', count: 8, lastUsed: new Date() },
              { feature: 'ai-recommendations', count: 5, lastUsed: new Date() }
            ],
            recentActivity: new Date()
          }
        };
        setDashboardData(mockData);
      }
    } catch (error) {
      console.error('대시보드 데이터 로드 에러:', error);
      // 에러 시 기본 데이터 설정
      setDashboardData({
        stats: {
          totalMeetings: 0,
          totalVotes: 0,
          favoriteCategories: [],
          featureUsage: [],
          recentActivity: new Date()
        }
      });
    } finally {
      setLoading(false);
    }
  };

  const handleProfileUpdate = async () => {
    try {
      console.log('DashboardPage: 프로필 업데이트 시작');
      console.log('DashboardPage: profileForm 전체:', profileForm);
      console.log('DashboardPage: profileForm.preferences:', profileForm.preferences);
      console.log('DashboardPage: profileForm.preferences.notifications:', profileForm.preferences.notifications);
      
      const result = await updateProfile(profileForm);
      
      console.log('DashboardPage: updateProfile 결과:', result);
      
      if (result.success) {
        setIsEditing(false);
        toast.success('프로필이 업데이트되었습니다!');
      } else {
        toast.error(result.message || '프로필 업데이트에 실패했습니다.');
      }
    } catch (error) {
      console.error('DashboardPage: 프로필 업데이트 에러:', error);
      toast.error('프로필 업데이트에 실패했습니다.');
    }
  };

  const handlePasswordChange = async () => {
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error('새 비밀번호가 일치하지 않습니다.');
      return;
    }

    if (passwordForm.newPassword.length < 6) {
      toast.error('비밀번호는 최소 6자 이상이어야 합니다.');
      return;
    }

    try {
      const result = await changePassword({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword
      });
      
      if (result.success) {
        setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
        toast.success('비밀번호가 변경되었습니다!');
      } else {
        toast.error(result.message || '비밀번호 변경에 실패했습니다.');
      }
    } catch (error) {
      console.error('비밀번호 변경 에러:', error);
      toast.error('비밀번호 변경에 실패했습니다.');
    }
  };

  const handleCategoryToggle = (category) => {
    setProfileForm(prev => ({
      ...prev,
      preferences: {
        ...prev.preferences,
        preferredCategories: prev.preferences.preferredCategories.includes(category)
          ? prev.preferences.preferredCategories.filter(c => c !== category)
          : [...prev.preferences.preferredCategories, category]
      }
    }));
  };

  // 게스트 사용자나 무료 사용자는 PremiumOnly 컴포넌트 표시
  if (user?.isGuest || user?.subscription !== 'premium') {
    return <PremiumOnly feature="대시보드" />;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* 헤더 */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-16 h-16 bg-gradient-to-r from-primary-600 to-secondary-600 rounded-full flex items-center justify-center text-white text-2xl font-bold">
                {user?.name?.charAt(0)?.toUpperCase() || 'U'}
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{user?.name}님의 대시보드</h1>
                <p className="text-gray-600">
                  {user?.subscription === 'premium' ? '프리미엄' : '무료'} 멤버 
                  · 가입일: {new Date(user?.createdAt).toLocaleDateString('ko-KR')}
                </p>
              </div>
            </div>
            <button
              onClick={logout}
              className="px-4 py-2 text-gray-600 hover:text-gray-800 font-medium"
            >
              로그아웃
            </button>
          </div>
        </div>

        {/* 탭 네비게이션 */}
        <div className="bg-white rounded-lg shadow-sm mb-8">
          <div className="border-b border-gray-200">
            <nav className="flex space-x-8 px-6">
              {[
                { id: 'overview', name: '개요', icon: ChartBarIcon },
                { id: 'history', name: '미팅 히스토리', icon: DocumentTextIcon },
                { id: 'profile', name: '프로필 관리', icon: UserIcon },
                { id: 'settings', name: '설정', icon: CogIcon },
                { id: 'security', name: '보안', icon: LockClosedIcon }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === tab.id
                      ? 'border-primary-500 text-primary-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <tab.icon className="h-5 w-5" />
                  <span>{tab.name}</span>
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* 탭 컨텐츠 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {activeTab === 'overview' && (
            <>
              {/* 통계 카드 */}
              <div className="lg:col-span-2 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-white p-6 rounded-lg shadow-sm">
                    <div className="flex items-center">
                      <ChartBarIcon className="h-12 w-12 text-blue-600" />
                      <div className="ml-4">
                        <p className="text-sm font-medium text-gray-600">총 미팅 생성</p>
                        <p className="text-3xl font-bold text-gray-900">{dashboardData?.stats?.totalMeetings || 0}</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-white p-6 rounded-lg shadow-sm">
                    <div className="flex items-center">
                      <EyeIcon className="h-12 w-12 text-green-600" />
                      <div className="ml-4">
                        <p className="text-sm font-medium text-gray-600">총 투표 참여</p>
                        <p className="text-3xl font-bold text-gray-900">{dashboardData?.stats?.totalVotes || 0}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 기능 사용 통계 */}
                <div className="bg-white p-6 rounded-lg shadow-sm">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">주요 기능 사용 현황</h3>
                  <div className="space-y-4">
                    {dashboardData?.stats?.featureUsage?.map((feature, index) => (
                      <div key={index} className="flex justify-between items-center">
                        <span className="text-gray-700">{getFeatureDisplayName(feature.feature)}</span>
                        <div className="flex items-center space-x-2">
                          <div className="w-32 bg-gray-200 rounded-full h-2">
                            <div 
                              className="bg-blue-600 h-2 rounded-full" 
                              style={{ width: `${Math.min((feature.count / 20) * 100, 100)}%` }}
                            ></div>
                          </div>
                          <span className="text-sm text-gray-600">{feature.count}회</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* 사이드바 정보 */}
              <div className="space-y-6">
                <div className="bg-white p-6 rounded-lg shadow-sm">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">선호 카테고리</h3>
                  <div className="flex flex-wrap gap-2">
                    {dashboardData?.stats?.favoriteCategories?.map((category, index) => (
                      <span 
                        key={index}
                        className="px-3 py-1 bg-primary-100 text-primary-800 rounded-full text-sm"
                      >
                        {category}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="bg-white p-6 rounded-lg shadow-sm">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">최근 활동</h3>
                  <div className="flex items-center space-x-2 text-gray-600">
                    <ClockIcon className="h-5 w-5" />
                    <span className="text-sm">
                      {dashboardData?.stats?.recentActivity 
                        ? new Date(dashboardData.stats.recentActivity).toLocaleDateString('ko-KR')
                        : '활동 없음'
                      }
                    </span>
                  </div>
                </div>
              </div>
            </>
          )}

          {activeTab === 'history' && (
            <div className="lg:col-span-3">
              <MeetingHistory />
            </div>
          )}

          {activeTab === 'profile' && (
            <div className="lg:col-span-3">
              <div className="bg-white rounded-lg shadow-sm p-6">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-lg font-semibold text-gray-900">프로필 정보</h3>
                  {!isEditing ? (
                    <button
                      onClick={() => setIsEditing(true)}
                      className="flex items-center space-x-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                    >
                      <PencilIcon className="h-4 w-4" />
                      <span>편집</span>
                    </button>
                  ) : (
                    <div className="flex space-x-2">
                      <button
                        onClick={handleProfileUpdate}
                        className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                      >
                        <CheckIcon className="h-4 w-4" />
                        <span>저장</span>
                      </button>
                      <button
                        onClick={() => setIsEditing(false)}
                        className="flex items-center space-x-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                      >
                        <XMarkIcon className="h-4 w-4" />
                        <span>취소</span>
                      </button>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* 기본 정보 */}
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">이름</label>
                      <input
                        type="text"
                        value={profileForm.name}
                        onChange={(e) => setProfileForm(prev => ({ ...prev, name: e.target.value }))}
                        disabled={!isEditing}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 disabled:bg-gray-50"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">전화번호</label>
                      <input
                        type="tel"
                        value={profileForm.phone}
                        onChange={(e) => setProfileForm(prev => ({ ...prev, phone: e.target.value }))}
                        disabled={!isEditing}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 disabled:bg-gray-50"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">자기소개</label>
                      <textarea
                        value={profileForm.bio}
                        onChange={(e) => setProfileForm(prev => ({ ...prev, bio: e.target.value }))}
                        disabled={!isEditing}
                        rows={3}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 disabled:bg-gray-50"
                      />
                    </div>
                  </div>

                  {/* 위치 및 설정 */}
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">도시</label>
                      <input
                        type="text"
                        value={profileForm.location.city}
                        onChange={(e) => setProfileForm(prev => ({ 
                          ...prev, 
                          location: { ...prev.location, city: e.target.value }
                        }))}
                        disabled={!isEditing}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 disabled:bg-gray-50"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">교통수단</label>
                      <select
                        value={profileForm.preferences.transportMode}
                        onChange={(e) => setProfileForm(prev => ({ 
                          ...prev, 
                          preferences: { ...prev.preferences, transportMode: e.target.value }
                        }))}
                        disabled={!isEditing}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 disabled:bg-gray-50"
                      >
                        <option value="driving">자동차</option>
                        <option value="walking">도보</option>
                        <option value="transit">대중교통</option>
                        <option value="bicycling">자전거</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">최대 이동거리 (km)</label>
                      <input
                        type="number"
                        value={profileForm.preferences.maxDistance}
                        onChange={(e) => setProfileForm(prev => ({ 
                          ...prev, 
                          preferences: { ...prev.preferences, maxDistance: parseInt(e.target.value) }
                        }))}
                        disabled={!isEditing}
                        min="1"
                        max="100"
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 disabled:bg-gray-50"
                      />
                    </div>
                  </div>
                </div>

                {/* 선호 카테고리 */}
                <div className="mt-6">
                  <label className="block text-sm font-medium text-gray-700 mb-3">선호 카테고리</label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {['restaurant', 'cafe', 'park', 'shopping', 'entertainment', 'bar'].map((category) => (
                      <label key={category} className="flex items-center">
                        <input
                          type="checkbox"
                          checked={profileForm.preferences.preferredCategories.includes(category)}
                          onChange={() => handleCategoryToggle(category)}
                          disabled={!isEditing}
                          className="rounded border-gray-300 text-primary-600 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                        />
                        <span className="ml-2 text-sm text-gray-700">{category}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="lg:col-span-3">
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-6">알림 설정</h3>
                
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-900">이메일 알림</p>
                      <p className="text-sm text-gray-600">새로운 미팅 초대 및 투표 알림</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={profileForm.preferences.notifications.email}
                      onChange={(e) => setProfileForm(prev => ({
                        ...prev,
                        preferences: {
                          ...prev.preferences,
                          notifications: {
                            ...prev.preferences.notifications,
                            email: e.target.checked
                          }
                        }
                      }))}
                      className="rounded border-gray-300 text-primary-600 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-900">푸시 알림</p>
                      <p className="text-sm text-gray-600">실시간 채팅 및 투표 결과</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={profileForm.preferences.notifications.push}
                      onChange={(e) => setProfileForm(prev => ({
                        ...prev,
                        preferences: {
                          ...prev.preferences,
                          notifications: {
                            ...prev.preferences.notifications,
                            push: e.target.checked
                          }
                        }
                      }))}
                      className="rounded border-gray-300 text-primary-600 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-900">SMS 알림</p>
                      <p className="text-sm text-gray-600">중요한 미팅 알림만</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={profileForm.preferences.notifications.sms}
                      onChange={(e) => setProfileForm(prev => ({
                        ...prev,
                        preferences: {
                          ...prev.preferences,
                          notifications: {
                            ...prev.preferences.notifications,
                            sms: e.target.checked
                          }
                        }
                      }))}
                      className="rounded border-gray-300 text-primary-600 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                    />
                  </div>
                </div>

                <div className="mt-8">
                  <button
                    onClick={handleProfileUpdate}
                    className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                  >
                    설정 저장
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'security' && (
            <div className="lg:col-span-3">
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-6">비밀번호 변경</h3>
                
                <div className="max-w-md space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">현재 비밀번호</label>
                    <input
                      type="password"
                      value={passwordForm.currentPassword}
                      onChange={(e) => setPasswordForm(prev => ({ ...prev, currentPassword: e.target.value }))}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">새 비밀번호</label>
                    <input
                      type="password"
                      value={passwordForm.newPassword}
                      onChange={(e) => setPasswordForm(prev => ({ ...prev, newPassword: e.target.value }))}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">새 비밀번호 확인</label>
                    <input
                      type="password"
                      value={passwordForm.confirmPassword}
                      onChange={(e) => setPasswordForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                    />
                  </div>

                  <button
                    onClick={handlePasswordChange}
                    className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                  >
                    비밀번호 변경
                  </button>
                </div>

                <div className="mt-8 pt-8 border-t border-gray-200">
                  <h4 className="text-md font-medium text-gray-900 mb-4">계정 삭제</h4>
                  <p className="text-sm text-gray-600 mb-4">
                    계정을 삭제하면 모든 데이터가 영구적으로 삭제됩니다. 이 작업은 되돌릴 수 없습니다.
                  </p>
                  <button className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">
                    계정 삭제
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DashboardPage; 