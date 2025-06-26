import React, { createContext, useContext, useState, useEffect } from 'react';
import toast from 'react-hot-toast';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
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
  const [userAnalytics, setUserAnalytics] = useState({
    visitCount: 0,
    featuresUsed: [],
    lastVisit: null
  });

  useEffect(() => {
    initializeAuth();
    updateAnalytics();
  }, []);

  const initializeAuth = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      if (token) {
        // 토큰 유효성 검증 및 사용자 정보 조회 (5초 타임아웃)
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        try {
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
          } else {
            // 토큰이 유효하지 않으면 로컬 스토리지에서 제거하고 게스트 모드로 전환
            localStorage.removeItem('token');
            createGuestUser();
          }
        } catch (fetchError) {
          clearTimeout(timeoutId);
          if (fetchError.name === 'AbortError') {
            console.warn('서버 연결 타임아웃 - 게스트 모드로 진행');
          } else {
            console.error('API 호출 에러:', fetchError);
          }
          // 네트워크 오류 시에도 토큰 제거하고 게스트 모드로 전환
          localStorage.removeItem('token');
          createGuestUser();
        }
      } else {
        // 토큰이 없으면 게스트 사용자 생성
        createGuestUser();
      }
    } catch (error) {
      console.error('인증 초기화 에러:', error);
      localStorage.removeItem('token');
      createGuestUser();
    } finally {
      setLoading(false);
    }
  };

  const updateAnalytics = () => {
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
  };

  const register = async (userData) => {
    try {
      setLoading(true);
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
        
        // 로그인 이력은 백엔드에서 처리하므로 클라이언트에서는 제거
        // await trackFeatureUsage('login');
        
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
    createGuestUser(); // 로그아웃 시 게스트 모드로 전환
    toast.success('로그아웃되었습니다. 게스트 모드로 전환됩니다.');
  };

  const updateProfile = async (profileData) => {
    try {
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

      if (response.ok) {
        setUser(data.user);
        toast.success(data.message);
        return { success: true, user: data.user };
      } else {
        toast.error(data.message || '프로필 업데이트에 실패했습니다.');
        return { success: false, message: data.message };
      }
    } catch (error) {
      console.error('프로필 업데이트 에러:', error);
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

  // 게스트 사용자 생성 (기존 호환성 유지)
  const createGuestUser = () => {
    // 기존 게스트 정보가 있는지 확인
    const existingGuestId = localStorage.getItem('guestUserId');
    const guestId = existingGuestId || 'guest-' + Date.now();
    
    if (!existingGuestId) {
      localStorage.setItem('guestUserId', guestId);
    }
    
    const guestUser = {
      id: guestId,
      name: '게스트 사용자',
      email: '',
      subscription: 'free',
      isGuest: true,
      createdAt: new Date().toISOString()
    };
    
    setUser(guestUser);
    setIsAuthenticated(false); // 게스트는 인증되지 않은 상태
    console.log('게스트 사용자 생성됨:', guestUser);
    return guestUser;
  };

  const value = {
    user,
    isAuthenticated,
    loading,
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
    createGuestUser
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}; 