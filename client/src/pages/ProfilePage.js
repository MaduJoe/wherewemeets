import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import MeetingHistory from '../components/MeetingHistory';

const ProfilePage = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('profile');

  const tabs = [
    { id: 'profile', label: '내 정보' },
    { id: 'history', label: '미팅 히스토리' }
  ];

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* 탭 네비게이션 */}
        <div className="mb-8">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`py-2 px-1 border-b-2 font-medium text-sm ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* 탭 컨텐츠 */}
        {activeTab === 'profile' && (
          <div className="bg-white rounded-lg shadow p-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-6">내 정보</h1>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">이름</label>
                <p className="mt-1 text-sm text-gray-900">{user?.name || '사용자'}</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700">이메일</label>
                <p className="mt-1 text-sm text-gray-900">{user?.email || 'user@example.com'}</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700">구독 플랜</label>
                <p className="mt-1 text-sm text-gray-900">{user?.subscription || 'Free'}</p>
              </div>
            </div>

            <div className="mt-6 p-4 bg-gray-100 rounded-lg">
              <p className="text-center text-gray-500">
                프로필 편집 기능은 데이터베이스 연결 후 사용 가능합니다.
              </p>
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="bg-white rounded-lg shadow p-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-6">미팅 히스토리</h1>
            <MeetingHistory />
          </div>
        )}
      </div>
    </div>
  );
};

export default ProfilePage; 