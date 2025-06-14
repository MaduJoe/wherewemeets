import React from 'react';
import { useParams } from 'react-router-dom';

const MeetingDetailPage = () => {
  const { id } = useParams();

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-lg shadow p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            미팅 상세 정보
          </h1>
          <p className="text-gray-600">
            미팅 ID: {id}
          </p>
          <div className="mt-6 p-4 bg-gray-100 rounded-lg">
            <p className="text-center text-gray-500">
              데이터베이스 연결 후 미팅 정보가 표시됩니다.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MeetingDetailPage; 