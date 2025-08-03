const express = require('express');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const { auth } = require('../middleware/auth');
const { requirePremium } = require('../middleware/subscription');
const User = require('../models/User');
const AIQueryLog = require('../models/AIQueryLog');
const router = express.Router();

// 여러 개의 Gemini API 키 설정 (환경변수에서 콤마로 구분된 키들을 읽음)
const GEMINI_API_KEYS = process.env.GEMINI_API_KEY ? 
  process.env.GEMINI_API_KEY.split(',').map(key => key.trim()).filter(key => key.length > 0) : 
  [];


const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;
const KAKAO_API_KEY = process.env.KAKAO_API_KEY;

// API 키 로테이션 관리
let apiKeyRotation = {
  currentIndex: 0,
  keyUsage: new Map(), // 각 키별 사용량 추적
  lastResetDate: new Date().toDateString()
};

// API 키 로테이션 초기화
function initializeApiKeyRotation() {
  const today = new Date().toDateString();
  
  // 날짜가 바뀌면 모든 키의 사용량 초기화
  if (apiKeyRotation.lastResetDate !== today) {
    console.log(`🔄 API 키 사용량 일일 초기화 (${GEMINI_API_KEYS.length}개 키)`);
    apiKeyRotation.keyUsage.clear();
    apiKeyRotation.lastResetDate = today;
    apiKeyRotation.currentIndex = 0;
  }
  
  // 각 키별 사용량 초기화
  GEMINI_API_KEYS.forEach((key, index) => {
    if (!apiKeyRotation.keyUsage.has(index)) {
      apiKeyRotation.keyUsage.set(index, {
        count: 0,
        keyPreview: `${key.substring(0, 8)}...`,
        breakdown: {
          chat: 0,
          initial: 0,
          final: 0,
          fallback: 0,
          recommend: 0
        }
      });
    }
  });
}

// 현재 사용 가능한 API 키 가져오기
function getCurrentApiKey() {
  if (GEMINI_API_KEYS.length === 0) {
    return null;
  }
  
  initializeApiKeyRotation();
  
  // 현재 키가 한도에 도달했는지 확인
  const currentKeyUsage = apiKeyRotation.keyUsage.get(apiKeyRotation.currentIndex);
  
  // 현재 키가 95회 이상 사용되었으면 다음 키로 전환
  if (currentKeyUsage && currentKeyUsage.count >= 95) {
    console.log(`⚠️ API 키 ${apiKeyRotation.currentIndex + 1} 한도 도달 (${currentKeyUsage.count}/100), 다음 키로 전환`);
    
    // 다음 사용 가능한 키 찾기
    let nextKeyFound = false;
    for (let i = 0; i < GEMINI_API_KEYS.length; i++) {
      const nextIndex = (apiKeyRotation.currentIndex + 1 + i) % GEMINI_API_KEYS.length;
      const nextKeyUsage = apiKeyRotation.keyUsage.get(nextIndex);
      
      if (!nextKeyUsage || nextKeyUsage.count < 95) {
        apiKeyRotation.currentIndex = nextIndex;
        nextKeyFound = true;
        console.log(`✅ API 키 ${nextIndex + 1}로 전환 (사용량: ${nextKeyUsage?.count || 0}/100)`);
        break;
      }
    }
    
    if (!nextKeyFound) {
      console.error('❌ 모든 API 키가 한도에 도달함');
      return null;
    }
  }
  
  return GEMINI_API_KEYS[apiKeyRotation.currentIndex];
}

// API 키별 사용량 추적
function trackApiKeyUsage(type = 'general') {
  if (GEMINI_API_KEYS.length === 0) {
    return false;
  }
  
  initializeApiKeyRotation();
  
  const currentUsage = apiKeyRotation.keyUsage.get(apiKeyRotation.currentIndex);
  if (currentUsage) {
    currentUsage.count++;
    if (currentUsage.breakdown[type] !== undefined) {
      currentUsage.breakdown[type]++;
    }
    
    // 90회 이상 사용 시 경고
    if (currentUsage.count >= 90) {
      console.warn(`⚠️ API 키 ${apiKeyRotation.currentIndex + 1} 사용량 경고: ${currentUsage.count}/100`);
    }
    
    return true;
  }
  
  return false;
}

// API 키 로테이션 상태 정보 가져오기
function getApiKeyRotationInfo() {
  if (GEMINI_API_KEYS.length === 0) {
    return {
      totalKeys: 0,
      currentKey: null,
      allKeysExhausted: true,
      keyUsages: []
    };
  }
  
  initializeApiKeyRotation();
  
  const keyUsages = [];
  let availableKeys = 0;
  
  for (let i = 0; i < GEMINI_API_KEYS.length; i++) {
    const usage = apiKeyRotation.keyUsage.get(i);
    const count = usage?.count || 0;
    
    keyUsages.push({
      index: i + 1,
      keyPreview: usage?.keyPreview || `${GEMINI_API_KEYS[i].substring(0, 8)}...`,
      usage: count,
      remaining: Math.max(0, 100 - count),
      percentage: Math.round(count / 100 * 100),
      isActive: i === apiKeyRotation.currentIndex,
      isAvailable: count < 95,
      breakdown: usage?.breakdown || {}
    });
    
    if (count < 95) {
      availableKeys++;
    }
  }
  
  return {
    totalKeys: GEMINI_API_KEYS.length,
    currentKey: apiKeyRotation.currentIndex + 1,
    availableKeys: availableKeys,
    allKeysExhausted: availableKeys === 0,
    keyUsages: keyUsages,
    totalDailyUsage: keyUsages.reduce((sum, key) => sum + key.usage, 0),
    maxDailyCapacity: GEMINI_API_KEYS.length * 100
  };
}

// AI 질의 로깅을 위한 헬퍼 함수
async function logAIQuery(queryData) {
  try {
    const logData = {
      userId: queryData.userId || 'anonymous',
      userType: queryData.userType || 'guest',
      sessionId: queryData.sessionId || 'unknown',
      query: queryData.query,
      queryType: queryData.queryType,
      context: queryData.context || {},
      response: queryData.response,
      responseTime: queryData.responseTime || 0,
      aiModel: queryData.aiModel || 'gpt-3.5-turbo',
      success: queryData.success !== false,
      errorMessage: queryData.errorMessage,
      tokenUsed: queryData.tokenUsed,
      sentiment: queryData.sentiment,
      category: queryData.category,
      tags: queryData.tags || [],
      ipAddress: queryData.ipAddress,
      userAgent: queryData.userAgent,
      platform: 'web'
    };

    const aiQueryLog = new AIQueryLog(logData);
    await aiQueryLog.save();
    
    console.log('✅ AI 질의 로그 저장 완료:', {
      userId: logData.userId,
      queryType: logData.queryType,
      success: logData.success
    });

    return aiQueryLog._id;
  } catch (error) {
    console.error('❌ AI 질의 로그 저장 실패:', error);
    // 로깅 실패가 서비스에 영향을 주지 않도록 에러를 던지지 않음
    return null;
  }
}

// 사용자 정보를 추출하는 헬퍼 함수
async function extractUserInfo(req) {
  let user = null;
  let isGuest = true;
  let userId = 'anonymous';
  let userType = 'guest';
  
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const token = authHeader.substring(7);
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      user = await User.findById(decoded.userId);
      if (user) {
        isGuest = false;
        userId = user._id.toString();
        userType = user.subscription === 'premium' ? 'premium' : 'member';
      }
    } catch (error) {
      // 토큰 검증 실패 시 게스트로 처리
    }
  }
  
  // 게스트 사용자의 경우 세션 ID 사용
  if (isGuest) {
    userId = req.headers['x-session-id'] || req.ip || 'anonymous';
  }
  
  return { user, isGuest, userId, userType };
}

// 질의 카테고리를 자동으로 분류하는 함수
function categorizeQuery(message, queryType) {
  const keywords = {
    place_food: ['맛집', '음식점', '레스토랑', '카페', '커피', '분식', '치킨', '피자', '햄버거', '한식', '중식', '일식', '양식'],
    place_drinks: ['술집', '위스키', '맥주', '소주', '칵테일', '와인', '바', '펍', '호프', '이자카야', '포차', '주점', '양주'],
    place_activity: ['놀', '활동', '체험', '볼링', '노래방', 'pc방', '영화', '공연', '전시', '박물관', '놀이'],
    place_outdoor: ['공원', '산책', '피크닉', '등산', '강변', '해변', '야외', '자연'],
    place_shopping: ['쇼핑', '백화점', '마트', '시장', '아울렛', '쇼핑몰'],
    meeting_planning: ['언제', '시간', '일정', '스케줄', '계획'],
    general_question: ['어떻게', '왜', '뭐', '무엇', '어디서', '누구'],
    transport: ['교통', '지하철', '버스', '택시', '주차', '길', '경로']
  };
  
  const lowerMessage = message.toLowerCase();
  
  for (const [category, keywordList] of Object.entries(keywords)) {
    if (keywordList.some(keyword => lowerMessage.includes(keyword))) {
      return category;
    }
  }
  
  return queryType === 'place_recommendation' ? 'place_general' : 'general';
}

// API 사용량 추적을 위한 전역 카운터 (호환성을 위해 유지)
let dailyApiUsage = {
  count: 0,
  date: new Date().toDateString(),
  sessions: new Map(),
  breakdown: {
    chat: 0,
    initial: 0,
    final: 0,
    fallback: 0,
    recommend: 0
  }
};

// 기존 trackApiUsage 함수 (API 키 로테이션과 연동)
function trackApiUsage(type = 'general', sessionId = null) {
  const today = new Date().toDateString();
  
  // 날짜가 바뀌면 카운터 초기화
  if (dailyApiUsage.date !== today) {
    dailyApiUsage = {
      count: 0,
      date: today,
      sessions: new Map(),
      breakdown: {
        chat: 0,
        initial: 0,
        final: 0,
        fallback: 0,
        recommend: 0
      }
    };
  }
  
  // 전체 카운터 증가
  dailyApiUsage.count++;
  if (dailyApiUsage.breakdown[type] !== undefined) {
    dailyApiUsage.breakdown[type]++;
  }
  
  // 세션별 추적
  if (sessionId) {
    if (!dailyApiUsage.sessions.has(sessionId)) {
      dailyApiUsage.sessions.set(sessionId, 0);
    }
    dailyApiUsage.sessions.set(sessionId, dailyApiUsage.sessions.get(sessionId) + 1);
  }
  
  // API 키별 사용량도 추적
  trackApiKeyUsage(type);
  
  // 경고 로그
  const rotationInfo = getApiKeyRotationInfo();
  if (rotationInfo.allKeysExhausted) {
    console.warn(`🚨 모든 API 키 한도 초과: ${rotationInfo.totalDailyUsage}/${rotationInfo.maxDailyCapacity}`);
  }
  
  return dailyApiUsage.count;
}

// API 사용량 정보 조회 함수 (API 키 로테이션 정보 포함)
function getApiUsageInfo() {
  const today = new Date().toDateString();
  
  // 날짜가 바뀌면 카운터 초기화
  if (dailyApiUsage.date !== today) {
    dailyApiUsage = {
      count: 0,
      date: today,
      sessions: new Map(),
      breakdown: {
        chat: 0,
        initial: 0,
        final: 0,
        fallback: 0,
        recommend: 0
      }
    };
  }
  
  // API 키 로테이션 정보 가져오기
  const rotationInfo = getApiKeyRotationInfo();
  
  return {
    totalToday: dailyApiUsage.count,
    remaining: Math.max(0, rotationInfo.maxDailyCapacity - rotationInfo.totalDailyUsage),
    percentage: rotationInfo.maxDailyCapacity > 0 ? 
      Math.round(rotationInfo.totalDailyUsage / rotationInfo.maxDailyCapacity * 100) : 100,
    breakdown: dailyApiUsage.breakdown,
    activeSessions: dailyApiUsage.sessions.size,
    isNearLimit: rotationInfo.allKeysExhausted || rotationInfo.availableKeys <= 1,
    
    // API 키 로테이션 정보 추가
    apiKeyRotation: {
      totalKeys: rotationInfo.totalKeys,
      currentKey: rotationInfo.currentKey,
      availableKeys: rotationInfo.availableKeys,
      allKeysExhausted: rotationInfo.allKeysExhausted,
      totalDailyUsage: rotationInfo.totalDailyUsage,
      maxDailyCapacity: rotationInfo.maxDailyCapacity,
      keyUsages: rotationInfo.keyUsages
    }
  };
}

// Function Calling 함수 정의
const AVAILABLE_FUNCTIONS = {
  search_places: {
    name: 'search_places',
    description: '특정 지역 주변의 실제 장소들을 검색합니다. 정확한 장소 정보를 제공하기 위해 반드시 사용해야 합니다.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: '검색할 장소 유형 (예: 카페, 음식점, 공원 등)'
        },
        location: {
          type: 'string',
          description: '검색할 지역명 (예: 효창공원역, 남영역, 용산구 등)'
        },
        radius: {
          type: 'number',
          description: '검색 반경 (미터 단위, 기본값: 1000)',
          default: 1000
        }
      },
      required: ['query', 'location']
    }
  }
};

// AI 응답에서 장소명 파싱하는 함수
function parseRecommendedPlaces(aiResponse) {
  const places = [];
  const lines = aiResponse.split('\n');
  
  // 장소명이 아닌 것들을 필터링할 키워드들
  const excludeKeywords = [
    '예약', '가격대', '가격', '영업시간', '운영시간', '주차', '교통', '접근성',
    '특징', '추천', '장점', '단점', '분위기', '메뉴', '음식', '서비스',
    '위치', '거리', '시간', '요금', '비용', '할인', '이벤트', '프로모션',
    '안내', '정보', '참고', '주의', '팁', '꿀팁', '노하우', '방법',
    '결론', '요약', '마무리', '총정리', '정리', '끝'
  ];
  
  for (const line of lines) {
    // "* 장소명:" 또는 "- 장소명:" 형태의 라인을 찾음
    const match = line.match(/^[*\-•]\s*([^:：]+)[:：]/);
    if (match) {
      const placeName = match[1].trim();
      
      // 기본 길이 체크
      if (!placeName || placeName.length <= 1) {
        continue;
      }
      
      // 제외 키워드 체크
      const isExcluded = excludeKeywords.some(keyword => 
        placeName.toLowerCase().includes(keyword.toLowerCase()) || 
        placeName === keyword
      );
      
      if (isExcluded) {
        continue;
      }
      
      // 숫자만 있는 경우 제외
      if (/^\d+$/.test(placeName)) {
        continue;
      }
      
      // 너무 짧거나 일반적인 단어들 제외
      const generalWords = ['위치', '시간', '메뉴', '음식', '서비스', '분위기', '추천', '장소'];
      if (generalWords.includes(placeName)) {
        continue;
      }
      
      // 적어도 2글자 이상인 경우 장소명으로 간주
      if (placeName.length >= 2) {
        places.push(placeName);
      }
    }
  }
  
  return places;
}

// 카카오 카테고리를 표준 카테고리로 매핑하는 함수
function mapKakaoCategory(kakaoCategory) {
  if (!kakaoCategory) return 'restaurant';
  
  const fullCategory = kakaoCategory.toLowerCase();
  const lastCategory = kakaoCategory.split(' > ').pop().toLowerCase();
  
  // 오락시설 관련 (우선 처리)
  if (fullCategory.includes('오락') || fullCategory.includes('레저') || fullCategory.includes('스포츠') ||
      lastCategory.includes('노래방') || lastCategory.includes('볼링') || lastCategory.includes('게임') || 
      lastCategory.includes('영화') || lastCategory.includes('pc방') || lastCategory.includes('당구') ||
      lastCategory.includes('카라오케') || lastCategory.includes('코인노래방') || lastCategory.includes('멀티방') ||
      lastCategory.includes('vr') || lastCategory.includes('방탈출') || lastCategory.includes('찜질방') ||
      lastCategory.includes('사우나') || lastCategory.includes('헬스') || lastCategory.includes('체육관') ||
      lastCategory.includes('수영장') || lastCategory.includes('골프') || lastCategory.includes('테니스') ||
      lastCategory.includes('배드민턴') || lastCategory.includes('탁구') || lastCategory.includes('클럽') ||
      lastCategory.includes('펍') || lastCategory.includes('바') || lastCategory.includes('룸') ||
      fullCategory.includes('엔터테인먼트') || fullCategory.includes('entertainment')) {
    return 'entertainment';
  }
  
  // 카페 관련
  if (lastCategory.includes('카페') || lastCategory.includes('커피') || lastCategory.includes('디저트') ||
      lastCategory.includes('베이커리') || lastCategory.includes('빵집') || lastCategory.includes('케이크')) {
    return 'cafe';
  }
  
  // 공원 관련
  if (lastCategory.includes('공원') || lastCategory.includes('놀이터') || lastCategory.includes('산책로') ||
      lastCategory.includes('자연') || lastCategory.includes('산') || lastCategory.includes('강') ||
      lastCategory.includes('해변') || lastCategory.includes('바다')) {
    return 'park';
  }
  
  // 쇼핑 관련
  if (lastCategory.includes('마트') || lastCategory.includes('백화점') || lastCategory.includes('쇼핑') || 
      lastCategory.includes('상가') || lastCategory.includes('몰') || lastCategory.includes('시장') ||
      lastCategory.includes('편의점') || lastCategory.includes('슈퍼')) {
    return 'shopping';
  }
  
  // 문화시설 관련
  if (lastCategory.includes('박물관') || lastCategory.includes('미술관') || lastCategory.includes('도서관') ||
      lastCategory.includes('문화') || lastCategory.includes('전시') || lastCategory.includes('공연') ||
      lastCategory.includes('극장') || lastCategory.includes('콘서트')) {
    return 'culture';
  }
  
  // 음식점 관련 (더 포괄적으로)
  if (lastCategory.includes('음식') || lastCategory.includes('식당') || lastCategory.includes('레스토랑') ||
      lastCategory.includes('한식') || lastCategory.includes('중식') || lastCategory.includes('일식') ||
      lastCategory.includes('양식') || lastCategory.includes('치킨') || lastCategory.includes('피자') ||
      lastCategory.includes('햄버거') || lastCategory.includes('분식') || lastCategory.includes('고기') ||
      lastCategory.includes('회') || lastCategory.includes('초밥') || lastCategory.includes('파스타') ||
      lastCategory.includes('뷔페') || lastCategory.includes('맛집') || lastCategory.includes('요리') ||
      lastCategory.includes('먹거리') || lastCategory.includes('술집') || lastCategory.includes('호프') ||
      lastCategory.includes('주점') || lastCategory.includes('포차') || lastCategory.includes('삼겹살') ||
      lastCategory.includes('갈비') || lastCategory.includes('국밥') || lastCategory.includes('찜') ||
      lastCategory.includes('탕') || lastCategory.includes('죽') || lastCategory.includes('면') ||
      lastCategory.includes('국수') || lastCategory.includes('냉면') || lastCategory.includes('라면') ||
      lastCategory.includes('족발') || lastCategory.includes('보쌈') || lastCategory.includes('곱창') ||
      lastCategory.includes('순대') || lastCategory.includes('떡볶이') || lastCategory.includes('김밥') ||
      lastCategory.includes('도시락') || lastCategory.includes('샐러드') || lastCategory.includes('샌드위치') ||
      lastCategory.includes('토스트') || lastCategory.includes('스테이크') || lastCategory.includes('리조또') ||
      lastCategory.includes('돈까스') || lastCategory.includes('우동') || lastCategory.includes('라멘') ||
      lastCategory.includes('타코') || lastCategory.includes('부리또') || lastCategory.includes('쌀국수') ||
      lastCategory.includes('팟타이') || lastCategory.includes('쿠킹') || lastCategory.includes('퓨전') ||
      lastCategory.includes('브런치') || lastCategory.includes('런치') || lastCategory.includes('디너')) {
    return 'restaurant';
  }
  
  // 기본값 - 음식점으로 분류
  return 'restaurant';
}

// 주요 지역 좌표 캐시 (자주 사용되는 지역들)
const LOCATION_CACHE = {
  '마곡나루': { x: 126.82563, y: 37.56087 },
  '마곡나루역': { x: 126.82563, y: 37.56087 },
  '강남': { x: 127.0276, y: 37.4979 },
  '강남역': { x: 127.0276, y: 37.4979 },
  '홍대': { x: 126.9244, y: 37.5563 },
  '홍대입구역': { x: 126.9244, y: 37.5563 },
  '명동': { x: 126.9849, y: 37.5636 },
  '명동역': { x: 126.9849, y: 37.5636 },
  '종로': { x: 126.9783, y: 37.5703 },
  '종로3가역': { x: 126.9783, y: 37.5703 },
  '이태원': { x: 126.9953, y: 37.5347 },
  '이태원역': { x: 126.9953, y: 37.5347 },
  '압구정': { x: 127.0286, y: 37.5274 },
  '압구정역': { x: 127.0286, y: 37.5274 },
  '성수': { x: 127.0557, y: 37.5448 },
  '성수역': { x: 127.0557, y: 37.5448 },
  '건대': { x: 127.0703, y: 37.5404 },
  '건대입구역': { x: 127.0703, y: 37.5404 },
  '여의도': { x: 126.9244, y: 37.5219 },
  '여의도역': { x: 126.9244, y: 37.5219 },
  '용산': { x: 126.9648, y: 37.5326 },
  '용산역': { x: 126.9648, y: 37.5326 },
  '효창공원역': { x: 126.9609, y: 37.5394 },
  '남영역': { x: 126.9713, y: 37.5411 }
};

// 지역명으로 좌표를 구하는 함수
async function getLocationCoordinates(locationName) {
  try {
    // 캐시에서 먼저 확인
    const normalizedName = locationName.trim();
    if (LOCATION_CACHE[normalizedName]) {
      return LOCATION_CACHE[normalizedName];
    }
    
    // 역명 변형 체크 (예: "마곡나루" → "마곡나루역")
    const withStation = `${normalizedName}역`;
    if (LOCATION_CACHE[withStation]) {
      return LOCATION_CACHE[withStation];
    }
    
    const response = await axios.get(
      'https://dapi.kakao.com/v2/local/search/address.json',
      {
        params: {
          query: locationName,
          size: 1
        },
        headers: {
          'Authorization': `KakaoAK ${KAKAO_API_KEY}`
        }
      }
    );
    
    if (response.data.documents && response.data.documents.length > 0) {
      const place = response.data.documents[0];
      const coordinates = {
        x: parseFloat(place.x), // 경도
        y: parseFloat(place.y)  // 위도
      };
      
      // 캐시에 저장
      LOCATION_CACHE[normalizedName] = coordinates;
      
      return coordinates;
    }
    
    // 주소 검색에서 실패하면 키워드 검색으로 재시도
    const keywordResponse = await axios.get(
      'https://dapi.kakao.com/v2/local/search/keyword.json',
      {
        params: {
          query: `${locationName} 역`,
          size: 1,
          sort: 'accuracy'
        },
        headers: {
          'Authorization': `KakaoAK ${KAKAO_API_KEY}`
        }
      }
    );
    
    if (keywordResponse.data.documents && keywordResponse.data.documents.length > 0) {
      const place = keywordResponse.data.documents[0];
      const coordinates = {
        x: parseFloat(place.x),
        y: parseFloat(place.y)
      };
      
      // 캐시에 저장
      LOCATION_CACHE[normalizedName] = coordinates;
      
      return coordinates;
    }
    
    return null;
    
  } catch (error) {
    console.error(`좌표 검색 오류: ${locationName}`, error.message);
    return null;
  }
}

// 특정 장소가 실제로 존재하는지 확인하는 함수 (위치 기반 개선)
async function verifyPlaceExists(placeName, location) {
  try {
    if (!KAKAO_API_KEY) {
      return null;
    }

    // 지역 좌표 구하기
    const locationCoords = await getLocationCoordinates(location);
    
    let searchParams;
    if (locationCoords) {
      // 좌표 기반 검색
      searchParams = {
        query: placeName,
        x: locationCoords.x,
        y: locationCoords.y,
        radius: 2000,
        size: 5,
        sort: 'distance'
      };
    } else {
      // 폴백: 키워드 검색
      searchParams = {
        query: `${location} ${placeName}`,
        size: 5,
        sort: 'accuracy'
      };
    }
    
    const response = await axios.get(
      'https://dapi.kakao.com/v2/local/search/keyword.json',
      {
        params: searchParams,
        headers: {
          'Authorization': `KakaoAK ${KAKAO_API_KEY}`
        }
      }
    );

    if (response.data.documents && response.data.documents.length > 0) {
      // 여러 결과가 있을 때 가장 적절한 장소 선택
      let selectedPlace = response.data.documents[0];
      
      // 장소명 유사도 체크
      const targetName = placeName.toLowerCase();
      let bestMatch = null;
      let bestScore = 0;
      
      for (const place of response.data.documents) {
        const placeLowerName = place.place_name.toLowerCase();
        
        if (placeLowerName.includes(targetName) || targetName.includes(placeLowerName)) {
          const score = targetName.length > 0 ? 
            Math.max(placeLowerName.length - Math.abs(placeLowerName.length - targetName.length), 0) / placeLowerName.length : 0;
          
          if (score > bestScore) {
            bestMatch = place;
            bestScore = score;
          }
        }
      }
      
      // 더 나은 매치가 있으면 사용
      if (bestMatch && bestScore > 0.3) {
        selectedPlace = bestMatch;
      }
      
      // 카카오 카테고리를 표준 카테고리로 매핑
      const mappedCategory = mapKakaoCategory(selectedPlace.category_name);
      
      return {
        id: selectedPlace.id,
        name: selectedPlace.place_name,
        address: selectedPlace.road_address_name || selectedPlace.address_name,
        category: mappedCategory,
        originalCategory: selectedPlace.category_name,
        coordinates: {
          lat: parseFloat(selectedPlace.y),
          lng: parseFloat(selectedPlace.x)
        },
        phone: selectedPlace.phone || '',
        rating: 0,
        distance: selectedPlace.distance ? parseInt(selectedPlace.distance) : null,
        place_url: selectedPlace.place_url || '',
        verified: true
      };
    }
    
    return null;
    
  } catch (error) {
    console.error(`장소 검증 오류: ${placeName}`, error.message);
    return null;
  }
}

// 사용자 메시지에서 키워드 추출하는 함수
function extractKeywords(message) {
  // 지역 추출
  const locationMatch = message.match(/(효창공원역|남영역|여의도|강남|홍대|명동|종로|이태원|압구정|청담|삼성|역삼|논현|학동|신사|가로수길|성수|건대|왕십리|상수|합정|마포|용산|중구|강남구|서초구|종로구|성동구|마포구|영등포구|[가-힣]+역|[가-힣]+구|[가-힣]+동)/);
  
  // 카테고리 추출 (더 정확한 매핑)
  let category = '';
  if (message.includes('중식') || message.includes('중국집') || message.includes('짜장면') || message.includes('짬뽕')) {
    category = '중식';
  } else if (message.includes('분식') || message.includes('떡볶이') || message.includes('김밥') || message.includes('순대')) {
    category = '분식';
  } else if (message.includes('한식') || message.includes('한정식') || message.includes('불고기') || message.includes('갈비')) {
    category = '한식';
  } else if (message.includes('일식') || message.includes('일본') || message.includes('초밥') || message.includes('라멘')) {
    category = '일식';
  } else if (message.includes('양식') || message.includes('파스타') || message.includes('피자') || message.includes('스테이크')) {
    category = '양식';
  } else if (message.includes('카페') || message.includes('커피') || message.includes('디저트') || message.includes('베이커리')) {
    category = '카페';
  } else if (message.includes('술집') || message.includes('호프') || message.includes('펜션') || message.includes('바') || 
             message.includes('위스키') || message.includes('소주') || message.includes('맥주') || message.includes('양주') ||
             message.includes('칵테일') || message.includes('와인') || message.includes('술') || message.includes('주점') ||
             message.includes('이자카야') || message.includes('포차') || message.includes('룸바') || message.includes('펍')) {
    // 구체적인 주류명이 포함된 경우 더 정확한 검색어 사용
    if (message.includes('위스키')) {
      category = '위스키바';
    } else if (message.includes('칵테일')) {
      category = '칵테일바';
    } else if (message.includes('와인')) {
      category = '와인바';
    } else if (message.includes('맥주')) {
      category = '맥주집';
    } else {
      category = '술집';
    }
  } else if (message.includes('치킨') || message.includes('족발') || message.includes('보쌈')) {
    category = '치킨';
  } else if (message.includes('음식점') || message.includes('맛집') || message.includes('식당') || message.includes('레스토랑')) {
    category = '음식점';
  } else if (message.includes('공원') || message.includes('산책')) {
    category = '공원';
  } else {
    // 기본값으로 음식점
    category = '음식점';
  }
  
  const location = locationMatch ? locationMatch[1] : '서울';
  
  return { location, category };
}

// 추천된 장소들을 실제 API로 검증하는 함수
async function verifyRecommendedPlaces(recommendedPlaces, location) {
  const verifiedPlaces = [];
  
  // 병렬로 검증 (최대 5개까지만)
  const placesToVerify = recommendedPlaces.slice(0, 5);
  const verificationPromises = placesToVerify.map(placeName => 
    verifyPlaceExists(placeName, location)
  );
  
  const results = await Promise.all(verificationPromises);
  
  for (const result of results) {
    if (result) {
      verifiedPlaces.push(result);
    }
  }
  
  return verifiedPlaces;
}

// 키워드 기반 검색 폴백 함수
async function fallbackKeywordSearch(message, location) {
  const { location: extractedLocation, category } = extractKeywords(message);
  
  // 메시지에서 추출한 위치가 더 구체적이면 사용
  const searchLocation = location.includes('서울') && extractedLocation !== '서울' ? extractedLocation : location;
  
  console.log('🔍 키워드 검색 시작:', {
    message: message,
    originalLocation: location,
    extractedLocation: extractedLocation,
    searchLocation: searchLocation,
    category: category
  });
  
  try {
    // 좌표 기반 정확한 지역 검색
    const coordinates = await getLocationCoordinates(searchLocation);
    console.log('📍 좌표 검색 결과:', coordinates);
    
    if (coordinates) {
      // 좌표 기반으로 카카오 API 검색
      const response = await axios.get(
        'https://dapi.kakao.com/v2/local/search/keyword.json',
        {
          params: {
            query: category,
            x: coordinates.x,
            y: coordinates.y,
            radius: 2000,
            size: 15,
            sort: 'distance'
          },
          headers: {
            'Authorization': `KakaoAK ${KAKAO_API_KEY}`
          },
          timeout: 10000
        }
      );

      if (response.data.documents && response.data.documents.length > 0) {
        console.log('✅ 좌표 기반 검색 성공:', response.data.documents.length, '개 장소 발견');
        
        const places = response.data.documents.map((place, index) => ({
          id: place.id || `fallback_${index}`,
          name: place.place_name,
          address: place.road_address_name || place.address_name,
          category: mapKakaoCategory(place.category_name),
          coordinates: {
            lat: parseFloat(place.y),
            lng: parseFloat(place.x)
          },
          phone: place.phone || '',
          rating: 0,
          distance: place.distance ? parseInt(place.distance) : null,
          place_url: place.place_url || '',
          verified: true,
          verificationBadge: '✅ 검증됨'
        }));
        
        return {
          success: true,
          places: places,
          searchQuery: `${searchLocation} ${category}`,
          source: 'coordinate_based_fallback'
        };
      } else {
        console.log('❌ 좌표 기반 검색 결과 없음');
      }
    }
    
    // 좌표 기반 검색 실패 시 기존 방식으로 폴백
    console.log('⚠️ 좌표 기반 검색 실패, 기존 방식으로 폴백');
    const searchResult = await searchPlaces(category, searchLocation, 2000);
    
    if (searchResult.status === 'success' && searchResult.places.length > 0) {
      console.log('✅ 기존 방식 검색 성공:', searchResult.places.length, '개 장소 발견');
      return {
        success: true,
        places: searchResult.places,
        searchQuery: `${searchLocation} ${category}`,
        source: 'keyword_fallback'
      };
    } else {
      console.log('❌ 기존 방식 검색도 실패:', searchResult);
      return { success: false };
    }
  } catch (error) {
    console.error('키워드 검색 오류:', error.message);
    console.error('검색 실패 세부 정보:', {
      location: searchLocation,
      category: category,
      error: error.response?.data || error.message
    });
    return { success: false };
  }
}

// Kakao API를 사용한 장소 검색 함수 (기존 호환용)
async function searchPlaces(query, location, radius = 1000) {
  try {
    if (!KAKAO_API_KEY) {
      return {
        status: 'error',
        message: 'Kakao API 키가 설정되지 않았습니다.',
        location: location,
        places: []
      };
    }

    // 검색 쿼리 생성
    let searchQuery = `${location} ${query}`;

    // Kakao Places API 호출
    const response = await axios.get(
      'https://dapi.kakao.com/v2/local/search/keyword.json',
      {
        params: {
          query: searchQuery,
          radius: radius,
          size: 15,
          sort: 'accuracy'
        },
        headers: {
          'Authorization': `KakaoAK ${KAKAO_API_KEY}`
        }
      }
    );

    if (!response.data.documents || response.data.documents.length === 0) {
      return {
        status: 'redirect_to_search',
        message: `현재는 검색 기반 장소 서비스만 제공합니다.`,
        location: location,
        query: query,
        places: [],
        redirectInfo: {
          tabName: '검색 기반 장소',
          description: '원하는 지역과 카테고리를 선택하여 실시간으로 장소를 검색할 수 있습니다.',
          action: 'redirect_to_search_tab'
        }
      };
    }

    // 카카오 API 응답을 표준 장소 형식으로 변환
    const places = response.data.documents.map((place, index) => ({
      id: place.id || `kakao_${index}`,
      name: place.place_name,
      address: place.road_address_name || place.address_name,
      category: place.category_name,
      coordinates: {
        lat: parseFloat(place.y),
        lng: parseFloat(place.x)
      },
      phone: place.phone || '',
      rating: 0,
      distance: place.distance ? parseInt(place.distance) : null,
      place_url: place.place_url || ''
    }));

    return {
      status: 'success',
      location: location,
      query: query,
      places: places,
      total: places.length,
      source: 'kakao'
    };

  } catch (error) {
    console.error('Kakao 장소 검색 오류:', error.response?.data || error.message);
    
    // 검색 실패 시 검색 기반 장소 탭으로 안내
    return {
      status: 'redirect_to_search',
      message: `현재는 검색 기반 장소 서비스만 제공합니다.`,
      location: location,
      query: query,
      places: [],
      error: error.response?.data || error.message,
      redirectInfo: {
        tabName: '검색 기반 장소',
        description: '원하는 지역과 카테고리를 선택하여 실시간으로 장소를 검색할 수 있습니다.',
        action: 'redirect_to_search_tab'
      }
    };
  }
}

// 사용 가능한 Gemini 모델들
const AVAILABLE_MODELS = {
  'flash-latest': 'gemini-1.5-flash-latest',
  'flash': 'gemini-1.5-flash',
  'flash-001': 'gemini-1.5-flash-001', 
  'flash-002': 'gemini-1.5-flash-002',
  'pro': 'gemini-1.5-pro',
  'pro-001': 'gemini-1.5-pro-001',
  'pro-002': 'gemini-1.5-pro-002',
  '2.5-flash': 'gemini-2.5-flash-preview-05-20',
  '2.5-flash-lite': 'gemini-2.5-flash-lite-preview-06-17',
  '2.5-pro': 'gemini-2.5-pro-preview-06-05',
  '2.0-flash': 'gemini-2.0-flash',
  '2.0-flash-lite': 'gemini-2.0-flash-lite'
};

// 현재 사용할 모델 (환경변수로 변경 가능)
// 안정적인 모델로 변경: 2.5-flash preview는 불안정할 수 있음
const CURRENT_MODEL = process.env.GEMINI_MODEL || '2.0-flash';
console.log(`🤖 사용 중인 모델: ${CURRENT_MODEL} -> ${AVAILABLE_MODELS[CURRENT_MODEL]}`);
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${AVAILABLE_MODELS[CURRENT_MODEL]}:generateContent`; 

// AI 도우미와 채팅 (Gemini API만 사용) - 게스트도 허용
router.post('/chat', async (req, res) => {
  try {
    const { message, context } = req.body;

    if (!message) {
      return res.status(400).json({
        success: false,
        message: '메시지가 필요합니다.'
      });
    }

    // API 키 확인 및 로테이션
    const currentApiKey = getCurrentApiKey();
    if (!currentApiKey) {
      const rotationInfo = getApiKeyRotationInfo();
      
      if (rotationInfo.totalKeys === 0) {
        return res.status(500).json({
          success: false,
          message: 'AI 서비스 설정에 문제가 있습니다. API 키가 설정되지 않았습니다.'
        });
      } else {
        return res.status(429).json({
          success: false,
          message: '🚦 모든 API 키의 일일 사용량 한도에 도달했습니다.',
          details: {
            reason: '모든 API 키 한도 초과',
            apiKeyRotation: {
              totalKeys: rotationInfo.totalKeys,
              totalDailyUsage: rotationInfo.totalDailyUsage,
              maxDailyCapacity: rotationInfo.maxDailyCapacity,
              percentage: Math.round(rotationInfo.totalDailyUsage / rotationInfo.maxDailyCapacity * 100)
            },
            suggestions: [
              `${rotationInfo.totalKeys}개 API 키 모두 한도 도달 (${rotationInfo.totalDailyUsage}/${rotationInfo.maxDailyCapacity}회)`,
              '내일 다시 시도해주세요',
              '검색 기반 장소 탭을 이용해보세요'
            ]
          },
          fallbackAction: '검색 기반 장소 탭을 이용해보세요.'
        });
      }
    }

    // 사용자 정보 가져오기 (게스트는 선택사항)
    let user = null;
    let isGuest = true;
    
    // Authorization 헤더가 있으면 사용자 인증 시도
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const token = authHeader.substring(7);
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        user = await User.findById(decoded.userId);
        if (user) {
          isGuest = false;
        }
      } catch (error) {
        // 토큰 검증 실패 시 게스트로 처리
      }
    }

    // 장소 추천 요청인지 확인
    const isPlaceRecommendation = message.toLowerCase().includes('추천') || 
                                 message.toLowerCase().includes('장소') ||
                                 message.toLowerCase().includes('곳') ||
                                 message.toLowerCase().includes('카페') ||
                                 message.toLowerCase().includes('음식점') ||
                                 message.toLowerCase().includes('레스토랑') ||
                                 message.toLowerCase().includes('맛집') ||
                                 message.toLowerCase().includes('공원') ||
                                 message.toLowerCase().includes('만날') ||
                                 message.toLowerCase().includes('미팅') ||
                                 message.toLowerCase().includes('위스키') ||
                                 message.toLowerCase().includes('술집') ||
                                 message.toLowerCase().includes('바') ||
                                 message.toLowerCase().includes('펍') ||
                                 message.toLowerCase().includes('호프') ||
                                 message.toLowerCase().includes('칵테일') ||
                                 message.toLowerCase().includes('맥주') ||
                                 message.toLowerCase().includes('소주') ||
                                 message.toLowerCase().includes('와인') ||
                                 context?.isPlaceRecommendation;

    // 로그인 사용자의 경우 AI 추천 사용 제한 확인
    if (isPlaceRecommendation && !isGuest && user) {
      const usageStatus = user.canUseAIRecommendation();
      
      if (!usageStatus.canUse) {
        return res.status(403).json({
          success: false,
          message: '무료 사용자는 AI 장소 추천을 3회만 이용할 수 있습니다. 프리미엄으로 업그레이드하여 무제한 이용하세요!',
          data: {
            usageLimit: true,
            used: usageStatus.used,
            limit: usageStatus.limit,
            remaining: usageStatus.remaining
          }
        });
      }
    }

    // 세션 ID 정의 (API 사용량 추적용)
    const sessionId = req.headers['x-session-id'] || req.ip || 'unknown';

    console.log('📝 사용자 메시지:', message);
    console.log('📋 컨텍스트:', JSON.stringify(context, null, 2));

    // 대화 기록 포함한 프롬프트 설정 
    const conversationHistory = context?.conversationHistory || [];
    const historyText = conversationHistory.length > 0 
      ? `\n이전 대화 기록:\n${conversationHistory.map(msg => 
          `${msg.role === 'user' ? '사용자' : 'AI'}: ${msg.content}`
        ).join('\n')}\n`
      : '';

    // 새로운 AI 우선 추천 시스템 프롬프트
    const systemPrompt = `당신은 한국의 미팅 장소 추천 전문 AI 도우미입니다.

중요 지침:
1. 사용자의 요청을 정확히 파악하여 해당하는 카테고리의 장소들을 추천하세요
2. 반드시 요청된 지역과 카테고리에 맞는 장소들만 추천하세요
3. 최소 3-5개의 장소를 추천해주세요 (더 많은 선택지를 제공하기 위해)
4. 구체적인 장소명을 포함하여 추천해주세요 (예: "김밥천국 효창공원점", "맘스터치 남영역점" 등)
5. 반드시 다음 형식으로 응답하세요:

⚠️ 중요 규칙:
- 사용자가 "분식집"을 요청하면 오직 분식집만 추천하세요 (떡볶이, 김밥, 순대 등)
- 사용자가 "위스키 파는곳"을 요청하면 오직 술집/바만 추천하세요 (위스키 전문점, 펍, 호프집 등)
- 사용자가 "효창공원역 부근"을 요청하면 효창공원역 근처 장소만 추천하세요
- "예약", "가격대", "영업시간", "주차", "교통" 등의 정보성 항목은 절대 "* 항목명:" 형식으로 작성하지 마세요
- 오직 실제 존재하는 장소의 이름만 "* 장소명:" 형식으로 작성하세요

카테고리별 추천 가이드:
- 위스키/주류: 위스키 전문점, 칵테일 바, 펍, 호프집, 이자카야
- 분식: 떡볶이, 김밥, 순대, 만두 전문점
- 카페: 커피전문점, 디저트카페, 브런치카페
- 음식점: 한식, 중식, 일식, 양식 등 식사 장소

올바른 응답 형식:
* 장소명: 해당 장소의 특징이나 분위기를 설명하는 한 줄 코멘트
* 다른장소명: 해당 장소만의 매력이나 추천 이유를 간단히 설명

올바른 예시 (위스키 파는곳 요청 시):
* 맥스 위스키바 용산점: 다양한 종류의 위스키와 칵테일을 즐길 수 있는 전문 바
* 호프하우스 남영역점: 생맥주와 위스키를 함께 즐길 수 있는 펍
* 블루노트 효창점: 위스키와 재즈 음악을 즐길 수 있는 분위기 좋은 바

잘못된 예시 (절대 하지 마세요):
* 예약: 전화로 미리 예약하세요
* 가격대: 1만원~2만원 정도입니다
* 스타벅스: 커피전문점 (위스키를 파는 곳이 아님)

추가 정보가 필요하면 장소 추천 후 별도 문단으로 작성하세요.

현재 컨텍스트: ${context ? JSON.stringify(context) : '정보 없음'}${historyText}`;

    let aiResponse = '';
    let verifiedPlaces = [];
    let usedKeywordFallback = false;

    if (isPlaceRecommendation) {
      console.log('📤 1단계: AI에게 장소 추천 요청...');
      
      // 1단계: AI에게 먼저 장소 추천 요청 (Function calling 없이)
      const requestBody = {
        contents: [{
          parts: [{ text: `${systemPrompt}\n\n사용자 질문: ${message}` }]
        }],
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.8,
          maxOutputTokens: 1000
        }
      };

      console.log('📤 Gemini API 요청 중...', {
        model: AVAILABLE_MODELS[CURRENT_MODEL],
        apiKeyPreview: `${currentApiKey.substring(0, 20)}...`,
        messageLength: message.length
      });

      // API 사용량 추적 - 초기 요청
      trackApiUsage('initial', sessionId);

      const response = await axios.post(
        `${GEMINI_API_URL}?key=${currentApiKey}`,
        requestBody,
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 25000 // timeout 늘림
        }
      );

      console.log('✅ Gemini API 응답 받음', {
        status: response.status,
        candidatesCount: response.data.candidates?.length || 0
      });

      console.log('📥 초기 AI 응답 데이터 수신:', {
        candidates: response.data.candidates?.length || 0,
        status: response.status
      });
      
      const candidate = response.data.candidates?.[0];
      
      // AI 응답 텍스트 추출
      if (candidate?.content?.parts) {
        for (const part of candidate.content.parts) {
          if (part.text) {
            aiResponse += part.text;
          }
        }
        console.log('✅ 초기 AI 응답 생성 완료 - 길이:', aiResponse.length);
      } else {
        console.error('❌ 초기 AI 응답 파싱 실패:', candidate);
        aiResponse = '죄송합니다. 장소 추천 응답을 생성하는 중 문제가 발생했습니다.';
      }

      if (aiResponse) {
        console.log('📤 2단계: 추천된 장소들 실제 검증...');
        
        // 2단계: AI 응답에서 장소명들 파싱
        const recommendedPlaces = parseRecommendedPlaces(aiResponse);
        
        if (recommendedPlaces.length > 0) {
          // 3단계: 메시지에서 지역 정보 자동 추출
          const extractedInfo = extractKeywords(message);
          const location = extractedInfo.location || '서울';
          console.log(`🎯 메시지에서 추출된 지역: "${location}" (원본: "${message}")`);
          
          // 4단계: 추천된 장소들을 실제 API로 검증
          verifiedPlaces = await verifyRecommendedPlaces(recommendedPlaces, location);
          
          // 5단계: 검증된 장소들이 충분하면 새로운 응답 생성, 부족하면 키워드 폴백 실행
          if (verifiedPlaces.length >= 3) {
            console.log('📤 3단계: 검증된 장소들로 최종 응답 생성...');
            
            const verifiedPlacesText = verifiedPlaces.map(place => 
              `* ${place.name}: ${place.address} - ${place.category}`
            ).join('\n');
            
            const finalPrompt = `다음은 실제로 존재하는 것으로 확인된 장소들입니다:

${verifiedPlacesText}

위 장소들을 바탕으로 사용자에게 친근하고 매력적인 추천을 해주세요. 각 장소의 특징이나 추천 이유를 간단히 설명해주세요.

형식:
* 장소명: 해당 장소의 특징이나 분위기를 설명하는 한 줄 코멘트

사용자 요청: ${message}`;

            const finalRequestBody = {
              contents: [{
                parts: [{ text: finalPrompt }]
              }],
              generationConfig: {
                temperature: 0.7,
                topK: 40,
                topP: 0.8,
                maxOutputTokens: 1000
              }
            };

            // API 사용량 추적 - 최종 응답 생성
            trackApiUsage('final', sessionId);
            
            const finalResponse = await axios.post(
              `${GEMINI_API_URL}?key=${currentApiKey}`,
              finalRequestBody,
              {
                headers: { 'Content-Type': 'application/json' },
                timeout: 15000
              }
            );

            console.log('📥 최종 응답 데이터 수신:', {
              candidates: finalResponse.data.candidates?.length || 0,
              status: finalResponse.status
            });
            
            const finalCandidate = finalResponse.data.candidates?.[0];
            aiResponse = ''; // 응답 초기화
            
            if (finalCandidate?.content?.parts) {
              for (const part of finalCandidate.content.parts) {
                if (part.text) {
                  aiResponse += part.text;
                }
              }
              console.log('✅ 최종 검증된 응답 생성 완료 - 길이:', aiResponse.length);
            } else {
              console.error('❌ 최종 응답 파싱 실패:', finalCandidate);
              aiResponse = '검증된 장소들을 찾았지만 응답 생성에 실패했습니다.';
            }
          } else {
            console.log('⚠️ 검증된 장소가 없음, 키워드 기반 검색으로 폴백...');
            
            // 키워드 기반 폴백 검색 시도
            const extractedInfo = extractKeywords(message);
            const location = extractedInfo.location || '서울';
            console.log(`🎯 폴백에서 추출된 지역: "${location}"`);
            
            const fallbackResult = await fallbackKeywordSearch(message, location);
            
            if (fallbackResult.success && fallbackResult.places.length > 0) {
              console.log('✅ 키워드 검색 폴백 성공');
              
              // 폴백 검색 결과로 최종 응답 생성
              const fallbackPlacesText = fallbackResult.places.slice(0, 5).map(place => 
                `* ${place.name}: ${place.address} - ${place.category}`
              ).join('\n');
              
              const fallbackPrompt = `다음은 "${fallbackResult.searchQuery}" 검색으로 찾은 실제 장소들입니다:

${fallbackPlacesText}

사용자의 요청에 맞게 위 장소들 중에서 적절한 곳들을 추천해주세요. 각 장소의 특징이나 추천 이유를 간단히 설명해주세요.

형식:
* 장소명: 해당 장소의 특징이나 분위기를 설명하는 한 줄 코멘트

사용자 요청: ${message}`;

              const fallbackRequestBody = {
                contents: [{
                  parts: [{ text: fallbackPrompt }]
                }],
                generationConfig: {
                  temperature: 0.7,
                  topK: 40,
                  topP: 0.8,
                  maxOutputTokens: 1000
                }
              };

              // API 사용량 추적 - 폴백 응답 생성
              trackApiUsage('fallback', sessionId);
              
              const fallbackResponse = await axios.post(
                `${GEMINI_API_URL}?key=${currentApiKey}`,
                fallbackRequestBody,
                {
                  headers: { 'Content-Type': 'application/json' },
                  timeout: 15000
                }
              );

              console.log('📥 폴백 응답 데이터 수신:', {
                candidates: fallbackResponse.data.candidates?.length || 0,
                status: fallbackResponse.status
              });
              
              const fallbackCandidate = fallbackResponse.data.candidates?.[0];
              aiResponse = ''; // 응답 초기화
              
              if (fallbackCandidate?.content?.parts) {
                for (const part of fallbackCandidate.content.parts) {
                  if (part.text) {
                    aiResponse += part.text;
                  }
                }
                console.log('✅ 키워드 폴백 응답 생성 완료 - 길이:', aiResponse.length);
              } else {
                console.error('❌ 폴백 응답 파싱 실패:', fallbackCandidate);
                aiResponse = `"${fallbackResult.searchQuery}" 검색으로 찾은 장소들을 추천드립니다.`;
              }
              
              verifiedPlaces = fallbackResult.places.slice(0, 5); // 처음 5개만 사용
              usedKeywordFallback = true;
            } else {
              console.log('❌ 키워드 검색도 실패, 검색 기반 장소로 안내');
              console.log('검색 실패 원인 분석:', {
                message: message,
                extractedLocation: extractedInfo.location,
                searchLocation: location,
                category: extractedInfo.category || '추출 실패'
              });
              return res.json({
                success: true,
                data: {
                  response: '현재는 검색 기반 장소 서비스만 제공합니다.',
                  timestamp: new Date(),
                  context: context,
                  usedFunctionCalls: false,
                  forcedSearch: false,
                  redirectInfo: {
                    tabName: '검색 기반 장소',
                    description: '원하는 지역과 카테고리를 선택하여 실시간으로 장소를 검색할 수 있습니다.',
                    action: 'redirect_to_search_tab'
                  }
                }
              });
            }
          }
        } else {
          console.log('⚠️ 파싱된 장소가 없음, 키워드 기반 검색으로 폴백...');
          
          // AI가 형식을 지키지 않았거나 파싱 실패 시에도 키워드 검색 시도
          const extractedInfo = extractKeywords(message);
          const location = extractedInfo.location || '서울';
          console.log(`🎯 파싱 실패 폴백에서 추출된 지역: "${location}"`);
          
          const fallbackResult = await fallbackKeywordSearch(message, location);
          
          if (fallbackResult.success && fallbackResult.places.length > 0) {
            console.log('✅ 파싱 실패 후 키워드 검색 폴백 성공');
            
            // 폴백 검색 결과로 최종 응답 생성
            const fallbackPlacesText = fallbackResult.places.slice(0, 5).map(place => 
              `* ${place.name}: ${place.address} - ${place.category}`
            ).join('\n');
            
            const fallbackPrompt = `다음은 "${fallbackResult.searchQuery}" 검색으로 찾은 실제 장소들입니다:

${fallbackPlacesText}

사용자의 요청에 맞게 위 장소들 중에서 적절한 곳들을 추천해주세요. 각 장소의 특징이나 추천 이유를 간단히 설명해주세요.

형식:
* 장소명: 해당 장소의 특징이나 분위기를 설명하는 한 줄 코멘트

사용자 요청: ${message}`;

            const fallbackRequestBody = {
              contents: [{
                parts: [{ text: fallbackPrompt }]
              }],
              generationConfig: {
                temperature: 0.7,
                topK: 40,
                topP: 0.8,
                maxOutputTokens: 1000
              }
            };

            // API 사용량 추적 - 파싱 실패 후 폴백 응답 생성
            trackApiUsage('fallback', sessionId);
            
            const fallbackResponse = await axios.post(
              `${GEMINI_API_URL}?key=${currentApiKey}`,
              fallbackRequestBody,
              {
                headers: { 'Content-Type': 'application/json' },
                timeout: 15000
              }
            );

            console.log('📥 파싱 실패 후 폴백 응답 데이터 수신:', {
              candidates: fallbackResponse.data.candidates?.length || 0,
              status: fallbackResponse.status
            });
            
            const fallbackCandidate = fallbackResponse.data.candidates?.[0];
            aiResponse = ''; // 응답 초기화
            
            if (fallbackCandidate?.content?.parts) {
              for (const part of fallbackCandidate.content.parts) {
                if (part.text) {
                  aiResponse += part.text;
                }
              }
              console.log('✅ 파싱 실패 후 키워드 폴백 응답 생성 완료 - 길이:', aiResponse.length);
            } else {
              console.error('❌ 파싱 실패 후 폴백 응답 파싱 실패:', fallbackCandidate);
              aiResponse = `"${fallbackResult.searchQuery}" 검색으로 찾은 장소들을 추천드립니다.`;
            }
            
            verifiedPlaces = fallbackResult.places.slice(0, 5); // 처음 5개만 사용
            usedKeywordFallback = true;
          } else {
            console.log('⚠️ 파싱 실패 후 키워드 검색도 실패, 원본 AI 응답 사용');
            // 원본 AI 응답을 그대로 사용
          }
        }
      }
    } else {
      console.log('📤 일반 대화 처리...');
      
      // 일반 대화의 경우 기존 로직
      const requestBody = {
        contents: [{
          parts: [{ text: `${systemPrompt}\n\n사용자 질문: ${message}` }]
        }],
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.8,
          maxOutputTokens: 1000
        }
      };

      // API 사용량 추적 - 일반 대화
      trackApiUsage('chat', sessionId);
      
      const response = await axios.post(
        `${GEMINI_API_URL}?key=${currentApiKey}`,
        requestBody,
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 15000
        }
      );

      console.log('📥 일반 대화 응답 데이터 수신:', {
        candidates: response.data.candidates?.length || 0,
        status: response.status
      });

      const candidate = response.data.candidates?.[0];
      
      if (candidate?.content?.parts) {
        for (const part of candidate.content.parts) {
          if (part.text) {
            aiResponse += part.text;
          }
        }
        console.log('✅ 일반 대화 응답 생성 완료 - 길이:', aiResponse.length);
      } else {
        console.error('❌ 일반 대화 응답 파싱 실패:', candidate);
        aiResponse = '죄송합니다. 응답을 생성하는 중 문제가 발생했습니다.';
      }
    }
    
    // 최종 응답 처리
    if (!aiResponse) {
      console.error('❌ 모든 단계에서 AI 응답 생성 실패');
      aiResponse = '죄송합니다. 응답을 생성할 수 없습니다. 잠시 후 다시 시도해주세요.';
    }

    console.log('📝 최종 AI 응답 길이:', aiResponse.length);
    console.log('📝 AI 응답 미리보기:', aiResponse.substring(0, 100) + (aiResponse.length > 100 ? '...' : ''));

    // 로그인 사용자의 경우 장소 추천 성공 시 사용 횟수 증가
    if (isPlaceRecommendation && aiResponse && aiResponse.length > 0 && !isGuest && user) {
      try {
        await user.incrementAIRecommendationUsage();
        console.log('✅ AI 추천 사용 횟수 증가:', user.analytics.aiRecommendationUsage);
        
        // 사용량이 높을 때 경고 로그
        if (user.analytics.aiRecommendationUsage >= 50) {
          console.warn('⚠️ 높은 AI 사용량 감지:', {
            userId: user._id,
            usage: user.analytics.aiRecommendationUsage,
            model: AVAILABLE_MODELS[CURRENT_MODEL]
          });
        }
      } catch (error) {
        console.error('⚠️ AI 추천 사용 횟수 증가 실패:', error);
      }
    }

    // AI 질의 로깅
    try {
      const userInfo = await extractUserInfo(req);
      const category = categorizeQuery(message, isPlaceRecommendation ? 'place_recommendation' : 'chat_assistance');
      
      await logAIQuery({
        userId: userInfo.userId,
        userType: userInfo.userType,
        sessionId: sessionId,
        query: message,
        queryType: isPlaceRecommendation ? 'place_recommendation' : 'chat_assistance',
        context: {
          meetingId: context?.meetingId,
          location: context?.location,
          preferences: context?.preferences,
          conversationHistory: context?.conversationHistory?.slice(-3), // 최근 3개만 저장
          isPlaceRecommendation: isPlaceRecommendation,
          usedKeywordFallback: usedKeywordFallback
        },
        response: aiResponse,
        responseTime: Date.now() - (req.startTime || Date.now()),
        aiModel: AVAILABLE_MODELS[CURRENT_MODEL],
        success: true,
        category: category,
        tags: [
          isPlaceRecommendation ? 'place_recommendation' : 'general_chat',
          usedKeywordFallback ? 'keyword_fallback' : 'ai_direct',
          verifiedPlaces.length > 0 ? 'verified_places' : 'unverified'
        ],
        ipAddress: req.ip || req.connection.remoteAddress,
        userAgent: req.get('User-Agent')
      });
    } catch (loggingError) {
      console.error('⚠️ AI 질의 로깅 실패:', loggingError);
      // 로깅 실패는 서비스에 영향을 주지 않음
    }

    // 응답에 API 사용량 정보 추가
    const finalApiUsageInfo = getApiUsageInfo();
    
    res.json({
      success: true,
      data: {
        response: aiResponse,
        timestamp: new Date(),
        context: context,
        usedNewLogic: isPlaceRecommendation,
        usedKeywordFallback: usedKeywordFallback,
        verifiedPlaces: verifiedPlaces.length > 0 ? verifiedPlaces : undefined,
        apiUsage: process.env.NODE_ENV === 'development' ? {
          dailyTotal: finalApiUsageInfo.totalToday,
          remaining: finalApiUsageInfo.remaining,
          percentage: finalApiUsageInfo.percentage,
          breakdown: finalApiUsageInfo.breakdown,
          sessionId: sessionId
        } : undefined,
        debug: process.env.NODE_ENV === 'development' ? {
          isPlaceRecommendation: isPlaceRecommendation,
          verifiedPlacesCount: verifiedPlaces.length,
          usedKeywordFallback: usedKeywordFallback
        } : undefined
      }
    });

  } catch (error) {
    console.error('AI 도우미 에러:', error);
    console.error('상세 에러 정보:', error.response?.data || error.message);
    console.error('스택 트레이스:', error.stack);

    // 에러 상황 AI 질의 로깅
    try {
      const userInfo = await extractUserInfo(req);
      const category = categorizeQuery(message || '', 'chat_assistance');
      
      await logAIQuery({
        userId: userInfo.userId,
        userType: userInfo.userType,
        sessionId: req.headers['x-session-id'] || req.ip || 'unknown',
        query: message || '',
        queryType: 'chat_assistance',
        context: context || {},
        response: `에러 발생: ${error.message}`,
        responseTime: Date.now() - (req.startTime || Date.now()),
        aiModel: AVAILABLE_MODELS[CURRENT_MODEL],
        success: false,
        errorMessage: error.message,
        category: category,
        tags: ['error', error.response?.status?.toString() || 'unknown_error'],
        ipAddress: req.ip || req.connection.remoteAddress,
        userAgent: req.get('User-Agent')
      });
    } catch (loggingError) {
      console.error('⚠️ 에러 상황 AI 질의 로깅 실패:', loggingError);
    }
    
    // Timeout 에러 처리
    if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
      return res.status(503).json({
        success: false,
        message: 'AI 서비스 응답 시간이 초과되었습니다. 잠시 후 다시 시도해주세요.'
      });
    }
    
    // Gemini API 특정 에러 처리
    if (error.response?.status === 400) {
      const errorMessage = error.response.data?.error?.message || 'AI 요청이 올바르지 않습니다.';
      
      // Gemini 모델 관련 에러 체크
      if (errorMessage.includes('model') || errorMessage.includes('not found')) {
        console.error('❌ Gemini 모델 에러 감지:', errorMessage);
        // TODO: 여기서 다른 모델로 재시도할 수 있음
      }
      
      return res.status(400).json({
        success: false,
        message: 'AI 요청 처리 중 문제가 발생했습니다.',
        error: process.env.NODE_ENV === 'development' ? error.response.data : undefined
      });
    }
    
    if (error.response?.status === 403) {
      return res.status(403).json({
        success: false,
        message: 'AI API 키 권한이 없습니다.'
      });
    }
    
    // 429 (Rate Limit) 에러 처리
    if (error.response?.status === 429) {
      const errorDetails = error.response.data?.error || {};
      const retryAfter = error.response.headers?.['retry-after'] || 60;
      
      console.error('❌ Gemini API Rate Limit 초과:', {
        model: AVAILABLE_MODELS[CURRENT_MODEL],
        errorDetails,
        retryAfter
      });
      
      const apiUsageInfo = getApiUsageInfo();
      
      return res.status(429).json({
        success: false,
        message: '🚦 AI API 사용량 한도를 초과했습니다.',
        details: {
          reason: 'API Rate Limit 초과',
          retryAfter: parseInt(retryAfter),
          currentModel: AVAILABLE_MODELS[CURRENT_MODEL],
          apiUsage: {
            dailyTotal: apiUsageInfo.totalToday,
            percentage: apiUsageInfo.percentage,
            breakdown: apiUsageInfo.breakdown
          },
          suggestions: [
            `오늘 ${apiUsageInfo.totalToday}/100회 사용 (${apiUsageInfo.percentage}%)`,
            '1-2분 후 다시 시도해주세요',
            '검색 기반 장소 탭을 이용해보세요',
            '프리미엄 업그레이드 시 더 높은 한도를 이용할 수 있습니다'
          ]
        },
        fallbackAction: '검색 기반 장소 탭을 이용해보세요.'
      });
    }

    // 503 (Service Unavailable) 에러 처리 - Gemini 모델 과부하
    if (error.response?.status === 503) {
      const errorMessage = error.response.data?.error?.message || '';
      
      if (errorMessage.includes('overloaded') || errorMessage.includes('unavailable')) {
        return res.status(503).json({
          success: false,
          message: '🤖 AI 서비스가 현재 과부하 상태입니다. 잠시 후 다시 시도해주세요.',
          retryAfter: 30, // 30초 후 재시도 권장
          fallbackAction: '검색 기반 장소 탭을 이용해보세요.'
        });
      }
      
      return res.status(503).json({
        success: false,
        message: '🛠️ AI 서비스에 일시적인 문제가 발생했습니다. 잠시 후 다시 시도해주세요.'
      });
    }

    res.status(500).json({
      success: false,
      message: 'AI 도우미 서비스에 일시적인 문제가 발생했습니다.',
      error: process.env.NODE_ENV === 'development' ? {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data,
        currentModel: AVAILABLE_MODELS[CURRENT_MODEL]
      } : undefined
    });
  }
});

// AI 도우미 상태 확인
router.get('/status', (req, res) => {
  res.json({
    success: true,
    data: {
      status: 'active',
      currentModel: AVAILABLE_MODELS[CURRENT_MODEL],
      modelKey: CURRENT_MODEL,
      availableModels: AVAILABLE_MODELS,
      features: [
        '실시간 대화',
        '장소 추천',
        '상황별 조언',
        '다양한 카테고리 지원'
      ]
    }
  });
});

// AI 장소 추천 (기존 프론트엔드 호환용) - 게스트도 허용
router.post('/recommend-places', async (req, res) => {
  console.log('🚀 AI 장소 추천 요청 받음!');
  console.log('Request body:', JSON.stringify(req.body, null, 2));
  
  try {
    const { preferences } = req.body;

    if (!preferences) {
      return res.status(400).json({
        success: false,
        message: '추천 설정이 필요합니다.'
      });
    }

    // API 키 확인 및 로테이션
    const currentApiKey = getCurrentApiKey();
    if (!currentApiKey) {
      const rotationInfo = getApiKeyRotationInfo();
      
      if (rotationInfo.totalKeys === 0) {
        return res.status(500).json({
          success: false,
          message: 'AI 서비스 설정에 문제가 있습니다. API 키가 설정되지 않았습니다.'
        });
      } else {
        return res.status(429).json({
          success: false,
          message: '🚦 모든 API 키의 일일 사용량 한도에 도달했습니다.',
          details: {
            reason: '모든 API 키 한도 초과',
            apiKeyRotation: {
              totalKeys: rotationInfo.totalKeys,
              totalDailyUsage: rotationInfo.totalDailyUsage,
              maxDailyCapacity: rotationInfo.maxDailyCapacity,
              percentage: Math.round(rotationInfo.totalDailyUsage / rotationInfo.maxDailyCapacity * 100)
            },
            suggestions: [
              `${rotationInfo.totalKeys}개 API 키 모두 한도 도달 (${rotationInfo.totalDailyUsage}/${rotationInfo.maxDailyCapacity}회)`,
              '내일 다시 시도해주세요',
              '검색 기반 장소 탭을 이용해보세요'
            ]
          },
          fallbackAction: '검색 기반 장소 탭을 이용해보세요.'
        });
      }
    }

    // 사용자 정보 가져오기 (게스트는 선택사항)
    let user = null;
    let isGuest = true;
    
    // Authorization 헤더가 있으면 사용자 인증 시도
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const token = authHeader.substring(7);
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        user = await User.findById(decoded.id);
        if (user) {
          isGuest = false;
        }
      } catch (error) {
        console.log('토큰 검증 실패, 게스트로 처리:', error.message);
      }
    }

    // 로그인 사용자의 경우 사용 제한 확인
    if (!isGuest && user) {
      const usageStatus = user.canUseAIRecommendation();
      console.log('AI 추천 사용 상태:', usageStatus);
      
      if (!usageStatus.canUse) {
        return res.status(403).json({
          success: false,
          message: '무료 사용자는 AI 장소 추천을 3회만 이용할 수 있습니다. 프리미엄으로 업그레이드하여 무제한 이용하세요!',
          data: {
            usageLimit: true,
            used: usageStatus.used,
            limit: usageStatus.limit,
            remaining: usageStatus.remaining
          }
        });
      }
    }

    // 장소 추천 메시지 생성
    const message = `다음 조건에 맞는 장소를 추천해주세요:
- 위치: ${preferences.location || '서울'}
- 인원: ${preferences.participants || '2-4명'}
- 예산: ${preferences.budget || '중간'}
- 목적: ${preferences.purpose || '친목'}
- 카테고리: ${preferences.category || '음식점'}
- 교통수단: ${preferences.transportMode || '자가용'}
- 최대거리: ${preferences.maxDistance || 30}km`;

    // AI 채팅 API 로직 재사용
    const systemPrompt = `당신은 한국의 미팅 장소 추천 전문 AI 도우미입니다.

중요 규칙:
- 장소를 추천할 때는 반드시 search_places 함수를 사용해 실제 존재하는 장소를 검색해야 합니다
- 사용자가 실망하지 않도록 긍정적이고 유용한 정보를 항상 제공하세요
- 사용자가 지역을 명시하지 않으면 "서울"을 기본값으로 사용하세요

역할과 목표:
- 실제 검색된 장소 데이터를 바탕으로 신뢰할 수 있는 추천을 제공합니다
- 한국어로 친근하고 전문적으로 답변합니다`;

    // Function Calling을 통한 AI 요청
    let requestBody = {
      contents: [{
        parts: [{ text: `${systemPrompt}\n\n사용자 요청: ${message}` }]
      }],
      tools: [{
        function_declarations: Object.values(AVAILABLE_FUNCTIONS)
      }],
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.8,
        maxOutputTokens: 1500
      }
    };

    console.log('📤 AI 요청 전송 중... (API 키:', `${currentApiKey.substring(0, 8)}...)`);
    // API 사용량 추적 - 장소 추천
    const sessionId = req.headers['x-session-id'] || req.ip || 'unknown';
    trackApiUsage('recommend', sessionId);
    
    let response = await axios.post(
      `${GEMINI_API_URL}?key=${currentApiKey}`,
      requestBody,
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 30000
      }
    );

    let candidate = response.data.candidates[0];
    
    // Function Call 처리
    let functionCall = null;
    for (const part of candidate.content?.parts || []) {
      if (part.functionCall) {
        functionCall = part.functionCall;
        break;
      }
    }
    
    if (functionCall) {
      console.log('🔧 AI가 함수 호출 요청:', functionCall.name, functionCall.args);
      
      let functionResult;
      try {
        if (functionCall.name === 'search_places') {
          const { query, location = '서울', radius = 5000 } = functionCall.args;
          functionResult = await searchPlaces(query, location, radius);
        } else {
          functionResult = { status: 'error', message: '지원하지 않는 함수입니다.' };
        }
      } catch (error) {
        functionResult = { status: 'error', message: error.message };
      }

      // 검색 실패로 인한 리다이렉트인 경우 바로 응답 반환
      if (functionResult && functionResult.status === 'redirect_to_search') {
        console.log('🔄 Recommend-places 결과: 검색 기반 장소 탭으로 안내');
        return res.json({
          success: true,
          data: {
            recommendations: {
              rawText: functionResult.message,
              places: []
            },
            redirectInfo: functionResult.redirectInfo,
            note: '검색 기반 장소 서비스를 이용해주세요.'
          }
        });
      }

      // 함수 결과를 AI에게 다시 전달
      requestBody = {
        contents: [
          {
            parts: [{ text: `${systemPrompt}\n\n사용자 요청: ${message}` }],
            role: 'user'
          },
          {
            parts: [{ functionCall: functionCall }],
            role: 'model'
          },
          {
            parts: [{
              functionResponse: {
                name: functionCall.name,
                response: functionResult
              }
            }],
            role: 'function'
          }
        ],
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.8,
          maxOutputTokens: 1500
        }
      };

      // API 사용량 추적 - Function Call 후 추가 요청
      trackApiUsage('recommend', sessionId);
      
      response = await axios.post(
        `${GEMINI_API_URL}?key=${currentApiKey}`,
        requestBody,
        {
          headers: { 'Content-Type': 'application/json' }
        }
      );
      candidate = response.data.candidates[0];
    }

    // 최종 응답 처리
    let aiResponse = '';
    for (const part of candidate.content?.parts || []) {
      if (part.text) {
        aiResponse += part.text;
      }
    }

    if (!aiResponse) {
      aiResponse = '죄송합니다. 장소 추천을 생성할 수 없습니다.';
    }

    // 로그인 사용자의 경우 사용 횟수 증가
    if (!isGuest && user) {
      try {
        await user.incrementAIRecommendationUsage();
        console.log('✅ AI 추천 사용 횟수 증가:', user.analytics.aiRecommendationUsage);
      } catch (error) {
        console.error('⚠️ AI 추천 사용 횟수 증가 실패:', error);
      }
    }

    // AI 질의 로깅
    try {
      const userInfo = await extractUserInfo(req);
      const category = categorizeQuery(message, 'place_recommendation');
      
      await logAIQuery({
        userId: userInfo.userId,
        userType: userInfo.userType,
        sessionId: sessionId,
        query: message,
        queryType: 'place_recommendation',
        context: {
          preferences: preferences,
          location: preferences.location,
          budget: preferences.budget,
          purpose: preferences.purpose,
          category: preferences.category
        },
        response: aiResponse,
        responseTime: Date.now() - (req.startTime || Date.now()),
        aiModel: AVAILABLE_MODELS[CURRENT_MODEL],
        success: true,
        category: category,
        tags: [
          'place_recommendation',
          'structured_preferences',
          preferences.category || 'general'
        ],
        ipAddress: req.ip || req.connection.remoteAddress,
        userAgent: req.get('User-Agent')
      });
    } catch (loggingError) {
      console.error('⚠️ AI 질의 로깅 실패:', loggingError);
    }

    // 응답 형식을 기존 프론트엔드와 호환되도록 변환
    res.json({
      success: true,
      data: {
        recommendations: {
          rawText: aiResponse,
          places: [] // 실제 파싱 로직은 프론트엔드에서 처리
        },
        note: '실제 장소 검색 결과를 바탕으로 추천되었습니다.',
        usageInfo: !isGuest && user ? {
          used: user.analytics.aiRecommendationUsage,
          remaining: user.canUseAIRecommendation().remaining
        } : null
      }
    });

  } catch (error) {
    console.error('AI 장소 추천 에러:', error.response?.data || error.message);

    // 에러 상황 AI 질의 로깅
    try {
      const userInfo = await extractUserInfo(req);
      const category = categorizeQuery(message || '', 'place_recommendation');
      
      await logAIQuery({
        userId: userInfo.userId,
        userType: userInfo.userType,
        sessionId: req.headers['x-session-id'] || req.ip || 'unknown',
        query: message || '',
        queryType: 'place_recommendation',
        context: preferences || {},
        response: `에러 발생: ${error.message}`,
        responseTime: Date.now() - (req.startTime || Date.now()),
        aiModel: AVAILABLE_MODELS[CURRENT_MODEL],
        success: false,
        errorMessage: error.message,
        category: category,
        tags: ['error', 'place_recommendation', error.response?.status?.toString() || 'unknown_error'],
        ipAddress: req.ip || req.connection.remoteAddress,
        userAgent: req.get('User-Agent')
      });
    } catch (loggingError) {
      console.error('⚠️ 에러 상황 AI 질의 로깅 실패:', loggingError);
    }
    
    // 503 (Service Unavailable) 에러 처리 - Gemini 모델 과부하
    if (error.response?.status === 503) {
      const errorMessage = error.response.data?.error?.message || '';
      
      if (errorMessage.includes('overloaded') || errorMessage.includes('unavailable')) {
        return res.status(503).json({
          success: false,
          message: '🤖 AI 서비스가 현재 과부하 상태입니다. 잠시 후 다시 시도해주세요.',
          retryAfter: 30, // 30초 후 재시도 권장
          fallbackAction: '검색 기반 장소 탭을 이용해보세요.'
        });
      }
      
      return res.status(503).json({
        success: false,
        message: '🛠️ AI 서비스에 일시적인 문제가 발생했습니다. 잠시 후 다시 시도해주세요.'
      });
    }
    
    // Timeout 에러 처리
    if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
      return res.status(503).json({
        success: false,
        message: '⏰ AI 서비스 응답 시간이 초과되었습니다. 잠시 후 다시 시도해주세요.'
      });
    }
    
    // 429 (Rate Limit) 에러 처리
    if (error.response?.status === 429) {
      const errorDetails = error.response.data?.error || {};
      const retryAfter = error.response.headers?.['retry-after'] || 60;
      
      console.error('❌ AI 장소 추천 - Rate Limit 초과:', {
        model: AVAILABLE_MODELS[CURRENT_MODEL],
        errorDetails,
        retryAfter
      });
      
      const apiUsageInfo = getApiUsageInfo();
      
      return res.status(429).json({
        success: false,
        message: '🚦 AI API 사용량 한도를 초과했습니다.',
        details: {
          reason: 'API Rate Limit 초과',
          retryAfter: parseInt(retryAfter),
          currentModel: AVAILABLE_MODELS[CURRENT_MODEL],
          apiUsage: {
            dailyTotal: apiUsageInfo.totalToday,
            percentage: apiUsageInfo.percentage,
            breakdown: apiUsageInfo.breakdown
          },
          suggestions: [
            `오늘 ${apiUsageInfo.totalToday}/100회 사용 (${apiUsageInfo.percentage}%)`,
            '1-2분 후 다시 시도해주세요',
            '검색 기반 장소 탭을 이용해보세요',
            '프리미엄 업그레이드 시 더 높은 한도를 이용할 수 있습니다'
          ]
        },
        fallbackAction: '검색 기반 장소 탭을 이용해보세요.'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'AI 장소 추천 서비스에 일시적인 문제가 발생했습니다.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});



// 장소 검증 API 엔드포인트
router.post('/verify-places', async (req, res) => {
  try {
    const { places, userMessage } = req.body;
    
    if (!places || !Array.isArray(places)) {
      return res.status(400).json({
        success: false,
        message: '장소 목록이 필요합니다.'
      });
    }
    
    // 사용자 메시지에서 자동으로 지역 추출
    let location_context = '서울'; // 기본값
    if (userMessage) {
      const extractedInfo = extractKeywords(userMessage);
      location_context = extractedInfo.location || '서울';
      console.log(`🎯 메시지에서 추출된 지역: "${location_context}" (원본: "${userMessage}")`);
    }
    
    console.log(`🔍 ${places.length}개 장소 검증 시작... (지역: ${location_context})`);
    
    const verifiedPlaces = [];
    
    for (const place of places) {
      const verifiedPlace = await verifyPlaceExists(place.name, location_context);
      
      if (verifiedPlace) {
        // 원본 정보와 검증된 정보 병합
        verifiedPlaces.push({
          ...place,
          ...verifiedPlace,
          originalName: place.name,
          verified: true
        });
        console.log(`✅ 검증 성공: ${place.name} → ${verifiedPlace.name}`);
      } else {
        console.log(`❌ 검증 실패: ${place.name} (존재하지 않는 장소)`);
      }
    }
    
    console.log(`📍 검증 완료: ${verifiedPlaces.length}/${places.length}개 장소가 실제로 존재함`);
    
    res.json({
      success: true,
      verifiedPlaces: verifiedPlaces,
      totalRequested: places.length,
      totalVerified: verifiedPlaces.length,
      extractedLocation: location_context // 클라이언트에서 확인할 수 있도록
    });
    
  } catch (error) {
    console.error('장소 검증 중 오류:', error);
    res.status(500).json({
      success: false,
      message: '장소 검증 중 오류가 발생했습니다.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// 사용량 상태 확인 엔드포인트
router.get('/usage-status', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: '사용자를 찾을 수 없습니다.'
      });
    }
    
    const usageStatus = user.canUseAIRecommendation();
    
    // API 사용량 정보 추가
    const apiUsageInfo = getApiUsageInfo();
    
    res.json({
      success: true,
      data: {
        usage: user.analytics.aiRecommendationUsage,
        limit: usageStatus.limit,
        remaining: usageStatus.remaining,
        canUse: usageStatus.canUse,
        isPremium: user.subscription.plan !== 'free',
        currentModel: AVAILABLE_MODELS[CURRENT_MODEL],
        apiUsage: {
          dailyTotal: apiUsageInfo.totalToday,
          dailyRemaining: apiUsageInfo.remaining,
          percentage: apiUsageInfo.percentage,
          breakdown: apiUsageInfo.breakdown,
          activeSessions: apiUsageInfo.activeSessions,
          isNearLimit: apiUsageInfo.isNearLimit
        },
        suggestions: user.analytics.aiRecommendationUsage >= 50 || apiUsageInfo.isNearLimit ? [
          ...(user.analytics.aiRecommendationUsage >= 50 ? ['사용자 한도가 높습니다'] : []),
          ...(apiUsageInfo.isNearLimit ? ['일일 API 한도에 근접했습니다'] : []),
          '1-2분 간격으로 요청해주세요',
          '검색 기반 장소 탭을 활용해보세요'
        ] : []
      }
    });
    
  } catch (error) {
    console.error('사용량 상태 확인 오류:', error);
    res.status(500).json({
      success: false,
      message: '사용량 상태 확인 중 오류가 발생했습니다.'
    });
  }
});

// API 사용량 전용 조회 엔드포인트 (인증 불필요)
router.get('/api-usage', (req, res) => {
  try {
    const apiUsageInfo = getApiUsageInfo();
    
    res.json({
      success: true,
      data: {
        date: new Date().toDateString(),
        dailyTotal: apiUsageInfo.totalToday,
        dailyRemaining: apiUsageInfo.remaining,
        dailyLimit: apiUsageInfo.apiKeyRotation.maxDailyCapacity,
        percentage: apiUsageInfo.percentage,
        breakdown: apiUsageInfo.breakdown,
        activeSessions: apiUsageInfo.activeSessions,
        isNearLimit: apiUsageInfo.isNearLimit,
        currentModel: AVAILABLE_MODELS[CURRENT_MODEL],
        
        // API 키 로테이션 정보
        apiKeyRotation: apiUsageInfo.apiKeyRotation,
        
        warnings: apiUsageInfo.isNearLimit || apiUsageInfo.apiKeyRotation.allKeysExhausted ? [
          ...(apiUsageInfo.apiKeyRotation.allKeysExhausted ? ['모든 API 키가 한도를 초과했습니다'] : []),
          ...(apiUsageInfo.isNearLimit ? ['사용 가능한 API 키가 부족합니다'] : []),
          '요청 간격을 늘려주세요',
          '검색 기반 장소 탭을 활용해보세요'
        ] : [],
        
        status: apiUsageInfo.percentage >= 100 ? 'exceeded' : 
                apiUsageInfo.percentage >= 80 ? 'warning' : 'normal'
      }
    });
    
  } catch (error) {
    console.error('API 사용량 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: 'API 사용량 조회 중 오류가 발생했습니다.'
    });
  }
});

// 개발환경 전용: 사용량 초기화 엔드포인트
router.post('/reset-usage', auth, async (req, res) => {
  try {
    // 개발 환경에서만 허용
    if (process.env.NODE_ENV !== 'development') {
      return res.status(403).json({
        success: false,
        message: '이 기능은 개발 환경에서만 사용할 수 있습니다.'
      });
    }
    
    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: '사용자를 찾을 수 없습니다.'
      });
    }
    
    const oldUsage = user.analytics.aiRecommendationUsage;
    
    // 사용량 초기화
    user.analytics.aiRecommendationUsage = 0;
    user.analytics.lastAIRecommendationDate = new Date();
    await user.save();
    
    console.log(`🔄 사용량 초기화: ${oldUsage} → 0 (사용자: ${user.email})`);
    
    res.json({
      success: true,
      message: '사용량이 초기화되었습니다.',
      data: {
        oldUsage,
        newUsage: 0,
        canUse: true
      }
    });
    
  } catch (error) {
    console.error('사용량 초기화 오류:', error);
    res.status(500).json({
      success: false,
      message: '사용량 초기화 중 오류가 발생했습니다.'
    });
  }
});

// 개발환경 전용: API 사용량 카운터 초기화 엔드포인트
router.post('/reset-api-usage', async (req, res) => {
  try {
    // 개발 환경에서만 허용
    if (process.env.NODE_ENV !== 'development') {
      return res.status(403).json({
        success: false,
        message: '이 기능은 개발 환경에서만 사용할 수 있습니다.'
      });
    }
    
    const oldUsage = { ...dailyApiUsage };
    
    // API 사용량 카운터 초기화
    dailyApiUsage = {
      count: 0,
      date: new Date().toDateString(),
      sessions: new Map(),
      breakdown: {
        chat: 0,
        initial: 0,
        final: 0,
        fallback: 0,
        recommend: 0
      }
    };
    
    console.log(`🔄 API 사용량 카운터 초기화: ${oldUsage.count} → 0`);
    
    res.json({
      success: true,
      message: 'API 사용량 카운터가 초기화되었습니다.',
      data: {
        oldUsage: {
          count: oldUsage.count,
          breakdown: oldUsage.breakdown
        },
        newUsage: {
          count: 0,
          breakdown: dailyApiUsage.breakdown
        }
      }
    });
    
  } catch (error) {
    console.error('API 사용량 초기화 오류:', error);
    res.status(500).json({
      success: false,
      message: 'API 사용량 초기화 중 오류가 발생했습니다.'
    });
  }
});

// API 키 로테이션 상태 확인 엔드포인트
router.get('/api-key-status', (req, res) => {
  try {
    const rotationInfo = getApiKeyRotationInfo();
    
    res.json({
      success: true,
      data: {
        ...rotationInfo,
        status: rotationInfo.allKeysExhausted ? 'all_exhausted' : 
                rotationInfo.availableKeys <= 1 ? 'critical' : 
                rotationInfo.availableKeys <= Math.ceil(rotationInfo.totalKeys * 0.3) ? 'warning' : 'normal',
        recommendations: rotationInfo.allKeysExhausted ? [
          '모든 API 키가 한도에 도달했습니다',
          '내일 다시 시도해주세요',
          '추가 API 키 발급을 고려해보세요'
        ] : rotationInfo.availableKeys <= 1 ? [
          '마지막 사용 가능한 API 키입니다',
          '추가 API 키 준비를 권장합니다',
          '사용량을 제한하여 키를 보존하세요'
        ] : []
      }
    });
    
  } catch (error) {
    console.error('API 키 상태 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: 'API 키 상태 조회 중 오류가 발생했습니다.'
    });
  }
});

module.exports = router; 
