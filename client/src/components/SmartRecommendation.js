import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { 
  MapPinIcon, 
  ClockIcon, 
  StarIcon,
  SparklesIcon,
  ChatBubbleLeftEllipsisIcon,
  UserIcon
} from '@heroicons/react/24/outline';

const SmartRecommendation = ({ meetingId, onPlaceSelected }) => {
  const { user, isAuthenticated } = useAuth();
  const [loading, setLoading] = useState(false);
  const [recommendations, setRecommendations] = useState([]);
  const [chatHistory, setChatHistory] = useState([]);
  const [userInput, setUserInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [conversationMode, setConversationMode] = useState(false);
  const chatEndRef = useRef(null);
  
  const [filters, setFilters] = useState({
    category: 'restaurant',
    transportMode: 'driving',
    maxDistance: 30
  });

  const categories = [
    { value: 'restaurant', label: '음식점', icon: '🍽️' },
    { value: 'cafe', label: '카페', icon: '☕' },
    { value: 'park', label: '공원', icon: '🌳' },
    { value: 'entertainment', label: '오락시설', icon: '🎮' },
    { value: 'shopping', label: '쇼핑', icon: '🛍️' },
    { value: 'all', label: '전체', icon: '🌟' }
  ];

  const transportModes = [
    { value: 'driving', label: '자가용', icon: '🚗' },
    { value: 'transit', label: '대중교통', icon: '🚌' },
    { value: 'walking', label: '도보', icon: '🚶' }
  ];

  // 초기 AI 인사말
  useEffect(() => {
    setChatHistory([
      {
        id: 'welcome-1',
        type: 'ai',
        message: '안녕하세요! 👋 완벽한 만남 장소를 찾아드리는 AI 도우미입니다.',
        timestamp: new Date()
      },
      {
        id: 'welcome-2',
        type: 'ai',
        message: '어떤 종류의 장소를 찾고 계시나요? 음식점, 카페, 공원 등... 자유롭게 말씀해 주세요!',
        timestamp: new Date()
      }
    ]);
  }, []);

  // 채팅 자동 스크롤
  useEffect(() => {
    // chatHistory가 초기 상태(예: 메시지 2개)보다 많거나, 사용자가 입력을 시작했을 때 스크롤
    // 또는 isTyping이 true일 때 (AI가 응답 중일 때)
    if (chatHistory.length > 2 || (chatHistory.length > 0 && chatHistory[chatHistory.length -1].type === 'user') || isTyping) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatHistory, isTyping]);

  const getRecommendations = async () => {
    setLoading(true);
    try {
      // AI 장소 추천 요청
      const preferences = {
        location: '서울',
        participants: '2-4명',
        budget: '중간',
        purpose: '친목',
        category: filters.category === 'all' ? '음식점' : 
          categories.find(c => c.value === filters.category)?.label || '음식점',
        transportMode: filters.transportMode,
        maxDistance: filters.maxDistance
      };

      // 인증 상태 확인
      if (!isAuthenticated) {
        throw new Error('로그인이 필요합니다.');
      }

      // 로컬 스토리지에서 토큰 가져오기
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('로그인 토큰이 없습니다. 다시 로그인해주세요.');
      }

      const response = await axios.post('/api/aiAssistant/recommend-places', {
        preferences
      }, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.data.success && response.data.data.recommendations) {
        const aiRecommendations = response.data.data.recommendations;
        
        // AI 응답을 일관된 형식으로 변환
        let formattedRecommendations = [];
        
        if (aiRecommendations.places) {
          formattedRecommendations = aiRecommendations.places.map((place, index) => ({
            id: `ai-${index}`,
            name: place.name || '장소명 없음',
            category: place.category || '일반',
            address: place.address || '주소 정보 없음',
            reason: place.reason || '추천 이유 없음',
            features: place.features || [],
            priceRange: place.priceRange || '정보 없음',
            rating: 4.0 + Math.random() * 1, // 임시 평점
            estimatedTravelTime: Math.floor(Math.random() * 30) + 10 // 임시 이동시간
          }));
        } else if (aiRecommendations.rawText) {
          // JSON 파싱 실패한 경우 텍스트 응답 처리
          formattedRecommendations = [{
            id: 'ai-text',
            name: 'AI 추천 결과',
            category: '정보',
            address: '',
            reason: aiRecommendations.rawText,
            features: [],
            priceRange: '',
            rating: 4.0,
            estimatedTravelTime: 20
          }];
        }
        
        setRecommendations(formattedRecommendations);
        
        // 성공 메시지를 채팅에 추가
        let successMessage = `🎉 ${formattedRecommendations.length}개의 맞춤 장소를 찾았어요! 아래에서 확인해보세요.`;
        
        // 노트가 있으면 추가 정보 표시
        if (response.data.data.note) {
          successMessage += `\n\n💡 ${response.data.data.note}`;
        }
        
        setChatHistory(prev => [...prev, {
          id: `success-${Date.now()}`,
          type: 'ai',
          message: successMessage,
          timestamp: new Date()
        }]);
      } else {
        throw new Error('AI 추천 데이터를 받지 못했습니다.');
      }
    } catch (error) {
      console.error('추천 장소 조회 실패:', error);
      
      // 더 자세한 에러 메시지 제공
      let errorMessage = '추천 장소를 가져오는 중 오류가 발생했습니다.';
      
      if (error.response?.status === 403) {
        errorMessage = 'AI 추천 기능은 프리미엄 회원만 이용 가능합니다.';
      } else if (error.response?.status === 401) {
        errorMessage = '로그인이 필요합니다.';
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      }
      
      // 에러 메시지를 채팅에 추가
      setChatHistory(prev => [...prev, {
        id: `error-${Date.now()}`,
        type: 'ai',
        message: `❌ ${errorMessage}\n\n잠시 후 다시 시도해보시거나, 관리자에게 문의해주세요.`,
        timestamp: new Date()
      }]);
      
      alert(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // AI 응답 생성
  const generateAIResponse = (userMessage) => {
    const lowerMessage = userMessage.toLowerCase();
    
    // 카테고리 키워드 감지
    const categoryKeywords = {
      'restaurant': ['음식점', '밥', '식사', '레스토랑', '먹을', '식당'],
      'cafe': ['카페', '커피', '디저트', '차', '스타벅스'],
      'park': ['공원', '산책', '야외', '자연', '운동'],
      'entertainment': ['놀이', '게임', '영화', '오락', '재미'],
      'shopping': ['쇼핑', '쇼핑몰', '백화점', '마트', '구매']
    };

    let detectedCategory = 'all';
    for (const [category, keywords] of Object.entries(categoryKeywords)) {
      if (keywords.some(keyword => lowerMessage.includes(keyword))) {
        detectedCategory = category;
        break;
      }
    }

    // 교통수단 키워드 감지
    const transportKeywords = {
      'driving': ['차', '자가용', '운전', '주차'],
      'transit': ['지하철', '버스', '대중교통', '전철'],
      'walking': ['걸어서', '도보', '산책']
    };

    let detectedTransport = filters.transportMode;
    for (const [transport, keywords] of Object.entries(transportKeywords)) {
      if (keywords.some(keyword => lowerMessage.includes(keyword))) {
        detectedTransport = transport;
        break;
      }
    }

    // 필터 업데이트
    if (detectedCategory !== 'all' || detectedTransport !== filters.transportMode) {
      setFilters(prev => ({
        ...prev,
        category: detectedCategory,
        transportMode: detectedTransport
      }));
    }

    // AI 응답 메시지 생성
    const responses = [
      `${categories.find(c => c.value === detectedCategory)?.icon} ${categories.find(c => c.value === detectedCategory)?.label}을(를) 찾아드릴게요!`,
      `${transportModes.find(t => t.value === detectedTransport)?.icon} ${transportModes.find(t => t.value === detectedTransport)?.label} 이용을 고려해서 추천해드리겠습니다.`,
      '잠시만 기다려주세요... 최적의 장소를 분석하고 있어요! 🔍'
    ];

    return responses;
  };

  const handleChatSubmit = async () => {
    if (!userInput.trim()) return;

    // 사용자 메시지 추가
    const userMessage = {
      id: `user-${Date.now()}`,
      type: 'user',
      message: userInput,
      timestamp: new Date()
    };

    setChatHistory(prev => [...prev, userMessage]);
    setUserInput('');
    setIsTyping(true);

    // AI 응답 생성
    const aiResponses = generateAIResponse(userInput);

    // 순차적으로 AI 응답 추가
    for (let i = 0; i < aiResponses.length; i++) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const aiMessage = {
        id: `ai-response-${Date.now()}-${i}`,
        type: 'ai',
        message: aiResponses[i],
        timestamp: new Date()
      };

      setChatHistory(prev => [...prev, aiMessage]);
    }

    setIsTyping(false);

    // 마지막 응답 후 추천 실행
    setTimeout(() => {
      getRecommendations();
    }, 500);
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const renderStars = (rating) => {
    return Array.from({ length: 5 }, (_, i) => (
      <StarIcon
        key={i}
        className={`h-4 w-4 ${
          i < Math.floor(rating)
            ? 'text-yellow-400 fill-current'
            : 'text-gray-300'
        }`}
      />
    ));
  };

  const startConversation = () => {
    setConversationMode(true);
    setChatHistory(prev => [...prev, {
      id: prev.length + 1,
      type: 'ai',
      message: '좋아요! 어떤 장소를 찾고 계신지 자유롭게 말씀해 주세요. 예를 들어 "친구들과 맛있는 저녁을 먹을 곳을 찾고 있어"라고 말씀해 주시면 됩니다! 😊',
      timestamp: new Date()
    }]);
  };

  // 인증되지 않은 사용자에게 로그인 안내
  if (!isAuthenticated) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center mb-6">
          <SparklesIcon className="h-6 w-6 text-primary-600 mr-2" />
          <h3 className="text-lg font-semibold text-gray-900">AI 대화형 장소 추천</h3>
        </div>
        <div className="text-center py-8">
          <div className="text-6xl mb-4">🔒</div>
          <h4 className="text-xl font-bold text-gray-900 mb-2">로그인이 필요합니다</h4>
          <p className="text-gray-600 mb-6">
            AI 장소 추천 기능은 프리미엄 회원 전용 서비스입니다.<br />
            로그인하시면 무료로 모든 기능을 이용하실 수 있어요!
          </p>
          <div className="space-x-4">
            <a
              href="/login"
              className="bg-primary-600 text-white px-6 py-2 rounded-lg hover:bg-primary-700 transition duration-200"
            >
              로그인하기
            </a>
            <a
              href="/register"
              className="bg-gray-200 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-300 transition duration-200"
            >
              회원가입하기
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center mb-6">
        <SparklesIcon className="h-6 w-6 text-primary-600 mr-2" />
        <h3 className="text-lg font-semibold text-gray-900">AI 대화형 장소 추천</h3>
        {user && (
          <span className="ml-auto text-sm text-gray-600">
            👋 {user.name}님 (프리미엄)
          </span>
        )}
      </div>

      {/* AI 채팅 인터페이스 */}
      <div className="mb-6 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-4">
        <div className="flex items-center mb-3">
          <ChatBubbleLeftEllipsisIcon className="h-5 w-5 text-blue-600 mr-2" />
          <h4 className="font-medium text-gray-900">AI 도우미와 대화하기</h4>
        </div>
        
        {/* 채팅 기록 */}
        <div className="bg-white rounded-lg p-4 max-h-60 overflow-y-auto mb-3">
          {chatHistory.map((chat) => (
            <div
              key={chat.id}
              className={`flex mb-3 ${chat.type === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-xs px-3 py-2 rounded-lg ${
                  chat.type === 'user'
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-100 text-gray-900'
                }`}
              >
                {chat.type === 'ai' && (
                  <div className="flex items-center mb-1">
                    <SparklesIcon className="h-3 w-3 mr-1" />
                    <span className="text-xs font-medium">AI 도우미</span>
                  </div>
                )}
                <p className="text-sm">{chat.message}</p>
              </div>
            </div>
          ))}
          
          {isTyping && (
            <div className="flex justify-start mb-3">
              <div className="bg-gray-100 px-3 py-2 rounded-lg">
                <div className="flex items-center">
                  <SparklesIcon className="h-3 w-3 mr-1" />
                  <span className="text-xs font-medium mr-2">AI 도우미</span>
                </div>
                <div className="flex space-x-1 mt-1">
                  <div className="w-1 h-1 bg-gray-500 rounded-full animate-bounce"></div>
                  <div className="w-1 h-1 bg-gray-500 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                  <div className="w-1 h-1 bg-gray-500 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                </div>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* 메시지 입력 */}
        <div className="flex space-x-2">
          <input
            type="text"
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleChatSubmit()}
            placeholder="어떤 장소를 찾고 계신가요? 자유롭게 말씀해 주세요..."
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            disabled={isTyping}
          />
          <button
            onClick={handleChatSubmit}
            disabled={isTyping || !userInput.trim()}
            className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition duration-200 disabled:opacity-50"
          >
            💬
          </button>
        </div>

        {/* {!conversationMode && (
          <div className="mt-3 text-center">
            <button
              onClick={startConversation}
              className="text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              🤖 AI와 대화로 맞춤 추천 받기
            </button>
          </div>
        )} */}
      </div>

      {/* 기존 필터 섹션 및 즉시 추천 버튼 숨김 처리 */}
      {/* 
      <div className="space-y-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            카테고리 (AI가 자동으로 감지합니다)
          </label>
          <div className="grid grid-cols-3 gap-2">
            {categories.map(category => (
              <button
                key={category.value}
                onClick={() => handleFilterChange('category', category.value)}
                className={`p-2 text-sm rounded-lg border transition-colors ${
                  filters.category === category.value
                    ? 'border-primary-500 bg-primary-50 text-primary-700'
                    : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                }`}
              >
                <span className="mr-1">{category.icon}</span>
                {category.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            교통수단 (AI가 자동으로 감지합니다)
          </label>
          <div className="grid grid-cols-3 gap-2">
            {transportModes.map(mode => (
              <button
                key={mode.value}
                onClick={() => handleFilterChange('transportMode', mode.value)}
                className={`p-2 text-sm rounded-lg border transition-colors ${
                  filters.transportMode === mode.value
                    ? 'border-primary-500 bg-primary-50 text-primary-700'
                    : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                }`}
              >
                <span className="mr-1">{mode.icon}</span>
                {mode.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <button
        onClick={getRecommendations}
        disabled={loading}
        className="w-full bg-gradient-to-r from-primary-600 to-secondary-600 text-white py-3 px-4 rounded-lg hover:from-primary-700 hover:to-secondary-700 transition duration-200 disabled:opacity-50 flex items-center justify-center mb-6"
      >
        {loading ? (
          <>
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
            AI가 분석 중...
          </>
        ) : (
          <>
            <SparklesIcon className="h-4 w-4 mr-2" />
            즉시 추천받기
          </>
        )}
      </button>
      */}

      {/* 추천 결과 */}
      {recommendations.length > 0 && (
        <div className="mt-6">
          <h4 className="text-md font-medium text-gray-900 mb-4 flex items-center">
            <SparklesIcon className="h-5 w-5 mr-2 text-primary-600" />
            AI 맞춤 추천 장소 ({recommendations.length}개)
          </h4>
          <div className="space-y-4">
            {recommendations.map((place, index) => (
              <div
                key={place.id}
                className="border rounded-lg p-4 hover:bg-gradient-to-r hover:from-gray-50 hover:to-blue-50 transition-all transform hover:scale-[1.01]"
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center mb-2">
                      <span className="bg-gradient-to-r from-primary-100 to-secondary-100 text-primary-800 text-xs font-medium px-2 py-1 rounded mr-2">
                        #{index + 1} AI 추천
                      </span>
                      <div className="flex items-center">
                        {renderStars(place.rating)}
                        <span className="ml-1 text-sm text-gray-600">
                          ({place.rating.toFixed(1)})
                        </span>
                      </div>
                    </div>
                    
                    <h5 className="font-medium text-gray-900 mb-1">{place.name}</h5>
                    <p className="text-sm text-gray-600 mb-2">{place.address}</p>
                    
                    <div className="flex items-center text-sm text-gray-500 mb-2">
                      <ClockIcon className="h-4 w-4 mr-1" />
                      평균 이동시간: {place.estimatedTravelTime}분
                    </div>
                    
                    <p className="text-xs text-green-600 bg-gradient-to-r from-green-50 to-emerald-50 p-2 rounded border-l-2 border-green-400">
                      🤖 AI 분석: {place.reason}
                    </p>
                  </div>
                  
                  <button
                    onClick={() => onPlaceSelected && onPlaceSelected(place)}
                    className="ml-4 bg-gradient-to-r from-secondary-600 to-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:from-secondary-700 hover:to-primary-700 transition duration-200 transform hover:scale-105"
                  >
                    ✨ 선택
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 사용 팁 */}
      {recommendations.length === 0 && !loading && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 border border-blue-200">
          <h5 className="font-medium text-blue-900 mb-2 flex items-center">
            💡 AI 대화 추천 사용법
          </h5>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• "친구들과 맛있는 한식집 찾고 있어요"</li>
            <li>• "차로 이동할 수 있는 카페 추천해줘"</li>
            <li>• "지하철로 갈 수 있는 놀거리 있나요?"</li>
            <li>• "공원에서 산책하고 싶어요"</li>
          </ul>
          <p className="text-xs text-blue-600 mt-2">
            자연스럽게 대화하시면 AI가 여러분의 니즈를 파악해서 완벽한 장소를 추천해드립니다! 🎯
          </p>
        </div>
      )}
    </div>
  );
};

export default SmartRecommendation; 