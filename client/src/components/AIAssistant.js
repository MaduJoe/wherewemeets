import React, { useState, useRef, useEffect, useCallback } from 'react';
import api from '../utils/api';
import { useAuth } from '../contexts/AuthContext';
import { cleanAIResponse } from '../utils/placeUtils';
import './AIAssistant.css';

const AIAssistant = ({ meetingData, onPlaceRecommendation }) => {
  const { user, isAuthenticated } = useAuth();
  
  // 사용자별 고유 저장 키 생성
  const getChatHistoryKey = useCallback(() => {
    if (isAuthenticated && user?.id) {
      // 로그인한 사용자: userId 기반
      return `aiAssistant_chatHistory_${user.id}`;
    } else {
      // 게스트 사용자: 게스트 ID 기반
      const guestId = localStorage.getItem('guestUserId') || 'guest-' + Date.now();
      if (!localStorage.getItem('guestUserId')) {
        localStorage.setItem('guestUserId', guestId);
      }
      return `aiAssistant_chatHistory_${guestId}`;
    }
  }, [isAuthenticated, user?.id]);

  // localStorage에서 채팅 히스토리 복원
  const getStoredMessages = useCallback(() => {
    try {
      const chatHistoryKey = getChatHistoryKey();
      const stored = localStorage.getItem(chatHistoryKey);
      if (stored) {
        const parsedMessages = JSON.parse(stored);
        // timestamp를 Date 객체로 변환
        return parsedMessages.map(msg => ({
          ...msg,
          timestamp: new Date(msg.timestamp)
        }));
      }
    } catch (error) {
      console.error('채팅 히스토리 복원 실패:', error);
    }
    
    // 기본 환영 메시지
    return [
    {
      role: 'ai',
      content: '안녕하세요! 미팅 장소 추천 AI 도우미입니다. 🤖\n\n어떤 종류의 미팅이신가요? 참여자 수, 지역, 예산, 목적, 날씨, 교통 등을 알려주시면 최적의 장소를 추천해드릴게요!',
      timestamp: new Date()
    }
    ];
  }, [getChatHistoryKey]);

  const [messages, setMessages] = useState(getStoredMessages);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [shouldScroll, setShouldScroll] = useState(true);
  const messagesEndRef = useRef(null);
  const isInitialMount = useRef(true);

  // // 메시지 스크롤을 맨 아래로
  // const scrollToBottom = () => {
  //   messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  // };

  // 메시지가 변경될 때마다 localStorage에 저장
  useEffect(() => {
    try {
      const chatHistoryKey = getChatHistoryKey();
      localStorage.setItem(chatHistoryKey, JSON.stringify(messages));
    } catch (error) {
      console.error('채팅 히스토리 저장 실패:', error);
    }
    
    // // 초기 마운트가 아니고 shouldScroll이 true일 때만 스크롤
    // if (!isInitialMount.current && shouldScroll) {
    //   scrollToBottom();
    // }
    
    // 초기 마운트 플래그 해제
    if (isInitialMount.current) {
      isInitialMount.current = false;
    }
    
    // 스크롤 플래그 리셋
    setShouldScroll(true);
  }, [messages, shouldScroll, getChatHistoryKey]);

  // 컨텍스트 정보 생성 (대화 히스토리 포함)
  const generateContext = () => {
    // 최근 5개 메시지만 포함 (너무 많으면 API 한계 초과)
    const recentMessages = messages.slice(-5).map(msg => ({
      role: msg.role,
      content: msg.content,
      timestamp: msg.timestamp
    }));

    return {
      meetingId: meetingData?.id,
      currentPlaces: meetingData?.candidatePlaces?.map(place => ({
        name: place.name,
        category: place.category,
        location: place.address
      })) || [],
      participantCount: meetingData?.participants?.length || 0,
      existingVotes: meetingData?.votes || [],
      conversationHistory: recentMessages
    };
  };

  // AI에게 메시지 전송
  const sendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    // 게스트 사용자 사용량 체크 (장소 추천 키워드가 포함된 경우)
    const isPlaceRecommendation = inputMessage.toLowerCase().includes('추천') || 
                                 inputMessage.toLowerCase().includes('장소') ||
                                 inputMessage.toLowerCase().includes('곳') ||
                                 inputMessage.toLowerCase().includes('카페') ||
                                 inputMessage.toLowerCase().includes('음식점') ||
                                 inputMessage.toLowerCase().includes('레스토랑') ||
                                 inputMessage.toLowerCase().includes('맛집') ||
                                 inputMessage.toLowerCase().includes('공원') ||
                                 inputMessage.toLowerCase().includes('만날') ||
                                 inputMessage.toLowerCase().includes('미팅');

    if (!isAuthenticated && isPlaceRecommendation) {
      const today = new Date().toDateString();
      const lastUsageDate = localStorage.getItem('guestAIUsageDate');
      let guestUsage = 0;
      
      // 날짜가 바뀌었으면 사용량 리셋
      if (lastUsageDate !== today) {
        localStorage.setItem('guestAIUsageDate', today);
        localStorage.setItem('guestAIUsage', '0');
        guestUsage = 0;
      } else {
        guestUsage = parseInt(localStorage.getItem('guestAIUsage') || '0');
      }
      
      if (guestUsage >= 3) {
        const errorMessage = '🔒 오늘의 AI 장소 추천 사용량이 모두 소진되었습니다. 내일 자정에 다시 이용하거나 회원가입하여 더 많은 혜택을 받아보세요!';
        setError(errorMessage);
        
        const errorChatMessage = {
          role: 'error',
          content: errorMessage,
          timestamp: new Date()
        };
        
        setMessages(prev => [...prev, errorChatMessage]);
        return;
      }
    }

    // 로컬 스토리지에서 토큰 가져오기 (게스트는 토큰 없이도 가능)
    const token = localStorage.getItem('token');

    const userMessage = {
      role: 'user',
      content: inputMessage.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);
    setError(null);

    try {
      // 헤더 설정 (토큰이 있으면 추가)
      const config = {};
      if (token) {
        config.headers = {
          'Authorization': `Bearer ${token}`
        };
      }

      const response = await api.post('/aiAssistant/chat', {
        message: userMessage.content,
        context: generateContext()
      }, config);

      if (response.data.success) {
        // AI 응답에서 URL과 불필요한 정보를 정리
        const cleanedResponse = cleanAIResponse(response.data.data.response);
        
        const aiMessage = {
          role: 'ai',
          content: cleanedResponse,
          timestamp: new Date()
        };
        
        setMessages(prev => [...prev, aiMessage]);

        // 게스트 사용자의 경우 일일 장소 추천 사용량 증가
        if (!isAuthenticated && isPlaceRecommendation) {
          const today = new Date().toDateString();
          const lastUsageDate = localStorage.getItem('guestAIUsageDate');
          let currentUsage = 0;
          
          // 날짜가 바뀌었으면 사용량 리셋
          if (lastUsageDate !== today) {
            localStorage.setItem('guestAIUsageDate', today);
            localStorage.setItem('guestAIUsage', '0');
            currentUsage = 0;
          } else {
            currentUsage = parseInt(localStorage.getItem('guestAIUsage') || '0');
          }
          
          const newUsage = currentUsage + 1;
          localStorage.setItem('guestAIUsage', newUsage.toString());
          
          if (newUsage >= 3) {
            const limitMessage = {
              role: 'ai',
              content: '⚠️ 오늘의 AI 추천 사용량이 모두 소진되었습니다. 내일 자정에 다시 이용하거나 회원가입하여 더 많은 혜택을 받아보세요!',
              timestamp: new Date()
            };
            setMessages(prev => [...prev, limitMessage]);
          }
        }
      } else {
        throw new Error(response.data.message || 'AI 응답을 받을 수 없습니다.');
      }

    } catch (error) {
      console.error('AI 채팅 에러:', error);
      
      let errorMessage = 'AI 도우미와 연결할 수 없습니다.';
      
      if (error.response?.status === 401) {
        errorMessage = '🔒 인증이 만료되었습니다. 다시 로그인해주세요.';
      } else if (error.response?.status === 403) {
        errorMessage = '🔒 AI 도우미는 프리미엄 전용 기능입니다.\n구독을 업그레이드해주세요!';
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      }

      setError(errorMessage);
      
      // 에러 메시지도 채팅에 추가
      const errorChatMessage = {
        role: 'error',
        content: errorMessage,
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, errorChatMessage]);
      
    } finally {
      setIsLoading(false);
    }
  };

  // 엔터키로 메시지 전송
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // AI 추천 장소를 미팅에 추가
  const addRecommendedPlace = (placeName, category, address) => {
    if (onPlaceRecommendation) {
      // 장소 데이터 구조를 PlaceExplorer와 동일하게 맞춤
      const placeData = {
        id: `ai-${Date.now()}`,
        name: placeName,
        category: category || 'restaurant',
        address: address || '주소 정보 없음',
        coordinates: {
          lat: 37.5665, // 서울 기본 좌표
          lng: 126.9780
        },
        rating: 0,
        phone: '',
        photos: [],
        source: 'ai_recommendation'
      };
      
      onPlaceRecommendation(placeData);
      
      // 스크롤 방지 플래그 설정
      setShouldScroll(false);
      
      // 성공 메시지 추가
      const successMessage = {
        role: 'ai',
        content: `✅ "${placeName}"이(가) 후보 장소에 추가되었습니다!`,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, successMessage]);
    }
  };

  // 장소명을 기반으로 카테고리 자동 분류
  const categorizePlace = (placeName) => {
    if (!placeName) return 'other';
    
    const name = placeName.toLowerCase();
    
    // 카페 관련 키워드
    const cafeKeywords = ['카페', 'cafe', '커피', 'coffee', '스타벅스', '이디야', '투썸', '할리스', '파스쿠찌', '엔젤리너스', '커피빈', '컴포즈커피', '빽다방', '메가커피', '더벤티'];
    if (cafeKeywords.some(keyword => name.includes(keyword))) {
      return 'cafe';
    }
    
    // 공원 관련 키워드
    const parkKeywords = ['공원', 'park', '한강공원', '올림픽공원', '월드컵공원', '보라매공원', '어린이대공원', '서울숲', '남산공원', '경의선숲길', '선유도공원', '양재천', '청계천', '반포한강공원'];
    if (parkKeywords.some(keyword => name.includes(keyword))) {
      return 'park';
    }
    
    // 오락시설 관련 키워드
    const entertainmentKeywords = ['노래방', '볼링', '당구', '스크린골프', '보드게임', '방탈출', '피시방', 'pc방', '게임', '오락실', '롤링볼', '클라이밍', '영화관', 'cgv', '메가박스', '롯데시네마'];
    if (entertainmentKeywords.some(keyword => name.includes(keyword))) {
      return 'entertainment';
    }
    
    // 쇼핑 관련 키워드
    const shoppingKeywords = ['쇼핑몰', '백화점', '마트', '아울렛', '롯데월드몰', '코엑스몰', '신세계', '롯데백화점', '현대백화점', '갤러리아', '더현대', '이마트', '홈플러스', '롯데마트'];
    if (shoppingKeywords.some(keyword => name.includes(keyword))) {
      return 'shopping';
    }
    
    // 술집/바 관련 키워드
    const barKeywords = ['술집', '호프', '맥주', '치킨', '바', 'bar', '펜션', '이자카야', 'pub'];
    if (barKeywords.some(keyword => name.includes(keyword))) {
      return 'restaurant'; // 술집도 음식점 카테고리로 분류
    }
    
    // 특정 음식점 브랜드나 음식 키워드
    const restaurantKeywords = ['맛집', '식당', '레스토랑', '한식', '중식', '일식', '양식', '분식', '김밥', '냉면', '갈비', '삼겹살', '불고기', '피자', '치킨', '햄버거', '파스타', '스시', '라면', '국수', '찌개', '전골', '구이', 'bbq', 'kfc', '맥도날드', '버거킹', '롯데리아', '파리바게뜨', '뚜레쥬르'];
    if (restaurantKeywords.some(keyword => name.includes(keyword))) {
      return 'restaurant';
    }
    
    // 기본값은 음식점으로 설정 (기존 동작 유지)
    return 'restaurant';
  };

  // AI 응답에서 장소명 추출
  const extractPlacesFromResponse = (content) => {
    const places = [];
    
    // 패턴 1: 1. 장소명 또는 2. 장소명 등 (숫자와 점으로 시작)
    const pattern1 = /(\d+\.\s*)([^\n\r:]+)/g;
    let match;
    while ((match = pattern1.exec(content)) !== null) {
      const placeName = match[2].trim();
      // 한글, 영어, 숫자를 포함하고 있고, 너무 길지 않은 경우만
      if (placeName && placeName.match(/[가-힣a-zA-Z0-9]/) && placeName.length < 50) {
        places.push({
          name: placeName,
          category: categorizePlace(placeName), // 자동 카테고리 분류
          address: ''
        });
      }
    }
    
    // 패턴 2: - 장소명: 또는 • 장소명:
    const pattern2 = /[•-]\s*([^:\n\r]+):/g;
    while ((match = pattern2.exec(content)) !== null) {
      const placeName = match[1].trim();
      if (placeName && placeName.match(/[가-힣a-zA-Z0-9]/) && placeName.length < 50) {
        places.push({
          name: placeName,
          category: categorizePlace(placeName), // 자동 카테고리 분류
          address: ''
        });
      }
    }
    
    // 패턴 3: **장소명** (기존 패턴도 유지)
    const pattern3 = /\*\*([^*\n\r]+)\*\*/g;
    while ((match = pattern3.exec(content)) !== null) {
      const placeName = match[1].trim();
      // 숫자와 점으로 시작하는 경우 제거 (예: "1. 스타벅스" -> "스타벅스")
      const cleanedName = placeName.replace(/^\d+\.\s*/, '');
      if (cleanedName && cleanedName.match(/[가-힣a-zA-Z0-9]/) && cleanedName.length < 50) {
        places.push({
          name: cleanedName,
          category: categorizePlace(cleanedName), // 자동 카테고리 분류
          address: ''
        });
      }
    }
    
    // 중복 제거
    const uniquePlaces = places.filter((place, index, self) => 
      index === self.findIndex(p => p.name === place.name)
    );
    
    return uniquePlaces.slice(0, 5); // 최대 5개까지만
  };

  // 채팅 히스토리 초기화
  const clearChatHistory = () => {
    const confirmClear = window.confirm('채팅 히스토리를 모두 삭제하시겠습니까?');
    if (confirmClear) {
      const initialMessage = {
        role: 'ai',
        content: '안녕하세요! 미팅 장소 추천 AI 도우미입니다. 🤖\n\n어떤 종류의 미팅이신가요? 참여자 수, 지역, 예산, 목적, 날씨, 교통 등을 알려주시면 최적의 장소를 추천해드릴게요!',
        timestamp: new Date()
      };
      setMessages([initialMessage]);
      const chatHistoryKey = getChatHistoryKey();
      localStorage.removeItem(chatHistoryKey);
    }
  };

  // 메시지 렌더링
  const renderMessage = (message, index) => {
    const isUser = message.role === 'user';
    const isError = message.role === 'error';
    const isAI = message.role === 'ai';
    
    // AI 응답에서 장소 추출
    const extractedPlaces = isAI ? extractPlacesFromResponse(message.content) : [];
    
    return (
      <div key={index} className={`message ${isUser ? 'user' : isError ? 'error' : 'ai'}`}>
        <div className="message-avatar">
          {isUser ? '👤' : isError ? '⚠️' : '🤖'}
        </div>
        <div className="message-content">
          <div className="message-bubble">
            {message.content.split('\n').map((line, i) => (
              <div key={i}>
                {line}
                {i < message.content.split('\n').length - 1 && <br />}
              </div>
            ))}
          </div>
          
          {/* AI 응답에서 추출된 장소들에 대한 선택 버튼 */}
          {extractedPlaces.length > 0 && (
            <div className="ai-places-actions">
              <div className="places-header">
                <span>🎯 추천 장소를 후보에 추가하시겠습니까?</span>
              </div>
              <div className="places-buttons">
                {extractedPlaces.map((place, placeIndex) => (
                  <button
                    key={placeIndex}
                    onClick={() => addRecommendedPlace(place.name, place.category, place.address)}
                    className="add-place-btn"
                    title={`"${place.name}"을(를) 후보 장소에 추가`}
                  >
                    ➕ {place.name}
                  </button>
                ))}
              </div>
            </div>
          )}
          
          <div className="message-time">
            {message.timestamp.toLocaleTimeString('ko-KR', { 
              hour: '2-digit', 
              minute: '2-digit' 
            })}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="ai-assistant">
      <div className="ai-assistant-header">
        <h3>🤖 AI 장소 추천 도우미</h3>
        <div className="header-actions">
          <button 
            onClick={clearChatHistory}
            className="clear-chat-btn"
            title="채팅 히스토리 초기화"
          >
            🗑️
          </button>
        <div className="premium-badge">
          ✨ Premium
          </div>
        </div>
      </div>

      <div className="ai-chat-container">
        <div className="messages-container">
          {messages.map((message, index) => renderMessage(message, index))}
          
          {isLoading && (
            <div className="message ai">
              <div className="message-avatar">🤖</div>
              <div className="message-content">
                <div className="message-bubble loading">
                  <div className="typing-indicator">
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                  AI가 생각하고 있습니다...
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        <div className="input-container">
          <div className="input-wrapper">
            <textarea
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="미팅 장소에 대해 궁금한 것을 물어보세요..."
              disabled={isLoading}
              rows={1}
            />
            <button 
              onClick={sendMessage}
              disabled={isLoading || !inputMessage.trim()}
              className="send-button"
            >
              {isLoading ? '⏳' : '📤'}
            </button>
          </div>
          
          <div className="quick-suggestions">
            <button 
              onClick={() => setInputMessage('강남 근처에서 4명이 회의하기 좋은 카페 추천해주세요')}
              className="suggestion-chip"
              disabled={isLoading}
            >
              💼 비즈니스 미팅
            </button>
            <button 
              onClick={() => setInputMessage('친구들과 맛있는 음식 먹으면서 만날 수 있는 곳 추천해주세요')}
              className="suggestion-chip"
              disabled={isLoading}
            >
              🍽️ 식사 모임
            </button>
            <button 
              onClick={() => setInputMessage('조용하고 프라이빗한 분위기에서 대화하기 좋은 곳은 어디인가요?')}
              className="suggestion-chip"
              disabled={isLoading}
            >
              💬 대화 중심
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="error-banner">
          {error}
        </div>
      )}
    </div>
  );
};

export default AIAssistant; 