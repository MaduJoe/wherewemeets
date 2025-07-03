// 게스트 세션 관리 및 사용자 레벨 구분 유틸리티

const SESSION_KEYS = {
  GUEST_ID: 'guestUserId',
  GUEST_SESSION: 'guestSession',
  GUEST_AI_USAGE: 'guestAIUsage',
  GUEST_AI_USAGE_DATE: 'guestAIUsageDate',
  GUEST_CHAT_HISTORY: 'aiAssistant_chatHistory_',
  USER_LEVEL: 'userLevel'
};

const USER_LEVELS = {
  GUEST: 'guest',
  FREE: 'free', 
  PREMIUM: 'premium',
  PRO: 'pro'
};

const GUEST_LIMITS = {
  AI_RECOMMENDATIONS_PER_DAY: 3,
  SESSION_DURATION: 4 * 60 * 60 * 1000, // 4시간
  CHAT_HISTORY_MAX_DAYS: 1 // 1일
};

/**
 * 게스트 세션 생성 또는 복원
 */
export const createOrRestoreGuestSession = () => {
  const existingSession = localStorage.getItem(SESSION_KEYS.GUEST_SESSION);
  
  if (existingSession) {
    try {
      const session = JSON.parse(existingSession);
      const now = Date.now();
      
      // 세션이 만료되지 않았으면 복원
      if (session.expiresAt > now) {
        console.log('게스트 세션 복원:', session.id);
        return {
          id: session.id,
          createdAt: session.createdAt,
          expiresAt: session.expiresAt,
          isRestored: true
        };
      } else {
        // 만료된 세션 정리
        console.log('게스트 세션 만료 - 정리 중');
        clearGuestSession();
      }
    } catch (error) {
      console.error('게스트 세션 복원 실패:', error);
      clearGuestSession();
    }
  }
  
  // 새로운 세션 생성
  const newSession = {
    id: `guest-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    createdAt: Date.now(),
    expiresAt: Date.now() + GUEST_LIMITS.SESSION_DURATION,
    isRestored: false
  };
  
  localStorage.setItem(SESSION_KEYS.GUEST_SESSION, JSON.stringify(newSession));
  localStorage.setItem(SESSION_KEYS.GUEST_ID, newSession.id);
  
  console.log('새 게스트 세션 생성:', newSession.id);
  return newSession;
};

/**
 * 게스트 세션 정리
 */
export const clearGuestSession = () => {
  const guestId = localStorage.getItem(SESSION_KEYS.GUEST_ID);
  
  // 게스트 관련 모든 데이터 삭제
  localStorage.removeItem(SESSION_KEYS.GUEST_ID);
  localStorage.removeItem(SESSION_KEYS.GUEST_SESSION);
  localStorage.removeItem(SESSION_KEYS.GUEST_AI_USAGE);
  localStorage.removeItem(SESSION_KEYS.GUEST_AI_USAGE_DATE);
  
  // 게스트 채팅 히스토리 삭제
  if (guestId) {
    localStorage.removeItem(`${SESSION_KEYS.GUEST_CHAT_HISTORY}${guestId}`);
  }
  
  // 만료된 게스트 채팅 히스토리 전체 정리
  cleanupExpiredChatHistory();
  
  console.log('게스트 세션 정리 완료');
};

/**
 * 만료된 채팅 히스토리 정리
 */
export const cleanupExpiredChatHistory = () => {
  const keysToRemove = [];
  
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(SESSION_KEYS.GUEST_CHAT_HISTORY)) {
      // 게스트 채팅 히스토리인 경우 만료 확인
      try {
        const chatHistory = JSON.parse(localStorage.getItem(key));
        if (chatHistory && chatHistory.length > 0) {
          const lastMessage = chatHistory[chatHistory.length - 1];
          const lastMessageTime = new Date(lastMessage.timestamp).getTime();
          const expirationTime = GUEST_LIMITS.CHAT_HISTORY_MAX_DAYS * 24 * 60 * 60 * 1000;
          
          if (Date.now() - lastMessageTime > expirationTime) {
            keysToRemove.push(key);
          }
        }
      } catch (error) {
        // 파싱 실패 시 삭제 대상에 추가
        keysToRemove.push(key);
      }
    }
  }
  
  keysToRemove.forEach(key => {
    localStorage.removeItem(key);
    console.log('만료된 채팅 히스토리 삭제:', key);
  });
};

/**
 * 사용자 레벨 판단
 */
export const getUserLevel = (user, isAuthenticated) => {
  if (!user) return USER_LEVELS.GUEST;
  
  if (user.isGuest || !isAuthenticated) {
    return USER_LEVELS.GUEST;
  }
  
  switch (user.subscription) {
    case 'premium':
      return USER_LEVELS.PREMIUM;
    case 'pro':
      return USER_LEVELS.PRO;
    case 'free':
    default:
      return USER_LEVELS.FREE;
  }
};

/**
 * 사용자 레벨별 권한 확인
 */
export const getUserPermissions = (userLevel) => {
  switch (userLevel) {
    case USER_LEVELS.GUEST:
      return {
        canCreateMeeting: false,
        canUseAI: true,
        aiDailyLimit: 3,
        maxParticipants: 5,
        canAccessAnalytics: false,
        canManageMeetings: false,
        sessionDuration: GUEST_LIMITS.SESSION_DURATION
      };
    
    case USER_LEVELS.FREE:
      return {
        canCreateMeeting: true,
        canUseAI: true,
        aiDailyLimit: 5,
        maxParticipants: 10,
        canAccessAnalytics: false,
        canManageMeetings: false,
        monthlyMeetingLimit: 3
      };
    
    case USER_LEVELS.PREMIUM:
      return {
        canCreateMeeting: true,
        canUseAI: true,
        aiDailyLimit: -1, // 무제한
        maxParticipants: 20,
        canAccessAnalytics: true,
        canManageMeetings: true,
        monthlyMeetingLimit: -1 // 무제한
      };
    
    case USER_LEVELS.PRO:
      return {
        canCreateMeeting: true,
        canUseAI: true,
        aiDailyLimit: -1, // 무제한
        maxParticipants: -1, // 무제한
        canAccessAnalytics: true,
        canManageMeetings: true,
        monthlyMeetingLimit: -1, // 무제한
        prioritySupport: true
      };
    
    default:
      return getUserPermissions(USER_LEVELS.GUEST);
  }
};

/**
 * 게스트 AI 사용량 확인 및 관리
 */
export const checkGuestAIUsage = () => {
  const today = new Date().toDateString();
  const lastUsageDate = localStorage.getItem(SESSION_KEYS.GUEST_AI_USAGE_DATE);
  
  // 날짜가 바뀌었으면 사용량 리셋
  if (lastUsageDate !== today) {
    localStorage.setItem(SESSION_KEYS.GUEST_AI_USAGE_DATE, today);
    localStorage.setItem(SESSION_KEYS.GUEST_AI_USAGE, '0');
    return {
      used: 0,
      remaining: GUEST_LIMITS.AI_RECOMMENDATIONS_PER_DAY,
      canUse: true,
      resetDate: today
    };
  }
  
  const used = parseInt(localStorage.getItem(SESSION_KEYS.GUEST_AI_USAGE) || '0');
  const remaining = Math.max(0, GUEST_LIMITS.AI_RECOMMENDATIONS_PER_DAY - used);
  
  return {
    used,
    remaining,
    canUse: remaining > 0,
    limit: GUEST_LIMITS.AI_RECOMMENDATIONS_PER_DAY
  };
};

/**
 * 게스트 AI 사용량 증가
 */
export const incrementGuestAIUsage = () => {
  const usage = checkGuestAIUsage();
  if (usage.canUse) {
    const newUsage = usage.used + 1;
    localStorage.setItem(SESSION_KEYS.GUEST_AI_USAGE, newUsage.toString());
    return {
      ...usage,
      used: newUsage,
      remaining: Math.max(0, usage.remaining - 1),
      canUse: newUsage < GUEST_LIMITS.AI_RECOMMENDATIONS_PER_DAY
    };
  }
  return usage;
};

/**
 * 게스트에서 회원으로 전환 시 데이터 마이그레이션
 */
export const migrateGuestToMember = (guestId, newUserId) => {
  try {
    // 채팅 히스토리 마이그레이션
    const guestChatKey = `${SESSION_KEYS.GUEST_CHAT_HISTORY}${guestId}`;
    const memberChatKey = `${SESSION_KEYS.GUEST_CHAT_HISTORY}${newUserId}`;
    
    const guestChatHistory = localStorage.getItem(guestChatKey);
    if (guestChatHistory) {
      localStorage.setItem(memberChatKey, guestChatHistory);
      localStorage.removeItem(guestChatKey);
      console.log('채팅 히스토리 마이그레이션 완료:', guestId, '->', newUserId);
    }
    
    // 게스트 세션 정리
    clearGuestSession();
    
    return true;
  } catch (error) {
    console.error('게스트 데이터 마이그레이션 실패:', error);
    return false;
  }
};

/**
 * 세션 상태 확인
 */
export const validateGuestSession = () => {
  const session = localStorage.getItem(SESSION_KEYS.GUEST_SESSION);
  if (!session) return false;
  
  try {
    const sessionData = JSON.parse(session);
    return sessionData.expiresAt > Date.now();
  } catch (error) {
    console.error('세션 검증 실패:', error);
    return false;
  }
};

/**
 * 시스템 초기화 시 정리 작업
 */
export const initializeGuestSystem = () => {
  // 만료된 게스트 데이터 정리
  cleanupExpiredChatHistory();
  
  // 만료된 세션 정리
  if (!validateGuestSession()) {
    clearGuestSession();
  }
};

export {
  SESSION_KEYS,
  USER_LEVELS,
  GUEST_LIMITS
}; 