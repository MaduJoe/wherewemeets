import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import api, { searchPlacesBySentiment, extractSentimentKeywords } from '../utils/api'; // api와 감성 키워드 함수 임포트
import { 
  ClockIcon, 
  StarIcon,
  SparklesIcon,
  ChatBubbleLeftEllipsisIcon,
  PlusIcon,
  CheckIcon
} from '@heroicons/react/24/outline';

const SmartRecommendation = ({ meetingId, onPlaceSelected }) => {
  const { user, isAuthenticated } = useAuth();
  const [loading, setLoading] = useState(false);
  const [recommendations, setRecommendations] = useState([]);
  const [chatHistory, setChatHistory] = useState([]);
  const [userInput, setUserInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  // const [conversationMode, setConversationMode] = useState(false);
  const [usageLimit, setUsageLimit] = useState(null); // AI 추천 사용 제한 상태
  const [showAddToVotingPrompt, setShowAddToVotingPrompt] = useState(false); // 그룹투표 추가 프롬프트 표시 상태
  const [addingToVoting, setAddingToVoting] = useState({}); // 각 장소별 추가 중 상태
  const [sentimentAnalysis, setSentimentAnalysis] = useState(null); // 감성 분석 결과
  const [isUsingSentimentSearch, setIsUsingSentimentSearch] = useState(false); // 감성 키워드 검색 사용 여부
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
    // 게스트/무료 사용자 상태 확인
    const checkUsageStatus = () => {
      if (user && (user.subscription === 'free' || !user.subscription)) {
        // 추후 백엔드에서 사용량 정보를 받아올 수 있음
        const used = user.analytics?.aiRecommendationUsage || 0;
        const limit = 5;
        if (used >= limit) {
          setUsageLimit({
            exceeded: true,
            used: used,
            limit: limit
          });
        } else {
          setUsageLimit({
            exceeded: false,
            used: used,
            limit: limit,
            remaining: limit - used
          });
        }
      } else if (user && (user.subscription === 'premium' || user.subscription === 'pro')) {
        setUsageLimit({
          exceeded: false,
          unlimited: true
        });
      } else if (!user) {
        // 게스트 사용자 - 일일 5회 제한 (로컬 스토리지로 추적)
        const today = new Date().toDateString(); // 오늘 날짜 (예: "Mon Jan 01 2024")
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
        
        const limit = 5;
        setUsageLimit({
          exceeded: guestUsage >= limit,
          used: guestUsage,
          limit: limit,
          remaining: Math.max(0, limit - guestUsage),
          isGuest: true,
          resetTime: '매일 자정'
        });
      }
    };

    checkUsageStatus();

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
          message: usageLimit?.exceeded 
            ? (usageLimit.isGuest 
               ? '⚠️ 오늘의 AI 장소 추천 사용량이 모두 소진되었습니다. 내일 자정에 다시 이용하거나 회원가입하여 더 많은 혜택을 받아보세요!' 
               : '⚠️ 무료 사용자는 AI 장소 추천을 5회만 이용할 수 있습니다. 프리미엄으로 업그레이드하여 무제한 이용하세요!')
            : (user ? '어떤 종류의 장소를 찾고 계시나요? 음식점, 카페, 공원 등... 자유롭게 말씀해 주세요!' 
                    : '어떤 종류의 장소를 찾고 계시나요? 게스트는 하루 5회까지 AI 추천을 무료로 체험할 수 있습니다!'),
          timestamp: new Date()
        }
    ]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // 채팅 자동 스크롤
  useEffect(() => {
    // chatHistory가 초기 상태(예: 메시지 2개)보다 많거나, 사용자가 입력을 시작했을 때 스크롤
    // 또는 isTyping이 true일 때 (AI가 응답 중일 때)
    if (chatHistory.length > 2 || (chatHistory.length > 0 && chatHistory[chatHistory.length -1].type === 'user') || isTyping) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatHistory, isTyping]);

  // 감성 키워드 기반 장소 검색 함수
  const getSentimentBasedRecommendations = async (userMessage) => {
    setLoading(true);
    setIsUsingSentimentSearch(true);
    
    try {
      console.log('🎭 감성 키워드 기반 검색 시작:', userMessage);
      
      // 감성 키워드 검색 API 호출
      const response = await searchPlacesBySentiment({
        query: userMessage,
        size: 8 // 8개 결과 요청
      });

      if (response.success && response.places) {
        // 감성 분석 결과 저장
        setSentimentAnalysis(response.sentiment_analysis);
        
        // 장소 데이터 변환 및 AI 추천 이유 추가
        const placesWithReasons = response.places.map((place, index) => ({
          id: place.id,
          name: place.name,  
          category: place.category,
          address: place.address,
          coordinates: place.coordinates,
          rating: place.rating || 4.0,
          phone: place.phone,
          url: place.url,
          distance: place.distance,
          estimatedTravelTime: Math.round((place.distance || 1000) / 50) + 15, // 거리 기반 추정
          reason: place.sentiment_analysis?.recommendation_reason || 
                  `${index + 1}순위 추천 장소입니다. 감성 점수: ${place.sentiment_analysis?.score || 0}점`,
          sentiment_score: place.sentiment_analysis?.score || 0,
          matched_keywords: place.sentiment_analysis?.matched_keywords || [],
          confidence: place.sentiment_analysis?.confidence || 0
        }));

        setRecommendations(placesWithReasons);
        
        // 감성 분석 결과를 채팅에 추가
        const analysisMessage = generateSentimentAnalysisMessage(response.sentiment_analysis, placesWithReasons.length);
        
        setChatHistory(prev => [...prev, {
          id: Date.now() + '_sentiment_analysis',
          type: 'ai',
          message: analysisMessage,
          timestamp: new Date(),
          sentiment_analysis: response.sentiment_analysis
        }]);

        if (meetingId && placesWithReasons.length > 0) {
          setShowAddToVotingPrompt(true);
        }

        console.log('✅ 감성 키워드 기반 검색 완료:', placesWithReasons.length, '개 장소');
      } else {
        throw new Error('감성 키워드 기반 검색 결과가 없습니다.');
      }
    } catch (error) {
      console.error('❌ 감성 키워드 기반 검색 실패:', error);
      
      // 실패 시 기본 검색으로 폴백
      setChatHistory(prev => [...prev, {
        id: Date.now() + '_sentiment_error',
        type: 'ai',
        message: '감성 키워드 분석에 실패했습니다. 기본 검색을 시도하겠습니다... 🔄',
        timestamp: new Date()
      }]);
      
      // 기본 검색으로 폴백
      await getRecommendations();
    } finally {
      setLoading(false);
      setIsUsingSentimentSearch(false);
    }
  };

  // 감성 분석 결과 메시지 생성
  const generateSentimentAnalysisMessage = (analysis, placesCount) => {
    if (!analysis) return '감성 분석을 완료했습니다.';
    
    let message = '🎭 **감성 키워드 분석 결과**\n\n';
    
    // 추출된 키워드 표시
    const keywordCategories = ['atmosphere', 'food', 'service', 'price', 'location'];
    const foundKeywords = [];
    
    keywordCategories.forEach(category => {
      if (analysis.extracted_keywords[category] && analysis.extracted_keywords[category].length > 0) {
        const categoryName = {
          atmosphere: '분위기',
          food: '음식',
          service: '서비스',
          price: '가격',
          location: '위치/접근성'
        }[category];
        
        const keywords = analysis.extracted_keywords[category].map(k => k.keyword).join(', ');
        foundKeywords.push(`**${categoryName}**: ${keywords}`);
      }
    });

    if (foundKeywords.length > 0) {
      message += '🔍 **추출된 감성 키워드:**\n' + foundKeywords.join('\n') + '\n\n';
    }

    // 전체 감성 점수
    if (analysis.extracted_keywords.sentiment_score !== undefined) {
      const sentiment = analysis.extracted_keywords.overall_sentiment;
      const sentimentEmoji = sentiment === 'positive' ? '😊' : sentiment === 'negative' ? '😔' : '😐';
      message += `${sentimentEmoji} **전체 감성**: ${sentiment} (점수: ${analysis.extracted_keywords.sentiment_score})\n\n`;
    }

    // 검색 결과 요약
    message += `📊 **검색 결과**: ${placesCount}개 장소 추천\n`;
    
    if (analysis.analysis_summary) {
      const { high_score_places, medium_score_places, low_score_places } = analysis.analysis_summary;
      message += `- 🌟 고점수 (70점 이상): ${high_score_places}개\n`;
      message += `- ⭐ 중간점수 (40-69점): ${medium_score_places}개\n`;
      message += `- 💫 기본점수 (40점 미만): ${low_score_places}개\n\n`;
    }

    message += '아래 추천 장소들을 확인해보세요! 각 장소별로 감성 키워드 매칭 이유를 함께 표시했습니다. 🎯';

    return message;
  };

  // 사용자 입력에 감성 키워드가 있는지 확인하는 함수  
  const containsEmotionalKeywords = (text) => {
    const emotionalKeywords = [
      // 분위기 관련
      '분위기', '좋은', '아늑한', '편안한', '멋진', '로맨틱', '따뜻한', '차분한', '고급스러운', '세련된',
      // 감정 표현
      '맛있는', '신선한', '유명한', '인기있는', '친절한', '빠른', '가성비', '저렴한', '합리적',
      // 부정적 키워드도 포함
      '시끄러운', '불편한', '비싼'
    ];
    
    return emotionalKeywords.some(keyword => text.includes(keyword));
  };

  // 그룹투표에 장소 추가 함수
  const addToGroupVoting = async (place) => {
    if (!meetingId) {
      alert('미팅 ID가 없습니다.');
      return;
    }

    setAddingToVoting(prev => ({ ...prev, [place.id]: true }));

    try {
      // 장소 데이터를 그룹투표 형식에 맞게 변환
      const candidatePlace = {
        id: place.id,
        name: place.name,
        address: place.address,
        category: place.category,
        rating: place.rating || 0,
        phone: place.phone || '',
        url: place.url || '',
        reason: place.reason || 'AI 추천 장소'
      };

      const response = await api.post(`/votes/${meetingId}/candidates`, {
        place: candidatePlace
      });

      if (response.data.success) {
        alert(`"${place.name}"이(가) 그룹투표에 추가되었습니다! 🎉`);
        
        // 성공적으로 추가된 장소는 목록에서 제거하거나 표시 변경
        setRecommendations(prev => 
          prev.map(rec => 
            rec.id === place.id 
              ? { ...rec, addedToVoting: true }
              : rec
          )
        );
      } else {
        throw new Error(response.data.message || '장소 추가에 실패했습니다.');
      }
    } catch (error) {
      console.error('그룹투표 장소 추가 실패:', error);
      alert(error.response?.data?.message || `"${place.name}" 추가에 실패했습니다. 다시 시도해주세요.`);
    } finally {
      setAddingToVoting(prev => ({ ...prev, [place.id]: false }));
    }
  };

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

      // 게스트 사용자 일일 사용량 체크
      if (!isAuthenticated) {
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
          throw new Error('오늘의 AI 장소 추천 사용량이 모두 소진되었습니다. 내일 자정에 다시 이용하거나 회원가입하여 더 많은 혜택을 받아보세요!');
        }
      }

      // 로컬 스토리지에서 토큰 가져오기 (게스트는 토큰 없이도 가능)
      const token = localStorage.getItem('token');

      const headers = {
        'Content-Type': 'application/json'
      };
      
      // 토큰이 있으면 Authorization 헤더 추가
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await axios.post('/api/aiAssistant/recommend-places', {
        preferences
      }, {
        headers
      });

      if (response.data.success && response.data.data.recommendations) {
        const aiRecommendations = response.data.data.recommendations;
        
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
        
        // 추천 장소 데이터 가공
        const processedRecommendations = aiRecommendations.map((rec, index) => ({
          id: `ai-rec-${Date.now()}-${index}`, // 고유 ID 생성
          name: rec.name,
          address: rec.address || '주소 정보 없음',
          category: categorizePlace(rec.name),
          rating: rec.rating || (3.5 + Math.random() * 1.5), // 3.5~5.0 사이 랜덤 평점
          phone: rec.phone || '',
          url: rec.url || '',
          reason: rec.reason || 'AI가 추천하는 장소입니다.',
          estimatedTravelTime: rec.estimatedTravelTime || (10 + Math.floor(Math.random() * 30)), // 10~40분 랜덤
          addedToVoting: false // 그룹투표 추가 여부
        }));
        
        setRecommendations(processedRecommendations);
        setShowAddToVotingPrompt(true); // 그룹투표 추가 프롬프트 표시

        // 게스트 사용자 사용량 증가
        if (!isAuthenticated) {
          const currentUsage = parseInt(localStorage.getItem('guestAIUsage') || '0');
          localStorage.setItem('guestAIUsage', (currentUsage + 1).toString());
          
          // 사용량 상태 업데이트
          setUsageLimit(prev => ({
            ...prev,
            used: currentUsage + 1,
            remaining: Math.max(0, prev.limit - (currentUsage + 1)),
            exceeded: (currentUsage + 1) >= prev.limit
          }));
        }
      } else {
        throw new Error('추천 결과가 없습니다.');
      }
      
    } catch (error) {
      console.error('AI 장소 추천 실패:', error);
      alert(error.message || 'AI 장소 추천에 실패했습니다. 다시 시도해 주세요.');
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

    // 사용량 제한 체크
    if (usageLimit?.exceeded) {
      alert(usageLimit.isGuest 
        ? '오늘의 AI 장소 추천 사용량이 모두 소진되었습니다. 내일 다시 이용해주세요!'
        : '무료 사용자는 AI 장소 추천을 5회만 이용할 수 있습니다. 프리미엄으로 업그레이드하세요!'
      );
      return;
    }

    const userMessageText = userInput.trim();

    // 사용자 메시지 추가
    const userMessage = {
      id: `user-${Date.now()}`,
      type: 'user',
      message: userMessageText,
      timestamp: new Date()
    };

    setChatHistory(prev => [...prev, userMessage]);
    setUserInput('');
    setIsTyping(true);

    try {
      // 감성 키워드 감지
      const hasEmotionalKeywords = containsEmotionalKeywords(userMessageText);
      
      if (hasEmotionalKeywords) {
        console.log('🎭 감성 키워드 감지됨, 감성 기반 검색 사용');
        
        // 감성 분석 시작 메시지
        const sentimentStartMessage = {
          id: `ai-sentiment-start-${Date.now()}`,
          type: 'ai',
          message: '🎭 감성 키워드를 감지했습니다! 더 정확한 추천을 위해 감성 분석을 수행하겠습니다...',
          timestamp: new Date()
        };
        
        setChatHistory(prev => [...prev, sentimentStartMessage]);
        await new Promise(resolve => setTimeout(resolve, 1000));

        // 감성 기반 검색 실행
        await getSentimentBasedRecommendations(userMessageText);
      } else {
        console.log('💬 일반 대화 모드, 기본 검색 사용');
        
        // AI 응답 생성
        const aiResponses = generateAIResponse(userMessageText);

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

        // 기본 장소 추천 실행
        setTimeout(() => {
          getRecommendations();
        }, 500);
      }

      // 게스트 사용량 증가
      if (!isAuthenticated) {
        const currentUsage = parseInt(localStorage.getItem('guestAIUsage') || '0');
        localStorage.setItem('guestAIUsage', (currentUsage + 1).toString());
        
        // 사용량 상태 업데이트
        setUsageLimit(prev => ({
          ...prev,
          used: currentUsage + 1,
          remaining: Math.max(0, prev.limit - (currentUsage + 1)),
          exceeded: (currentUsage + 1) >= prev.limit
        }));
      }

    } catch (error) {
      console.error('채팅 처리 실패:', error);
      
      const errorMessage = {
        id: `ai-error-${Date.now()}`,
        type: 'ai',
        message: '죄송합니다. 처리 중 오류가 발생했습니다. 다시 시도해주세요.',
        timestamp: new Date()
      };
      
      setChatHistory(prev => [...prev, errorMessage]);
    } finally {
      setIsTyping(false);
    }
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

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center mb-6">
        <SparklesIcon className="h-6 w-6 text-primary-600 mr-2" />
        <h3 className="text-lg font-semibold text-gray-900">AI 대화형 장소 추천</h3>
        {user ? (
          <span className="ml-auto text-sm text-gray-600">
            👋 {user.name}님 ({user.subscription === 'premium' || user.subscription === 'pro' ? '프리미엄' : '무료'})
          </span>
        ) : (
          <span className="ml-auto text-sm text-gray-500">
            👤 게스트 사용자
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
            onKeyPress={(e) => e.key === 'Enter' && !usageLimit?.exceeded && handleChatSubmit()}
            placeholder={
              usageLimit?.exceeded 
                ? "무료 사용량이 초과되었습니다. 프리미엄으로 업그레이드하세요!" 
                : "어떤 장소를 찾고 계신가요? 자유롭게 말씀해 주세요..."
            }
            className={`flex-1 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
              usageLimit?.exceeded 
                ? 'border-red-300 bg-red-50 text-red-600 placeholder-red-400' 
                : 'border-gray-300 focus:ring-primary-500'
            }`}
            disabled={isTyping || usageLimit?.exceeded}
          />
          <button
            onClick={handleChatSubmit}
            disabled={isTyping || !userInput.trim() || usageLimit?.exceeded}
            className={`px-4 py-2 rounded-lg text-white transition duration-200 ${
              usageLimit?.exceeded
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-primary-600 hover:bg-primary-700 disabled:opacity-50'
            }`}
          >
            {usageLimit?.exceeded ? '🔒' : '💬'}
          </button>
        </div>

        {/* 사용 제한 안내 */}
        {usageLimit?.exceeded && (
          <div className="mt-3 p-3 bg-gradient-to-r from-orange-50 to-red-50 rounded-lg border border-orange-200">
            <div className="flex items-center mb-2">
              <span className="text-orange-600 font-medium">
                ⚠️ {usageLimit.isGuest ? '일일 사용량 초과' : '무료 사용량 초과'}
              </span>
              {usageLimit.isGuest && (
                <span className="ml-2 text-sm text-blue-600">
                  🕛 내일 자정에 리셋
                </span>
              )}
            </div>
            <p className="text-sm text-orange-700 mb-3">
              {usageLimit.isGuest 
                ? `게스트는 하루에 AI 장소 추천을 ${usageLimit.limit}회만 이용할 수 있습니다. 오늘 ${usageLimit.used}회 사용하셨습니다.`
                : `무료 사용자는 AI 장소 추천을 ${usageLimit.limit}회만 이용할 수 있습니다. 현재 ${usageLimit.used}회 사용하셨습니다.`
              }
            </p>
            <div className="space-y-2">
              <div className="text-sm text-green-700">
                <span className="font-medium">💎 프리미엄 업그레이드 혜택:</span>
                <ul className="mt-1 ml-4 space-y-1">
                  <li>• 무제한 AI 장소 추천</li>
                  <li>• 고급 필터링 및 분석</li>
                  <li>• 실시간 채팅 지원</li>
                  <li>• 개인화된 추천 알고리즘</li>
                </ul>
              </div>
                              <div className="flex space-x-2">
                  {usageLimit.isGuest && (
                    <button 
                      onClick={() => window.location.href = '/register'}
                      className="bg-gradient-to-r from-green-600 to-blue-600 text-white px-4 py-2 rounded-lg hover:from-green-700 hover:to-blue-700 transition duration-200 text-sm font-medium"
                    >
                      📝 회원가입하기
                    </button>
                  )}
                  <button 
                    onClick={() => window.location.href = '/pricing'}
                    className="bg-gradient-to-r from-primary-600 to-secondary-600 text-white px-4 py-2 rounded-lg hover:from-primary-700 hover:to-secondary-700 transition duration-200 text-sm font-medium"
                  >
                    🚀 프리미엄으로 업그레이드
                  </button>
                </div>
            </div>
          </div>
        )} 

        {/* 무료 사용자 잔여 횟수 표시 */}
        {usageLimit && !usageLimit.exceeded && !usageLimit.unlimited && (
          <div className="mt-2 text-xs text-gray-600 bg-yellow-50 px-3 py-2 rounded-lg border border-yellow-200">
            💡 {usageLimit.isGuest ? '게스트 일일 체험' : '무료 체험'}: AI 추천 {usageLimit.remaining}회 남음 ({usageLimit.used}/{usageLimit.limit} 사용)
            {usageLimit.isGuest && <span className="ml-2 text-blue-600">• 매일 자정 리셋</span>}
          </div>
        )}
      </div>

      {/* 그룹투표 추가 안내 */}
      {showAddToVotingPrompt && meetingId && (
        <div className="mb-4 p-4 bg-gradient-to-r from-green-50 to-blue-50 rounded-lg border border-green-200">
          <h5 className="font-medium text-green-800 mb-2 flex items-center">
            ✨ 추천 장소를 그룹투표에 추가하시겠습니까?
          </h5>
          <p className="text-sm text-green-700 mb-3">
            아래 추천 장소들을 선택하여 그룹투표에 추가할 수 있습니다.
          </p>
          <div className="flex flex-wrap gap-2">
            {recommendations.filter(place => !place.addedToVoting).map((place) => (
              <button
                key={place.id}
                onClick={() => addToGroupVoting(place)}
                disabled={addingToVoting[place.id]}
                className="bg-green-100 hover:bg-green-200 text-green-800 px-3 py-2 rounded-lg text-sm font-medium transition duration-200 flex items-center disabled:opacity-50"
              >
                {addingToVoting[place.id] ? (
                  <>
                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-green-600 mr-1"></div>
                    추가 중...
                  </>
                ) : (
                  <>
                    <PlusIcon className="h-3 w-3 mr-1" />
                    {place.name}
                  </>
                )}
              </button>
            ))}
          </div>
          {recommendations.every(place => place.addedToVoting) && (
            <div className="mt-3 p-2 bg-blue-100 rounded text-sm text-blue-800 flex items-center">
              <CheckIcon className="h-4 w-4 mr-1" />
              모든 장소가 그룹투표에 추가되었습니다! ✅
            </div>
          )}
        </div>
      )}

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
                className={`border rounded-lg p-4 transition-all transform hover:scale-[1.01] ${
                  place.addedToVoting 
                    ? 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-200' 
                    : 'hover:bg-gradient-to-r hover:from-gray-50 hover:to-blue-50'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center mb-2">
                      <span className="bg-gradient-to-r from-primary-100 to-secondary-100 text-primary-800 text-xs font-medium px-2 py-1 rounded mr-2">
                        #{index + 1} AI 추천
                      </span>
                      <span className="bg-gray-100 text-gray-700 text-xs px-2 py-1 rounded mr-2">
                        {categories.find(c => c.value === place.category)?.icon} {categories.find(c => c.value === place.category)?.label || place.category}
                      </span>
                      {place.addedToVoting && (
                        <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded mr-2 flex items-center">
                          <CheckIcon className="h-3 w-3 mr-1" />
                          투표 추가됨
                        </span>
                      )}
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
                    
                    {/* 감성 분석 정보 표시 */}
                    {place.sentiment_score !== undefined && place.sentiment_score > 0 && (
                      <div className="mb-2 p-2 bg-gradient-to-r from-purple-50 to-pink-50 rounded border-l-2 border-purple-400">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium text-purple-700">
                            🎭 감성 분석 점수
                          </span>
                          <span className={`text-xs px-2 py-1 rounded-full ${
                            place.sentiment_score >= 70 
                              ? 'bg-green-100 text-green-800' 
                              : place.sentiment_score >= 40 
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-gray-100 text-gray-800'
                          }`}>
                            {place.sentiment_score}점
                          </span>
                        </div>
                        {place.matched_keywords && place.matched_keywords.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {place.matched_keywords.slice(0, 4).map((keyword, idx) => (
                              <span 
                                key={idx}
                                className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded"
                              >
                                {keyword}
                              </span>
                            ))}
                            {place.matched_keywords.length > 4 && (
                              <span className="text-xs text-purple-600">
                                +{place.matched_keywords.length - 4}개 더
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                    
                    <p className="text-xs text-green-600 bg-gradient-to-r from-green-50 to-emerald-50 p-2 rounded border-l-2 border-green-400">
                      🤖 AI 분석: {place.reason}
                    </p>
                  </div>
                  
                  <div className="ml-4 flex flex-col space-y-2">
                    {meetingId && !place.addedToVoting && (
                      <button
                        onClick={() => addToGroupVoting(place)}
                        disabled={addingToVoting[place.id]}
                        className="bg-gradient-to-r from-green-600 to-emerald-600 text-white px-4 py-2 rounded-lg text-sm hover:from-green-700 hover:to-emerald-700 transition duration-200 transform hover:scale-105 flex items-center disabled:opacity-50"
                      >
                        {addingToVoting[place.id] ? (
                          <>
                            <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-1"></div>
                            추가 중...
                          </>
                        ) : (
                          <>
                            <PlusIcon className="h-3 w-3 mr-1" />
                            투표 추가
                          </>
                        )}
                      </button>
                    )}
                    <button
                      onClick={() => onPlaceSelected && onPlaceSelected(place)}
                      className="bg-gradient-to-r from-secondary-600 to-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:from-secondary-700 hover:to-primary-700 transition duration-200 transform hover:scale-105"
                    >
                      ✨ 선택
                    </button>
                  </div>
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
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <h6 className="font-medium text-blue-800 mb-1">🎭 감성 키워드 추천</h6>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• "분위기 좋은 카페 추천해줘"</li>
                <li>• "맛있는 한식집 찾고 있어요"</li>
                <li>• "아늑한 레스토랑이 좋겠어요"</li>
                <li>• "가성비 좋은 음식점 어때요?"</li>
              </ul>
            </div>
            <div>
              <h6 className="font-medium text-blue-800 mb-1">💬 일반 대화</h6>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• "친구들과 만날 곳 찾아줘"</li>
                <li>• "차로 이동할 수 있는 카페"</li>
                <li>• "지하철로 갈 수 있는 놀거리"</li>
                <li>• "공원에서 산책하고 싶어요"</li>
              </ul>
            </div>
          </div>
          <div className="mt-3 p-3 bg-gradient-to-r from-purple-50 to-pink-50 rounded border border-purple-200">
            <p className="text-xs text-purple-700 font-medium mb-1">
              🎭 감성 키워드 기능 NEW!
            </p>
            <p className="text-xs text-purple-600">
              '분위기 좋은', '맛있는', '아늑한' 등의 감성 표현을 사용하면 Google Maps 리뷰를 분석하여 더 정확한 추천을 받을 수 있습니다!
            </p>
          </div>
          <p className="text-xs text-blue-600 mt-2">
            자연스럽게 대화하시면 AI가 여러분의 니즈를 파악해서 완벽한 장소를 추천해드립니다! 🎯
          </p>
        </div>
      )}
    </div>
  );
};

export default SmartRecommendation; 