import React, { useState, useLayoutEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';

const CreateMeetingPage = () => {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    date: '',
    time: '',
    category: 'restaurant',
    participants: ''
  });

  // 페이지 로드 시 즉시 스크롤 최상단으로 이동
  useLayoutEffect(() => {
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // 날짜와 시간을 합쳐서 전체 날짜/시간 생성
      const scheduledDate = new Date(`${formData.date}T${formData.time}`);
      const today = new Date();
      today.setHours(0, 0, 0, 0); // 오늘 날짜만 비교

      // 오늘보다 이전 날짜인지 확인
      if (scheduledDate < today) {
        alert('미팅 날짜는 오늘 이후로 설정해주세요.');
        setLoading(false);
        return;
      }

      // 참가자 이메일을 배열로 변환
      const participantEmails = formData.participants
        .split(',')
        .map(email => email.trim())
        .filter(email => email.length > 0);

      // 참가자 객체 생성 (임시)
      const participants = participantEmails.map((email, index) => ({
        id: index + 2, // 현재 사용자는 ID 1
        name: email.split('@')[0], // 이메일에서 이름 추출
        email: email,
        location: '서울시' // 임시 위치
      }));

      const meetingData = {
        title: formData.title,
        description: formData.description,
        scheduledDate: scheduledDate.toISOString(),
        category: formData.category,
        participants: participants
      };

      // API 호출
      const response = await axios.post('/api/meetings', meetingData);
      
      // 다가오는 미팅인지 확인하여 로컬스토리지에 저장
      const createdMeeting = {
        ...response.data,
        scheduledDate: scheduledDate.toISOString(),
        dateString: formData.date,
        timeString: formData.time
      };

      // 기존 다가오는 미팅 목록 가져오기
      const existingUpcoming = JSON.parse(localStorage.getItem('upcomingMeetings') || '[]');
      
      // 새 미팅 추가
      const updatedUpcoming = [...existingUpcoming, createdMeeting];
      
      // 로컬스토리지에 저장
      localStorage.setItem('upcomingMeetings', JSON.stringify(updatedUpcoming));

      alert(`미팅 "${formData.title}"이(가) 생성되었습니다!`);
      navigate('/dashboard');
    } catch (error) {
      console.error('미팅 생성 실패:', error);
      alert('미팅 생성 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  // 오늘 날짜를 최소값으로 설정
  const today = new Date().toISOString().split('T')[0];

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-lg shadow p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">새 미팅 만들기</h1>
          
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                미팅 제목
              </label>
              <input
                type="text"
                name="title"
                value={formData.title}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="예: 친구들과 저녁 식사"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                설명 (선택사항)
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="미팅에 대한 간단한 설명을 입력하세요"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  날짜
                </label>
                <input
                  type="date"
                  name="date"
                  value={formData.date}
                  onChange={handleChange}
                  min={today}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">오늘 이후 날짜를 선택해주세요</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  시간
                </label>
                <input
                  type="time"
                  name="time"
                  value={formData.time}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                카테고리
              </label>
              <select
                name="category"
                value={formData.category}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="restaurant">음식점</option>
                <option value="cafe">카페</option>
                <option value="entertainment">오락시설</option>
                <option value="shopping">쇼핑</option>
                <option value="outdoor">야외활동</option>
                <option value="culture">문화시설</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                참가자 이메일 (쉼표로 구분)
              </label>
              <input
                type="text"
                name="participants"
                value={formData.participants}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="friend1@email.com, friend2@email.com"
              />
              <p className="text-xs text-gray-500 mt-1">참가자가 있으면 입력하고, 없으면 비워두세요</p>
            </div>

            <div className="flex space-x-4">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 bg-primary-600 text-white py-2 px-4 rounded-md hover:bg-primary-700 transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    생성 중...
                  </>
                ) : (
                  '미팅 생성하기'
                )}
              </button>
              <button
                type="button"
                onClick={() => navigate('/dashboard')}
                disabled={loading}
                className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-400 transition duration-200 disabled:opacity-50"
              >
                취소
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default CreateMeetingPage; 