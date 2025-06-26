/**
 * 날짜 및 시간 관련 유틸리티 함수들
 * UTC로 저장된 날짜를 한국시간으로 표시
 */

// 기본 한국어 날짜 포맷 (년월일 시분)
export const formatDate = (dateString) => {
  if (!dateString) return '';
  
  const date = new Date(dateString);
  return date.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true // 오전/오후 표시
  });
};

// 간단한 날짜 포맷 (월일 시분)
export const formatDateShort = (dateString) => {
  if (!dateString) return '';
  
  const date = new Date(dateString);
  return date.toLocaleDateString('ko-KR', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
};

// 상대 시간 표시 (방금 전, 5분 전, 1시간 전 등)
export const formatRelativeTime = (dateString) => {
  if (!dateString) return '';
  
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now - date) / 1000);
  
  if (diffInSeconds < 60) {
    return '방금 전';
  }
  
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) {
    return `${diffInMinutes}분 전`;
  }
  
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    return `${diffInHours}시간 전`;
  }
  
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) {
    return `${diffInDays}일 전`;
  }
  
  // 일주일 이상이면 정확한 날짜 표시
  return formatDate(dateString);
};

// 날짜만 표시 (년월일)
export const formatDateOnly = (dateString) => {
  if (!dateString) return '';
  
  const date = new Date(dateString);
  return date.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};

// 시간만 표시 (시분)
export const formatTimeOnly = (dateString) => {
  if (!dateString) return '';
  
  const date = new Date(dateString);
  return date.toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
};

// 로그인 기록용 상세 포맷
export const formatLoginTime = (dateString) => {
  if (!dateString) return '';
  
  const date = new Date(dateString);
  return date.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false // 24시간 형식
  });
};

// 투표 시간용 포맷 (간단)
export const formatVoteTime = (dateString) => {
  if (!dateString) return '방금 전';
  
  // 다양한 날짜 형식 처리 (MongoDB ObjectId timestamp, ISO string 등)
  let date;
  try {
    // MongoDB ObjectId에서 추출된 timestamp인 경우
    if (typeof dateString === 'object' && dateString.$date) {
      date = new Date(dateString.$date);
    } 
    // ISO string이나 timestamp인 경우
    else {
      date = new Date(dateString);
    }
    
    // 유효하지 않은 날짜인 경우 현재 시간 사용
    if (isNaN(date.getTime())) {
      console.warn('Invalid date string:', dateString);
      return '방금 전';
    }
    
    const now = new Date();
    const diffInMillis = now - date;
    
    // 음수인 경우 (미래 시간) 방금 전으로 표시
    if (diffInMillis < 0) {
      return '방금 전';
    }
    
    const diffInMinutes = Math.floor(diffInMillis / (1000 * 60));
    const diffInHours = Math.floor(diffInMillis / (1000 * 60 * 60));
    
    if (diffInMinutes < 1) {
      return '방금 전';
    } else if (diffInMinutes < 60) {
      return `${diffInMinutes}분 전`;
    } else if (diffInHours < 24) {
      return `${diffInHours}시간 전`;
    } else {
      // 24시간 이상인 경우 간단한 시분 표시
      return date.toLocaleTimeString('ko-KR', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    }
  } catch (error) {
    console.error('Date formatting error:', error, 'dateString:', dateString);
    return '방금 전';
  }
};

// 현재 한국시간 (디버깅용)
export const getCurrentKoreanTime = () => {
  return new Date().toLocaleString('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
};

// UTC 시간을 명시적으로 한국시간으로 변환 (필요시)
export const utcToKorean = (utcDateString) => {
  if (!utcDateString) return '';
  
  const utcDate = new Date(utcDateString);
  return utcDate.toLocaleString('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
};

export default {
  formatDate,
  formatDateShort,
  formatRelativeTime,
  formatDateOnly,
  formatTimeOnly,
  formatLoginTime,
  formatVoteTime,
  getCurrentKoreanTime,
  utcToKorean
}; 