import axios from 'axios';

// API Base URL 설정 (강제 Railway 사용)
const API_BASE_URL = window.location.hostname === 'localhost' 
  ? 'http://localhost:5000'
  : 'https://wherewemeets-production.up.railway.app';

// Axios 인스턴스 생성
const api = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  timeout: 10000,
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
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api; 