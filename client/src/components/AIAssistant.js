import React, { useState, useRef, useEffect } from 'react';
import api from '../utils/api';
import { useAuth } from '../contexts/AuthContext';
import './AIAssistant.css';

const AIAssistant = ({ meetingData, onPlaceRecommendation }) => {
  const { user, isAuthenticated } = useAuth();
  
  // localStorage에서 채팅 히스토리 복원
  const getStoredMessages = () => {
    try {
      const stored = localStorage.getItem('aiAssistant_chatHistory');
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
      content: '안녕하세요! 미팅 장소 추천 AI 도우미입니다. 🤖\n\n어떤 종류의 미팅이신가요? 참여자 수, 지역, 예산, 목적 등을 알려주시면 최적의 장소를 추천해드릴게요!',
      timestamp: new Date()
    }
    ];
  };

  const [messages, setMessages] = useState(getStoredMessages);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const messagesEndRef = useRef(null);

  // 메시지 스크롤을 맨 아래로
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // 메시지가 변경될 때마다 localStorage에 저장
  useEffect(() => {
    try {
      localStorage.setItem('aiAssistant_chatHistory', JSON.stringify(messages));
    } catch (error) {
      console.error('채팅 히스토리 저장 실패:', error);
    }
    scrollToBottom();
  }, [messages]);

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

    // 인증 확인
    if (!isAuthenticated) {
      const errorMessage = '🔒 AI 도우미를 사용하려면 로그인이 필요합니다.';
      setError(errorMessage);
      
      const errorChatMessage = {
        role: 'error',
        content: errorMessage,
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, errorChatMessage]);
      return;
    }

    // 로컬 스토리지에서 토큰 가져오기
    const token = localStorage.getItem('token');
    if (!token) {
      const errorMessage = '🔒 로그인 토큰이 없습니다. 다시 로그인해주세요.';
      setError(errorMessage);
      
      const errorChatMessage = {
        role: 'error',
        content: errorMessage,
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, errorChatMessage]);
      return;
    }

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
      const response = await api.post('/aiAssistant/chat', {
        message: userMessage.content,
        context: generateContext()
      });

      if (response.data.success) {
        const aiMessage = {
          role: 'ai',
          content: response.data.data.response,
          timestamp: new Date()
        };
        
        setMessages(prev => [...prev, aiMessage]);
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
      
      // 성공 메시지 추가
      const successMessage = {
        role: 'ai',
        content: `✅ "${placeName}"이(가) 후보 장소에 추가되었습니다!`,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, successMessage]);
    }
  };

  // AI 응답에서 장소명 추출
  const extractPlacesFromResponse = (content) => {
    const places = [];
    
    // 패턴 1: **1. 장소명** 또는 **장소명**
    const pattern1 = /\*\*(?:\d+\.\s*)?([^*]+)\*\*/g;
    let match;
    while ((match = pattern1.exec(content)) !== null) {
      const placeName = match[1].trim();
      if (placeName && placeName.length > 1 && placeName.length < 50) {
        places.push({
          name: placeName,
          category: 'restaurant', // 기본값
          address: ''
        });
      }
    }
    
    // 패턴 2: - 장소명: 또는 • 장소명:
    const pattern2 = /[•\-]\s*([^:]+):/g;
    while ((match = pattern2.exec(content)) !== null) {
      const placeName = match[1].trim();
      if (placeName && placeName.length > 1 && placeName.length < 50) {
        places.push({
          name: placeName,
          category: 'restaurant',
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
        content: '안녕하세요! 미팅 장소 추천 AI 도우미입니다. 🤖\n\n어떤 종류의 미팅이신가요? 참여자 수, 지역, 예산, 목적 등을 알려주시면 최적의 장소를 추천해드릴게요!',
        timestamp: new Date()
      };
      setMessages([initialMessage]);
      localStorage.removeItem('aiAssistant_chatHistory');
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