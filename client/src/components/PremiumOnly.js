import React from 'react';
import { Link } from 'react-router-dom';
import { LockClosedIcon, StarIcon, SparklesIcon } from '@heroicons/react/24/outline';

const PremiumOnly = ({ feature = "이 기능", children }) => {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          {/* 아이콘 */}
          <div className="mx-auto flex items-center justify-center h-24 w-24 rounded-full bg-gradient-to-r from-amber-400 to-orange-500 mb-6">
            <StarIcon className="h-12 w-12 text-white" />
          </div>
          
          {/* 제목 */}
          <h2 className="text-3xl font-bold text-gray-900 mb-2">
            프리미엄 전용 기능
          </h2>
          
          {/* 설명 */}
          <p className="text-gray-600 mb-8">
            {feature}은(는) 프리미엄 회원만 이용할 수 있는 특별한 기능입니다.
          </p>
          
          {/* 프리미엄 혜택 리스트 */}
          <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <SparklesIcon className="h-5 w-5 text-amber-500 mr-2" />
              프리미엄 혜택
            </h3>
            <ul className="text-left space-y-3 text-gray-600">
              <li className="flex items-center">
                <div className="w-2 h-2 bg-green-500 rounded-full mr-3"></div>
                개인 맞춤 대시보드
              </li>
              <li className="flex items-center">
                <div className="w-2 h-2 bg-green-500 rounded-full mr-3"></div>
                AI 기반 스마트 추천
              </li>
              <li className="flex items-center">
                <div className="w-2 h-2 bg-green-500 rounded-full mr-3"></div>
                미팅 히스토리 무제한 저장
              </li>
              <li className="flex items-center">
                <div className="w-2 h-2 bg-green-500 rounded-full mr-3"></div>
                우선 고객 지원
              </li>
              <li className="flex items-center">
                <div className="w-2 h-2 bg-green-500 rounded-full mr-3"></div>
                광고 없는 깔끔한 경험
              </li>
            </ul>
          </div>

          {/* 버튼들 */}
          <div className="space-y-4">
            <Link 
              to="/pricing" 
              className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-gradient-to-r from-primary-600 to-secondary-600 hover:from-primary-700 hover:to-secondary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition duration-200"
            >
              <StarIcon className="h-5 w-5 mr-2" />
              지금 프리미엄 시작하기
            </Link>
            
            <Link 
              to="/" 
              className="w-full flex justify-center py-3 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition duration-200"
            >
              홈으로 돌아가기
            </Link>
          </div>

          {/* 추가 정보 */}
          <div className="mt-8 text-xs text-gray-500">
            <p>7일 무료 체험으로 모든 프리미엄 기능을 경험해보세요!</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PremiumOnly; 