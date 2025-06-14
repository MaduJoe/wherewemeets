import React from 'react';
import { useAuth } from '../contexts/AuthContext';

const ProfilePage = () => {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-lg shadow p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">프로필</h1>
          
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
      </div>
    </div>
  );
};

export default ProfilePage; 