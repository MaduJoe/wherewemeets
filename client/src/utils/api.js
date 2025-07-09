import axios from 'axios';

// API Base URL 설정 (강제 Railway 사용)
const API_BASE_URL = window.location.hostname === 'localhost' 
  ? 'http://localhost:5000'
  : 'https://wherewemeets-production.up.railway.app';

// Axios 인스턴스 생성
const api = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  timeout: 15000, // 15초로 증가 (투표 요청 안정성 향상)
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  }
});

// 디버깅: API 설정 확인
console.log('🚀 API 설정 확인:', {
  hostname: window.location.hostname,
  API_BASE_URL,
  fullBaseURL: `${API_BASE_URL}/api`,
  NODE_ENV: process.env.NODE_ENV
});

// 요청 인터셉터
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// 응답 인터셉터
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // 토큰만 제거하고 게스트 모드 유지 (강제 리다이렉트 제거)
      localStorage.removeItem('token');
      console.log('401 에러 발생 - 토큰 제거됨, 게스트 모드 유지');
      // window.location.href = '/login'; // 이kakao 라인을 제거!
    }
    return Promise.reject(error);
  }
);

// 감성 키워드 기반 장소 검색 API
export const searchPlacesBySentiment = async (params) => {
  try {
    const response = await api.get('/places/search/sentiment', { params });
    return response.data;
  } catch (error) {
    console.error('감성 키워드 기반 장소 검색 실패:', error);
    throw error;
  }
};

// 감성 키워드 추출 API (테스트/디버깅용)
export const extractSentimentKeywords = async (text) => {
  try {
    const response = await api.post('/places/sentiment/extract', { text });
    return response.data;
  } catch (error) {
    console.error('감성 키워드 추출 실패:', error);
    throw error;
  }
};

// 기존 장소 검색 API (기존 기능 유지)
export const searchPlaces = async (params) => {
  try {
    const response = await api.get('/places/search', { params });
    return response.data;
  } catch (error) {
    console.error('장소 검색 실패:', error);
    throw error;
  }
};

// 카테고리별 장소 검색 API
export const searchPlacesByCategory = async (categoryCode, params) => {
  try {
    const response = await api.get(`/places/category/${categoryCode}`, { params });
    return response.data;
  } catch (error) {
    console.error('카테고리별 장소 검색 실패:', error);
    throw error;
  }
};

// AI 질의 로깅 API
export const logAIQuery = async (queryData) => {
  try {
    const response = await api.post('/ai-query-logs/log', queryData);
    return response.data;
  } catch (error) {
    console.error('AI 질의 로깅 실패:', error);
    // 로깅 실패가 서비스에 영향을 주지 않도록 에러를 던지지 않음
    return null;
  }
};

// AI 질의 피드백 업데이트 API
export const updateAIQueryFeedback = async (logId, feedback) => {
  try {
    const response = await api.patch(`/ai-query-logs/feedback/${logId}`, feedback);
    return response.data;
  } catch (error) {
    console.error('AI 질의 피드백 업데이트 실패:', error);
    throw error;
  }
};

// 관리자용 AI 질의 로그 조회 API
export const getAIQueryLogs = async (params = {}) => {
  try {
    const response = await api.get('/ai-query-logs/admin/logs', { params });
    return response.data;
  } catch (error) {
    console.error('AI 질의 로그 조회 실패:', error);
    throw error;
  }
};

// 관리자용 AI 질의 통계 조회 API
export const getAIQueryStats = async (params = {}) => {
  try {
    const response = await api.get('/ai-query-logs/admin/stats', { params });
    return response.data;
  } catch (error) {
    console.error('AI 질의 통계 조회 실패:', error);
    throw error;
  }
};

// 관리자용 자주 묻는 질문 분석 API
export const getFrequentQueries = async (params = {}) => {
  try {
    const response = await api.get('/ai-query-logs/admin/frequent-queries', { params });
    return response.data;
  } catch (error) {
    console.error('자주 묻는 질문 분석 실패:', error);
    throw error;
  }
};

export default api; 