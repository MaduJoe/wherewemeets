// UUID 생성 함수
export const generateUUID = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

// 방 토큰 생성
export const generateRoomTokens = () => {
  const roomId = generateUUID();
  const hostToken = generateUUID();
  
  return {
    roomId,
    hostToken
  };
};

// 주최자 토큰 저장
export const saveHostToken = (roomId, hostToken) => {
  localStorage.setItem(`host_token_${roomId}`, hostToken);
};

// 주최자 토큰 확인
export const getHostToken = (roomId) => {
  return localStorage.getItem(`host_token_${roomId}`);
};

// URL에서 토큰 파라미터 추출
export const getTokenFromURL = () => {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('token');
};

// 주최자 여부 확인
export const isHost = (roomId) => {
  const urlToken = getTokenFromURL();
  const storedHostToken = getHostToken(roomId);
  
  console.log('isHost 확인:', {
    roomId,
    urlToken: urlToken ? `${urlToken.substring(0, 8)}...` : null,
    storedHostToken: storedHostToken ? `${storedHostToken.substring(0, 8)}...` : null,
    hasUrlToken: !!urlToken,
    hasStoredToken: !!storedHostToken,
    tokensMatch: urlToken === storedHostToken
  });
  
  // URL에 토큰이 있고, 저장된 토큰과 일치하면 주최자
  if (urlToken && storedHostToken && urlToken === storedHostToken) {
    console.log('주최자 확인: URL 토큰과 저장된 토큰 일치');
    return true;
  }
  
  // URL에 토큰이 없지만 저장된 토큰이 있으면 주최자 (직접 접속)
  if (!urlToken && storedHostToken) {
    console.log('주최자 확인: 저장된 토큰 존재 (직접 접속)');
    return true;
  }
  
  console.log('참여자로 확인');
  return false;
};

// 공유 링크 생성 (토큰 제외)
export const generateShareLink = (roomId) => {
  const baseUrl = window.location.origin;
  return `${baseUrl}/meeting-planner/${roomId}`;
};

// 주최자 링크 생성 (토큰 포함)
export const generateHostLink = (roomId, hostToken) => {
  const baseUrl = window.location.origin;
  return `${baseUrl}/meeting-planner/${roomId}?token=${hostToken}`;
}; 