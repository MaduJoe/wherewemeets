import React from 'react';
import { 
  formatDate, 
  formatDateShort, 
  formatRelativeTime, 
  formatLoginTime, 
  formatVoteTime,
  getCurrentKoreanTime,
  utcToKorean 
} from '../utils/dateUtils';

const DateTimeTest = () => {
  // 테스트 UTC 시간들
  const testUTCTimes = [
    '2025-06-21T02:07:21.681Z', // 사용자가 언급한 createdAt
    '2025-06-21T02:29:15.121Z', // 사용자가 언급한 updatedAt
    new Date().toISOString(),    // 현재 시간 UTC
    new Date(Date.now() - 5 * 60 * 1000).toISOString(), // 5분 전
    new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2시간 전
  ];

  return (
    <div className="p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-6 text-gray-800">
        🕐 UTC → 한국시간 변환 테스트
      </h2>
      
      <div className="mb-6 p-4 bg-blue-50 rounded-lg">
        <h3 className="font-semibold text-blue-800 mb-2">현재 시간</h3>
        <p><strong>현재 한국시간:</strong> {getCurrentKoreanTime()}</p>
        <p><strong>현재 UTC:</strong> {new Date().toISOString()}</p>
      </div>

      <div className="space-y-6">
        {testUTCTimes.map((utcTime, index) => (
          <div key={index} className="border-l-4 border-blue-500 pl-4 py-2">
            <h4 className="font-semibold text-gray-700 mb-2">
              테스트 #{index + 1}
            </h4>
            
            <div className="bg-gray-50 p-3 rounded mb-3">
              <p className="text-sm text-gray-600">
                <strong>원본 UTC:</strong> {utcTime}
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <p><strong>기본 포맷:</strong> {formatDate(utcTime)}</p>
                <p><strong>짧은 포맷:</strong> {formatDateShort(utcTime)}</p>
                <p><strong>상대 시간:</strong> {formatRelativeTime(utcTime)}</p>
              </div>
              <div>
                <p><strong>로그인 포맷:</strong> {formatLoginTime(utcTime)}</p>
                <p><strong>투표 포맷:</strong> {formatVoteTime(utcTime)}</p>
                <p><strong>명시적 변환:</strong> {utcToKorean(utcTime)}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 p-4 bg-green-50 rounded-lg">
        <h3 className="font-semibold text-green-800 mb-2">✅ 확인사항</h3>
        <ul className="text-sm text-green-700 space-y-1">
          <li>• 데이터베이스: UTC로 저장 (표준 준수)</li>
          <li>• 화면 표시: 한국시간으로 자동 변환</li>
          <li>• 시간대 차이: UTC + 9시간 = 한국시간</li>
          <li>• 브라우저 자동 감지: 사용자 로케일 기반</li>
        </ul>
      </div>
    </div>
  );
};

export default DateTimeTest; 