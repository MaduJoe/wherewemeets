import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import { 
  createOrRestoreGuestSession, 
  clearGuestSession, 
  getUserLevel, 
  getUserPermissions, 
  migrateGuestToMember,
  initializeGuestSystem,
  USER_LEVELS
} from '../utils/sessionUtils';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://wherewemeets-production.up.railway.app/api';

// API Base URL 설정 (api.js와 동일한 로직)
const API_BASE_URL = window.location.hostname === 'localhost' 
  ? 'http://localhost:5000/api'
  : 'https://wherewemeets-production.up.railway.app/api';

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [userLevel, setUserLevel] = useState(USER_LEVELS.GUEST);
  const [userPermissions, setUserPermissions] = useState({});
  const [guestSession, setGuestSession] = useState(null);
  const [userAnalytics, setUserAnalytics] = useState({
    visitCount: 0,
    featuresUsed: [],
    lastVisit: null
  });

  const createGuestSession = useCallback(() => {
    const session = createOrRestoreGuestSession();
    setGuestSession(session);
    
    const guestUser = {
      id: session.id,
      name: session.isRestored ? '게스트 사용자' : '게스트 사용자',
      email: '',
      subscription: 'guest', // 명확한 구분을 위해 'guest'로 설정
      isGuest: true,
      sessionExpiresAt: session.expiresAt,
      createdAt: new Date(session.createdAt).toISOString()
    };
    
    setUser(guestUser);
    setIsAuthenticated(false);
    
    if (session.isRestored) {
      console.log('게스트 세션 복원:', session.id);
    } else {
      console.log('새 게스트 세션 생성:', session.id);
    }
  }, []);

  const authenticateWithToken = useCallback(async (token) => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(`${API_BASE_URL}/auth/me`, {
        headers: {
          'Authorization': `Bearer ${token}`
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
        setIsAuthenticated(true);
        console.log('사용자 인증 성공:', data.user);
      } else {
        // 토큰이 유효하지 않으면 제거하고 게스트 모드
        localStorage.removeItem('token');
        createGuestSession();
      }
    } catch (error) {
      console.error('토큰 인증 실패:', error);
      localStorage.removeItem('token');
      createGuestSession();
    }
  }, [createGuestSession]);

  const initializeSystem = useCallback(async () => {
    try {
      setLoading(true);
      
      // 시스템 초기화 (만료된 게스트 데이터 정리)
      initializeGuestSystem();
      
      const token = localStorage.getItem('token');
      if (token) {
        // 토큰이 있으면 사용자 정보 조회
        await authenticateWithToken(token);
      } else {
        // 토큰이 없으면 게스트 세션 생성
        createGuestSession();
      }
    } catch (error) {
      console.error('시스템 초기화 에러:', error);
      createGuestSession();
    } finally {
      setLoading(false);
    }
  }, [authenticateWithToken, createGuestSession]);

  const updateAnalytics = useCallback(() => {
    const stored = localStorage.getItem('userAnalytics');
    if (stored) {
      const analytics = JSON.parse(stored);
      setUserAnalytics(analytics);
    }

    // 방문 카운트 업데이트
    const visitCount = parseInt(localStorage.getItem('visitCount')) || 0;
    const newVisitCount = visitCount + 1;
    localStorage.setItem('visitCount', newVisitCount.toString());
    
    setUserAnalytics(prev => ({
      ...prev,
      visitCount: newVisitCount,
      lastVisit: new Date().toISOString()
    }));
  }, []);

  useEffect(() => {
    initializeSystem();
    updateAnalytics();
  }, [initializeSystem, updateAnalytics]);

  // 사용자 레벨과 권한 업데이트
  useEffect(() => {
    const level = getUserLevel(user, isAuthenticated);
    const permissions = getUserPermissions(level);
    
    setUserLevel(level);
    setUserPermissions(permissions);
    
    console.log('사용자 레벨 업데이트:', level, permissions);
  }, [user, isAuthenticated]);

  const register = async (userData) => {
    try {
      setLoading(true);
      
      // 현재 게스트 ID 저장 (데이터 마이그레이션용)
      const currentGuestId = user?.isGuest ? user.id : null;
      
      const response = await fetch(`${API_BASE_URL}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(userData)
      });

      const data = await response.json();

      if (response.ok) {
        localStorage.setItem('token', data.token);
        setUser(data.user);
        setIsAuthenticated(true);
        
        // 게스트 데이터 마이그레이션
        if (currentGuestId) {
          migrateGuestToMember(currentGuestId, data.user.id);
          toast.success('게스트 데이터가 회원 계정으로 이전되었습니다!');
        }
        
        toast.success(data.message || '회원가입이 완료되었습니다!');
        return { success: true, user: data.user };
      } else {
        toast.error(data.message || '회원가입에 실패했습니다.');
        return { success: false, message: data.message };
      }
    } catch (error) {
      console.error('회원가입 에러:', error);
      toast.error('서버 오류가 발생했습니다.');
      return { success: false, message: '서버 오류가 발생했습니다.' };
    } finally {
      setLoading(false);
    }
  };

  const login = async (credentials) => {
    try {
      setLoading(true);
      
      // 현재 게스트 ID 저장 (데이터 마이그레이션용)
      const currentGuestId = user?.isGuest ? user.id : null;
      
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(credentials)
      });

      const data = await response.json();

      if (response.ok) {
        localStorage.setItem('token', data.token);
        setUser(data.user);
        setIsAuthenticated(true);
        
        // 게스트 데이터 마이그레이션
        if (currentGuestId) {
          migrateGuestToMember(currentGuestId, data.user.id);
          toast.success('게스트 데이터가 계정으로 이전되었습니다!');
        }
        
        toast.success(data.message || '로그인 성공!');
        return { success: true, user: data.user };
      } else {
        toast.error(data.message || '로그인에 실패했습니다.');
        return { success: false, message: data.message };
      }
    } catch (error) {
      console.error('로그인 에러:', error);
      toast.error('서버 오류가 발생했습니다.');
      return { success: false, message: '서버 오류가 발생했습니다.' };
    } finally {
      setLoading(false);
    }
  };

  const socialLogin = async (provider, socialData) => {
    try {
      setLoading(true);
      
      // 현재 게스트 ID 저장 (데이터 마이그레이션용)
      const currentGuestId = user?.isGuest ? user.id : null;
      
      const response = await fetch(`${API_BASE_URL}/auth/social-login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          provider,
          ...socialData
        })
      });

      const data = await response.json();

      if (response.ok) {
        localStorage.setItem('token', data.token);
        setUser(data.user);
        setIsAuthenticated(true);
        
        // 게스트 데이터 마이그레이션
        if (currentGuestId) {
          migrateGuestToMember(currentGuestId, data.user.id);
        }
        
        await trackFeatureUsage(`social_login_${provider}`);
        
        toast.success(data.message);
        return { success: true, user: data.user };
      } else {
        toast.error(data.message || '소셜 로그인에 실패했습니다.');
        return { success: false, message: data.message };
      }
    } catch (error) {
      console.error('소셜 로그인 에러:', error);
      toast.error('서버 오류가 발생했습니다.');
      return { success: false, message: '서버 오류가 발생했습니다.' };
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    setIsAuthenticated(false);
    
    // 게스트 세션 생성
    createGuestSession();
    
    toast.success('로그아웃되었습니다. 게스트 모드로 전환됩니다.');
  };

  // 게스트 세션 수동 초기화
  const resetGuestSession = () => {
    clearGuestSession();
    createGuestSession();
    toast.success('게스트 세션이 초기화되었습니다.');
  };

  // 게스트 세션 연장
  const extendGuestSession = () => {
    if (user?.isGuest) {
      const newSession = createOrRestoreGuestSession();
      setGuestSession(newSession);
      
      const updatedUser = {
        ...user,
        sessionExpiresAt: newSession.expiresAt
      };
      setUser(updatedUser);
      
      toast.success('게스트 세션이 연장되었습니다.');
    }
  };

  // 세션 만료 확인
  const checkSessionExpiry = () => {
    if (user?.isGuest && guestSession) {
      const timeUntilExpiry = guestSession.expiresAt - Date.now();
      if (timeUntilExpiry <= 0) {
        toast.error('게스트 세션이 만료되었습니다. 새로운 세션을 생성합니다.');
        resetGuestSession();
        return false;
      }
      return true;
    }
    return true;
  };

  const updateProfile = async (profileData) => {
    try {
      console.log('클라이언트: 프로필 업데이트 요청 데이터:', profileData);
      console.log('클라이언트: profileData.preferences:', profileData.preferences);
      console.log('클라이언트: profileData.preferences.notifications:', profileData.preferences?.notifications);
      
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/auth/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(profileData)
      });

      const data = await response.json();
      console.log('클라이언트: 서버 응답:', data);

      if (response.ok) {
        setUser(data.user);
        toast.success(data.message);
        return { success: true, user: data.user };
      } else {
        console.error('클라이언트: 프로필 업데이트 실패:', data);
        toast.error(data.message || '프로필 업데이트에 실패했습니다.');
        return { success: false, message: data.message };
      }
    } catch (error) {
      console.error('클라이언트: 프로필 업데이트 에러:', error);
      toast.error('서버 오류가 발생했습니다.');
      return { success: false, message: '서버 오류가 발생했습니다.' };
    }
  };

  const changePassword = async (passwordData) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/auth/password`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(passwordData)
      });

      const data = await response.json();

      if (response.ok) {
        toast.success(data.message);
        return { success: true };
      } else {
        toast.error(data.message || '비밀번호 변경에 실패했습니다.');
        return { success: false, message: data.message };
      }
    } catch (error) {
      console.error('비밀번호 변경 에러:', error);
      toast.error('서버 오류가 발생했습니다.');
      return { success: false, message: '서버 오류가 발생했습니다.' };
    }
  };

  const getDashboardData = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/auth/dashboard`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();

      if (response.ok) {
        return { success: true, data: data };
      } else {
        toast.error(data.message || '대시보드 데이터 로드에 실패했습니다.');
        return { success: false, message: data.message };
      }
    } catch (error) {
      console.error('대시보드 데이터 조회 에러:', error);
      toast.error('서버 오류가 발생했습니다.');
      return { success: false, message: '서버 오류가 발생했습니다.' };
    }
  };

  const trackFeatureUsage = async (featureName) => {
    try {
      // 로컬 분석 업데이트
      const currentFeatures = userAnalytics.featuresUsed || [];
      const existingFeature = currentFeatures.find(f => f.name === featureName);
      
      let updatedFeatures;
      if (existingFeature) {
        updatedFeatures = currentFeatures.map(f => 
          f.name === featureName 
            ? { ...f, count: f.count + 1, lastUsed: new Date().toISOString() }
            : f
        );
      } else {
        updatedFeatures = [...currentFeatures, {
          name: featureName,
          count: 1,
          lastUsed: new Date().toISOString()
        }];
      }

      const updatedAnalytics = {
        ...userAnalytics,
        featuresUsed: updatedFeatures
      };

      setUserAnalytics(updatedAnalytics);
      localStorage.setItem('userAnalytics', JSON.stringify(updatedAnalytics));

      // 백엔드에 추적 데이터 전송 (인증된 사용자만)
      if (isAuthenticated) {
        const token = localStorage.getItem('token');
        await fetch(`${API_BASE_URL}/auth/track-feature`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ featureName })
        });
      }
    } catch (error) {
      console.error('기능 사용 추적 에러:', error);
    }
  };

  const deleteAccount = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/auth/account`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();

      if (response.ok) {
        logout();
        toast.success(data.message);
        return { success: true };
      } else {
        toast.error(data.message || '계정 삭제에 실패했습니다.');
        return { success: false, message: data.message };
      }
    } catch (error) {
      console.error('계정 삭제 에러:', error);
      toast.error('서버 오류가 발생했습니다.');
      return { success: false, message: '서버 오류가 발생했습니다.' };
    }
  };

  const value = {
    user,
    isAuthenticated,
    loading,
    userLevel,
    userPermissions,
    guestSession,
    userAnalytics,
    register,
    login,
    socialLogin,
    logout,
    updateProfile,
    changePassword,
    getDashboardData,
    trackFeatureUsage,
    deleteAccount,
    resetGuestSession,
    extendGuestSession,
    checkSessionExpiry
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}; 