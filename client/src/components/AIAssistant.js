import React, { useState, useRef, useEffect, useCallback } from 'react';
import api from '../utils/api';
import { useAuth } from '../contexts/AuthContext';
import { cleanAIResponse } from '../utils/placeUtils';
import { 
  checkGuestAIUsage, 
  incrementGuestAIUsage, 
  USER_LEVELS,
  SESSION_KEYS 
} from '../utils/sessionUtils';
import './AIAssistant.css';

const AIAssistant = ({ meetingData, onPlaceRecommendation }) => {
  const { user, isAuthenticated, userLevel, userPermissions, guestSession, checkSessionExpiry } = useAuth();
  
  // 사용자별 고유 저장 키 생성
  const getChatHistoryKey = useCallback(() => {
    if (isAuthenticated && user?.id) {
      // 로그인한 사용자: userId 기반
      return `${SESSION_KEYS.GUEST_CHAT_HISTORY}${user.id}`;
    } else if (user?.isGuest && user.id) {
      // 게스트 사용자: 게스트 ID 기반
      return `${SESSION_KEYS.GUEST_CHAT_HISTORY}${user.id}`;
    } else {
      // 폴백: 임시 키
      return `${SESSION_KEYS.GUEST_CHAT_HISTORY}temp-${Date.now()}`;
    }
  }, [isAuthenticated, user?.id]);

  // localStorage에서 채팅 히스토리 복원
  const getStoredMessages = useCallback(() => {
    try {
      const chatHistoryKey = getChatHistoryKey();
      const stored = localStorage.getItem(chatHistoryKey);
      if (stored) {
        const parsedMessages = JSON.parse(stored);
        // timestamp를 Date 객체로 변환하고 세션 유효성 확인
        const validMessages = parsedMessages.map(msg => ({
          ...msg,
          timestamp: new Date(msg.timestamp)
        }));
        
        // 게스트 사용자의 경우 세션 유효성 확인
        if (user?.isGuest && !checkSessionExpiry()) {
          // 세션이 만료되었으면 기본 메시지 반환
          return getDefaultMessages();
        }
        
        return validMessages;
      }
    } catch (error) {
      console.error('채팅 히스토리 복원 실패:', error);
    }
    
    return getDefaultMessages();
  }, [getChatHistoryKey, user?.isGuest, checkSessionExpiry]);

  // 기본 환영 메시지 생성
  const getDefaultMessages = useCallback(() => {
    const welcomeMessage = userLevel === USER_LEVELS.GUEST
      ? `안녕하세요! 미팅 장소 추천 AI 도우미입니다. 🤖\n\n게스트 사용자는 하루 ${userPermissions.aiDailyLimit}회까지 AI 추천을 무료로 체험할 수 있습니다.\n\n어떤 종류의 미팅이신가요? 참여자 수, 지역, 예산, 목적 등을 알려주시면 최적의 장소를 추천해드릴게요!`
      : `안녕하세요! 미팅 장소 추천 AI 도우미입니다. 🤖\n\n어떤 종류의 미팅이신가요? 참여자 수, 지역, 예산, 목적, 날씨, 교통 등을 알려주시면 최적의 장소를 추천해드릴게요!`;
    
    return [
      {
        role: 'ai',
        content: welcomeMessage,
        timestamp: new Date()
      }
    ];
  }, [userLevel, userPermissions.aiDailyLimit]);

  const [messages, setMessages] = useState(getStoredMessages);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [shouldScroll, setShouldScroll] = useState(true);
  const [aiUsageStatus, setAiUsageStatus] = useState({ used: 0, remaining: 0, canUse: true });
  const messagesEndRef = useRef(null);
  const isInitialMount = useRef(true);

  // 토스트 팝업 상태 추가
  const [toastMessage, setToastMessage] = useState('');
  const [showToast, setShowToast] = useState(false);
  const [toastType, setToastType] = useState('success'); // success, error, warning

  // 게스트 사용자 AI 사용량 상태 업데이트
  useEffect(() => {
    if (userLevel === USER_LEVELS.GUEST) {
      const usage = checkGuestAIUsage();
      setAiUsageStatus(usage);
    } else {
      // 무료/유료 사용자는 다른 제한이 있을 수 있음
      setAiUsageStatus({ 
        used: 0, 
        remaining: userPermissions.aiDailyLimit === -1 ? 'unlimited' : userPermissions.aiDailyLimit, 
        canUse: true 
      });
    }
  }, [userLevel, userPermissions.aiDailyLimit]);

  // 토스트 팝업 표시 함수
  const showToastNotification = (message, type = 'success') => {
    setToastMessage(message);
    setToastType(type);
    setShowToast(true);
    
    // 3초 후 자동으로 사라지게
    setTimeout(() => {
      setShowToast(false);
    }, 3000);
  };

  // 메시지가 변경될 때마다 localStorage에 저장
  useEffect(() => {
    try {
      const chatHistoryKey = getChatHistoryKey();
      localStorage.setItem(chatHistoryKey, JSON.stringify(messages));
    } catch (error) {
      console.error('채팅 히스토리 저장 실패:', error);
    }
    
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
      conversationHistory: recentMessages,
      userLevel: userLevel,
      userPermissions: userPermissions
    };
  };

  // AI에게 메시지 전송
  const sendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    // 세션 만료 확인
    if (userLevel === USER_LEVELS.GUEST && !checkSessionExpiry()) {
      return;
    }

    // 장소 추천 요청인지 확인
    const isPlaceRecommendation = inputMessage.toLowerCase().includes('추천') || 
                                 inputMessage.toLowerCase().includes('장소') ||
                                 inputMessage.toLowerCase().includes('곳') ||
                                 inputMessage.toLowerCase().includes('카페') ||
                                 inputMessage.toLowerCase().includes('음식점') ||
                                 inputMessage.toLowerCase().includes('레스토랑') ||
                                 inputMessage.toLowerCase().includes('맛집') ||
                                 inputMessage.toLowerCase().includes('공원') ||
                                 inputMessage.toLowerCase().includes('만날') ||
                                 inputMessage.toLowerCase().includes('미팅') ||
                                 inputMessage.toLowerCase().includes('위스키') ||
                                 inputMessage.toLowerCase().includes('술집') ||
                                 inputMessage.toLowerCase().includes('바') ||
                                 inputMessage.toLowerCase().includes('펍') ||
                                 inputMessage.toLowerCase().includes('호프') ||
                                 inputMessage.toLowerCase().includes('칵테일') ||
                                 inputMessage.toLowerCase().includes('맥주') ||
                                 inputMessage.toLowerCase().includes('소주') ||
                                 inputMessage.toLowerCase().includes('와인');

    // 게스트 사용자 사용량 체크
    if (userLevel === USER_LEVELS.GUEST && isPlaceRecommendation) {
      const usage = checkGuestAIUsage();
      if (!usage.canUse) {
        const errorMessage = `🔒 오늘의 AI 장소 추천 사용량이 모두 소진되었습니다 (${usage.used}/${usage.limit}회 사용).\n\n💡 더 많은 AI 추천을 원하시면:\n• 내일 자정에 다시 이용하거나\n• 회원가입하여 더 많은 혜택을 받아보세요!`;
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

    // 로컬 스토리지에서 토큰 가져오기
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
      }, {
        ...config,
        timeout: 30000 // AI Assistant는 30초 timeout
      });

      if (response.data.success) {
        // AI 응답에서 URL과 불필요한 정보를 정리
        const cleanedResponse = cleanAIResponse(response.data.data.response);
        
        // AI 응답에서 장소 추출 및 검증
        const extractedPlaces = extractPlacesFromResponse(cleanedResponse);
        
        // 장소가 추출되면 실제 존재 여부 검증
        if (extractedPlaces.length > 0) {
          console.log(`🔍 ${extractedPlaces.length}개 장소 검증 중...`);
          
          try {
            const verifyResponse = await api.post('/aiAssistant/verify-places', {
              places: extractedPlaces,
              userMessage: userMessage.content // 사용자 메시지 전체를 보내서 백엔드에서 지역 추출
            }, {
              timeout: 20000 // 장소 검증은 20초 timeout
            });
            
            if (verifyResponse.data.success) {
              const verifiedPlaces = verifyResponse.data.verifiedPlaces;
              console.log(`✅ ${verifiedPlaces.length}/${extractedPlaces.length}개 장소가 실제로 존재함`);
              
              // 검증 결과에 따른 메시지 내용 조정
              let finalContent = cleanedResponse;
              
              if (verifiedPlaces.length === 0) {
                finalContent = '⚠️ 추천한 장소들이 실제로 존재하지 않습니다. 다른 조건으로 다시 질문해주세요.';
              } else if (verifiedPlaces.length < extractedPlaces.length) {
                // 일부만 검증된 경우 간단한 알림 추가
                finalContent = `${cleanedResponse}\n\n📍 ${extractedPlaces.length}개 중 ${verifiedPlaces.length}개 장소가 실제로 존재하여 표시됩니다.`;
              }
              
              // 검증된 장소 정보로 AI 메시지 생성 (1개만!)
              const aiMessage = {
                role: 'ai',
                content: finalContent,
                timestamp: new Date(),
                verifiedPlaces: verifiedPlaces.length > 0 ? verifiedPlaces : null // 검증된 장소가 있을 때만 추가
              };
              
              setMessages(prev => [...prev, aiMessage]);
              
            } else {
              throw new Error('장소 검증에 실패했습니다.');
            }
            
                     } catch (verifyError) {
             console.error('장소 검증 실패:', verifyError);
             
             // 검증 실패 시 원본 AI 응답 + 경고 메시지 (1개로 통합)
             const aiMessage = {
               role: 'ai',
               content: `${cleanedResponse}\n\n⚠️ 장소 검증 중 오류가 발생했습니다. 추천 장소의 정확성을 보장할 수 없습니다.`,
               timestamp: new Date()
             };
             
             setMessages(prev => [...prev, aiMessage]);
           }
        } else {
          // 장소 추천이 아닌 일반 응답
          const aiMessage = {
            role: 'ai',
            content: cleanedResponse,
            timestamp: new Date()
          };
          
          setMessages(prev => [...prev, aiMessage]);
        }

        // 게스트 사용자의 경우 AI 사용량 업데이트
        if (userLevel === USER_LEVELS.GUEST && isPlaceRecommendation) {
          const updatedUsage = incrementGuestAIUsage();
          setAiUsageStatus(updatedUsage);
          
          if (!updatedUsage.canUse) {
            const limitMessage = {
              role: 'ai',
              content: `⚠️ 오늘의 AI 추천 사용량이 모두 소진되었습니다 (${updatedUsage.used}/${updatedUsage.limit}회 사용).\n\n회원가입하시면 더 많은 AI 추천을 받으실 수 있습니다! 🚀`,
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
      
      if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
        errorMessage = '⏰ AI 응답 시간이 초과되었습니다. 잠시 후 다시 시도해주세요.';
      } else if (error.response?.status === 401) {
        errorMessage = '🔒 인증이 만료되었습니다. 다시 로그인해주세요.';
      } else if (error.response?.status === 403) {
        errorMessage = '🔒 AI 도우미는 프리미엄 전용 기능입니다.\n구독을 업그레이드해주세요!';
      } else if (error.response?.status === 429) {
        errorMessage = '⚠️ AI API 사용량 한도를 초과했습니다. 잠시 후 다시 시도해주세요.';
      } else if (error.response?.status === 503) {
        // 서버에서 보내는 구체적인 메시지 활용
        if (error.response.data?.message) {
          errorMessage = error.response.data.message;
          
          // 재시도 시간 정보가 있으면 추가
          if (error.response.data.retryAfter) {
            errorMessage += `\n\n💡 ${error.response.data.retryAfter}초 후 다시 시도해보세요.`;
          }
          
          // 대안 행동 제안이 있으면 추가
          if (error.response.data.fallbackAction) {
            errorMessage += `\n\n🔄 대안: ${error.response.data.fallbackAction}`;
          }
        } else {
          errorMessage = '🛠️ AI 서비스에 일시적인 문제가 발생했습니다. 잠시 후 다시 시도해주세요.';
        }
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

  // AI 추천 장소를 미팅에 추가 또는 그룹투표에 직접 추가
  const addRecommendedPlace = async (placeName, category, address, verifiedPlace = null) => {
    try {
      // 검증된 장소 정보가 있으면 사용, 없으면 기본값 사용
      const placeData = verifiedPlace ? {
        id: verifiedPlace.id || `ai-${Date.now()}`,
        name: verifiedPlace.name || placeName,
        category: verifiedPlace.category || category || 'restaurant',
        address: verifiedPlace.address || address || '주소 정보 없음',
        coordinates: verifiedPlace.coordinates || {
          lat: 37.5665, // 서울 기본 좌표
          lng: 126.9780
        },
        rating: verifiedPlace.rating || 0,
        phone: verifiedPlace.phone || '',
        photos: verifiedPlace.photos || [],
        place_url: verifiedPlace.place_url || '',
        verified: verifiedPlace.verified || false,
        source: 'ai_recommendation_verified',
        addedBy: {
          id: isAuthenticated ? user?.id || 'ai-user' : 'ai-guest',
          name: isAuthenticated ? user?.name || 'AI 사용자' : 'AI 게스트',
          email: isAuthenticated ? user?.email || 'ai@wherewemeets.com' : 'guest@wherewemeets.com'
        }
      } : {
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
        source: 'ai_recommendation',
        addedBy: {
          id: isAuthenticated ? user?.id || 'ai-user' : 'ai-guest',
          name: isAuthenticated ? user?.name || 'AI 사용자' : 'AI 게스트',
          email: isAuthenticated ? user?.email || 'ai@wherewemeets.com' : 'guest@wherewemeets.com'
        }
      };
      
      // meetingData가 있고 meetingId가 있으면 직접 투표 후보지에 추가
      if (meetingData?.id) {
        try {
          console.log('🗳️ 그룹투표에 직접 추가 시도:', { meetingId: meetingData.id, place: placeData });
          
          const response = await api.post(`/votes/${meetingData.id}/candidates`, {
            place: placeData
          });
          
          if (response.data.success) {
            // 성공 토스트 팝업 표시
            showToastNotification(`✅ "${placeName}"이(가) 그룹투표 후보지에 추가되었습니다!`, 'success');
            return;
          }
        } catch (error) {
          console.error('그룹투표 후보지 추가 실패:', error);
          
          // 실패 시 기존 방식으로 폴백
          if (onPlaceRecommendation) {
            onPlaceRecommendation(placeData);
            showToastNotification(`⚠️ 그룹투표 직접 추가에 실패하여 임시 후보지로 추가했습니다.`, 'warning');
          }
          return;
        }
      }
      
      // meetingData가 없거나 meetingId가 없으면 기존 방식 사용
      if (onPlaceRecommendation) {
        onPlaceRecommendation(placeData);
        
        // 스크롤 방지 플래그 설정
        setShouldScroll(false);
        
        // 성공 토스트 팝업 표시
        showToastNotification(`✅ "${placeName}"이(가) 후보 장소에 추가되었습니다!`, 'success');
      }
      
    } catch (error) {
      console.error('장소 추가 실패:', error);
      showToastNotification(`❌ "${placeName}" 추가에 실패했습니다.`, 'error');
    }
  };

  // 장소 카테고리 분류 함수
  const categorizePlace = (placeName) => {
    const name = placeName.toLowerCase();
    
    // 카테고리별 키워드 매칭
    if (name.includes('카페') || name.includes('cafe') || name.includes('커피') || name.includes('coffee')) {
      return 'cafe';
    } else if (name.includes('공원') || name.includes('park') || name.includes('산') || name.includes('숲')) {
      return 'park';
    } else if (name.includes('노래방') || name.includes('pc방') || name.includes('볼링') || name.includes('당구')) {
      return 'entertainment';
    } else if (name.includes('마트') || name.includes('쇼핑') || name.includes('백화점') || name.includes('몰')) {
      return 'shopping';
    } else if (name.includes('바') || name.includes('pub') || name.includes('술집')) {
      return 'bar';
    } else {
      return 'restaurant'; // 기본값
    }
  };

  // AI 응답에서 장소 정보 추출 (개선된 버전)
  const extractPlacesFromResponse = (content) => {
    const places = [];
    
    // "* 장소명:" 패턴으로 시작하는 줄들을 찾음
    const lines = content.split('\n');
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      
      // "* 장소명:" 패턴 체크
      if (trimmedLine.startsWith('*') && trimmedLine.includes(':')) {
        const colonIndex = trimmedLine.indexOf(':');
        const placeName = trimmedLine.substring(1, colonIndex).trim();
        const description = trimmedLine.substring(colonIndex + 1).trim();
        
        // 장소명이 유효한지 확인
        if (isValidPlaceName(placeName)) {
          const extractedAddress = extractAddressFromDescription(description);
          places.push({
            name: placeName,
            description: description,
            category: categorizePlace(placeName),
            address: extractedAddress,
            hasAddress: !!extractedAddress
          });
        }
      }
    }
    
    return places;
  };

  // 유효한 장소명인지 확인
  const isValidPlaceName = (placeName) => {
    // 너무 짧거나 일반적인 단어들 제외
    const invalidKeywords = [
      '예약', '가격', '시간', '영업', '주차', '교통', '위치', '분위기', '메뉴', '서비스',
      '추천', '장소', '곳', '지역', '거리', '접근', '이용', '방문', '선택', '고려'
    ];
    
    if (placeName.length < 2 || placeName.length > 30) {
      return false;
    }
    
    // 금지 키워드 체크
    for (const keyword of invalidKeywords) {
      if (placeName.includes(keyword)) {
        return false;
      }
    }
    
    return true;
  };

  // 설명에서 주소 추출 시도
  const extractAddressFromDescription = (description) => {
    // 주소 관련 패턴들
    const addressPatterns = [
      // 서울 지역명 패턴
      /([가-힣]+구\s*[가-힣]+동)/g,
      /([가-힣]+시\s*[가-힣]+구)/g,
      /([가-힣]+역\s*근처|[가-힣]+역)/g,
      // 도로명, 길 이름 패턴
      /([가-힣]+로\s*\d+)/g,
      /([가-힣]+길\s*\d+)/g,
      // 건물명, 지점명 패턴
      /([가-힣\s]+점)/g,
      /([가-힣]+\s*[가-힣]*센터)/g,
      /([가-힣]+\s*[가-힣]*몰)/g,
    ];
    
    // 패턴 매칭으로 주소 찾기
    for (const pattern of addressPatterns) {
      const matches = description.match(pattern);
      if (matches && matches.length > 0) {
        return matches[0].trim();
      }
    }
    
    // 간단한 키워드 기반 추출
    const addressKeywords = ['역', '구', '동', '로', '길', '센터', '몰', '타워', '빌딩'];
    const words = description.split(/\s+|,|\.|\n/);
    
    for (const word of words) {
      const cleanWord = word.trim();
      for (const keyword of addressKeywords) {
        if (cleanWord.includes(keyword) && cleanWord.length >= 3 && cleanWord.length <= 15) {
          return cleanWord;
        }
      }
    }
    
    return null;
  };

  // 자동 스크롤
  useEffect(() => {
    if (shouldScroll) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, shouldScroll]);

  // 채팅 히스토리 초기화
  const clearChatHistory = () => {
    const confirmClear = window.confirm('채팅 히스토리를 모두 삭제하시겠습니까?');
    if (confirmClear) {
      const initialMessages = getDefaultMessages();
      setMessages(initialMessages);
      const chatHistoryKey = getChatHistoryKey();
      localStorage.removeItem(chatHistoryKey);
      showToastNotification('채팅 히스토리가 초기화되었습니다.', 'success');
    }
  };

  // 메시지 렌더링
  const renderMessage = (message, index) => {
    const isUser = message.role === 'user';
    const isError = message.role === 'error';
    const isAI = message.role === 'ai';
    
    // 검증된 장소 정보 사용 (있으면 우선 사용, 없으면 기존 추출 방식)
    let extractedPlaces = message.verifiedPlaces || (isAI ? extractPlacesFromResponse(message.content) : []);
    
    // AI 응답 내용 필터링 - 장소 추천이 있을 때는 간단한 요약으로 표시
    let filteredContent = message.content;
    
    if (extractedPlaces.length > 0) {
      // 장소 추천이 있으면 간단한 설명만 표시
      const lines = message.content.split('\n');
      const summaryLines = lines.filter(line => 
        !line.trim().startsWith('*') && 
        line.trim().length > 0 && 
        !line.includes('추천') &&
        !line.includes('장소')
      );
      
      if (summaryLines.length > 0) {
        filteredContent = summaryLines.slice(0, 2).join('\n');
      } 
      else {
        // filteredContent = '다음 장소들을 추천드립니다:';
        filteredContent = '';
      }
    }

    return (
      <div key={index} className={`message ${isUser ? 'user' : isError ? 'error' : 'ai'}`}>
        <div className="message-avatar">
          {isUser ? '👤' : isError ? '⚠️' : '🤖'}
        </div>
        
        <div className="message-content">
          <div className={`message-bubble ${isUser ? 'user' : isError ? 'error' : 'ai'}`}>
            {/* 추천 장소가 있을 때는 텍스트 메시지 표시 안 함 */}
            {extractedPlaces.length === 0 && (
              <div className="message-text">
                {filteredContent.split('\n').map((line, lineIndex) => (
                  <div key={lineIndex}>
                    {line}
                    {lineIndex < filteredContent.split('\n').length - 1 && <br />}
                  </div>
                ))}
              </div>
            )}
            
            {/* AI 추천 장소 카드들 - 텍스트 대신 카드만 표시 */}
            {extractedPlaces.length > 0 && (
              <div className="recommended-places">
                <div className="recommended-places-header">
                  <h4>🎯 추천 장소</h4>
                </div>
                <div className="places-grid">
                  {extractedPlaces.map((place, placeIndex) => (
                    <div key={placeIndex} className="place-card">
                      <div className="place-info">
                        <div className="place-header">
                          <h5 className="place-name">{place.name}</h5>
                          {place.verified && (
                            <span className="verified-badge" title="실제 존재하는 장소입니다">✅</span>
                          )}
                        </div>
                        <p className="place-category">{getCategoryIcon(place.category)} {getCategoryName(place.category)}</p>
                        
                        {/* 검증된 장소의 경우 실제 주소와 평점 표시 */}
                        {place.verified ? (
                          <>
                            {place.address && (
                              <p className="place-address">📍 {place.address}</p>
                            )}
                            {place.rating > 0 && (
                              <p className="place-rating">⭐ {place.rating}</p>
                            )}
                            {place.phone && (
                              <p className="place-phone">📞 {place.phone}</p>
                            )}
                          </>
                        ) : (
                          <>
                            <p className="place-description">{place.description}</p>
                            {place.hasAddress && place.address && (
                              <p className="place-address">📍 {place.address}</p>
                            )}
                          </>
                        )}
                      </div>
                      <button 
                        onClick={() => addRecommendedPlace(
                          place.name, 
                          place.category, 
                          place.address || place.description,
                          place // 전체 검증된 장소 정보 전달
                        )}
                        className="add-place-btn"
                        title="그룹투표에 추가"
                      >
                        ➕ 추가
                      </button>
                    </div>
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
      </div>
    );
  };

  // 카테고리 아이콘 반환
  const getCategoryIcon = (category) => {
    const icons = {
      'restaurant': '🍽️',
      'cafe': '☕',
      'park': '🌳',
      'entertainment': '🎮',
      'shopping': '🛍️',
      'bar': '🍺'
    };
    return icons[category] || '📍';
  };

  // 카테고리 이름 반환
  const getCategoryName = (category) => {
    const names = {
      'restaurant': '음식점',
      'cafe': '카페',
      'park': '공원',
      'entertainment': '오락시설',
      'shopping': '쇼핑',
      'bar': '술집'
    };
    return names[category] || '기타';
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
          
          {/* 사용자 레벨 표시 */}
          <div className="user-level-badge">
            {/* {userLevel === USER_LEVELS.GUEST && (
              <span className="guest-badge">
                🆓 게스트 ({aiUsageStatus.used}/{aiUsageStatus.limit})
              </span>
            )} */}
            {userLevel === USER_LEVELS.FREE && (
              <span className="free-badge">
                🔓 무료 회원
              </span>
            )}
            {userLevel === USER_LEVELS.PREMIUM && (
              <span className="premium-badge">
                ✨ 프리미엄
              </span>
            )}
            {userLevel === USER_LEVELS.PRO && (
              <span className="pro-badge">
                👑 프로
              </span>
            )}
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

        {/* 입력 영역 */}
        <div className="input-area">
          {/* 게스트 사용량 표시 */}
          {userLevel === USER_LEVELS.GUEST && (
            <div className="usage-info">
              <span className="usage-text">
                AI 추천 사용량: {aiUsageStatus.used}/{aiUsageStatus.limit}회
                {aiUsageStatus.remaining > 0 && (
                  <span className="remaining"> (남은 횟수: {aiUsageStatus.remaining}회)</span>
                )}
              </span>
              {!aiUsageStatus.canUse && (
                <button 
                  onClick={() => window.location.href = '/register'}
                  className="upgrade-btn"
                >
                  회원가입하여 더 많은 혜택 받기
                </button>
              )}
            </div>
          )}

          <div className="input-container">
            <div className="input-wrapper">
              <textarea
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder={
                  userLevel === USER_LEVELS.GUEST && !aiUsageStatus.canUse
                    ? "오늘의 AI 추천 사용량이 소진되었습니다. 회원가입하여 더 많은 혜택을 받아보세요!"
                    : "미팅 장소에 대해 궁금한 것을 물어보세요..."
                }
                disabled={isLoading || (userLevel === USER_LEVELS.GUEST && !aiUsageStatus.canUse)}
                rows={1}
              />
              <button
                onClick={sendMessage}
                disabled={isLoading || !inputMessage.trim() || (userLevel === USER_LEVELS.GUEST && !aiUsageStatus.canUse)}
                className="send-button"
              >
                {isLoading ? '⏳' : '📤'}
              </button>
            </div>
            
            <div className="quick-suggestions">
              <button 
                onClick={() => setInputMessage('강남 근처에서 4명이 회의하기 좋은 카페 추천해주세요')}
                className="suggestion-chip"
                disabled={isLoading || (userLevel === USER_LEVELS.GUEST && !aiUsageStatus.canUse)}
              >
                💼 비즈니스 미팅
              </button>
              <button 
                onClick={() => setInputMessage('친구들과 맛있는 음식 먹으면서 만날 수 있는 곳 추천해주세요')}
                className="suggestion-chip"
                disabled={isLoading || (userLevel === USER_LEVELS.GUEST && !aiUsageStatus.canUse)}
              >
                🍽️ 식사 모임
              </button>
              <button 
                onClick={() => setInputMessage('조용하고 프라이빗한 분위기에서 대화하기 좋은 곳은 어디인가요?')}
                className="suggestion-chip"
                disabled={isLoading || (userLevel === USER_LEVELS.GUEST && !aiUsageStatus.canUse)}
              >
                💬 대화 중심
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 토스트 팝업 */}
      {showToast && (
        <div className={`toast-notification ${toastType}`}>
          {toastMessage}
        </div>
      )}
    </div>
  );
};

export default AIAssistant; 