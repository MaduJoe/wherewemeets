// 장소 데이터 정리 유틸리티 함수들

/**
 * 장소명에서 전화번호, URL, 특수문자 등을 제거하여 깔끔하게 정리
 * @param {string} name - 원본 장소명
 * @returns {string} - 정리된 장소명
 */
export const cleanPlaceName = (name) => {
  if (!name || typeof name !== 'string') return '이름 없음';
  
  let cleaned = name.trim();
  
  // 카테고리 정보 제거 (가장 먼저 처리)
  // 예: "카페:", "맛집:", "레스토랑:", "커피전문점:" 등
  cleaned = cleaned.replace(/^(카페|맛집|레스토랑|커피전문점|음식점|디저트|브런치|술집|바|펜션|호텔|모텔|노래방|볼링장|영화관|공원|마트|백화점|쇼핑몰)\s*:\s*/i, '');
  
  // 전화번호 패턴 제거 (한국 전화번호 형식)
  // 예: 02-1234-5678, 010-1234-5678, 031-123-4567, 1588-1234 등
  cleaned = cleaned.replace(/\b\d{2,4}-\d{3,4}-\d{4}\b/g, '');
  cleaned = cleaned.replace(/\b\d{3}-\d{4}-\d{4}\b/g, '');
  cleaned = cleaned.replace(/\b\d{4}-\d{4}\b/g, '');
  
  // URL 패턴 제거
  cleaned = cleaned.replace(/https?:\/\/[^\s]+/g, '');
  cleaned = cleaned.replace(/www\.[^\s]+/g, '');
  
  // 괄호 안의 전화번호나 기타 정보 제거
  cleaned = cleaned.replace(/\([^)]*\d{3,4}[^)]*\)/g, '');
  
  // 카테고리 정보가 뒤에 있는 경우도 제거
  // 예: "스타벅스 (카페)", "맥도날드 맛집" 등
  cleaned = cleaned.replace(/\s+(카페|맛집|레스토랑|커피전문점|음식점|디저트|브런치|술집|바|펜션|호텔|모텔|노래방|볼링장|영화관|공원|마트|백화점|쇼핑몰)$/i, '');
  cleaned = cleaned.replace(/\s*\((카페|맛집|레스토랑|커피전문점|음식점|디저트|브런치|술집|바|펜션|호텔|모텔|노래방|볼링장|영화관|공원|마트|백화점|쇼핑몰)\)$/i, '');
  
  // 연속된 공백, 특수문자 정리
  cleaned = cleaned.replace(/\s+/g, ' ');
  cleaned = cleaned.replace(/[^\w\s가-힣.,\-]/g, '');
  
  // 앞뒤 공백 및 특수문자 제거
  cleaned = cleaned.trim();
  
  return cleaned || '이름 없음';
};

/**
 * 주소에서 불필요한 정보를 제거하여 깔끔하게 정리
 * @param {string} address - 원본 주소
 * @returns {string} - 정리된 주소
 */
export const cleanPlaceAddress = (address) => {
  if (!address || typeof address !== 'string') return '주소 정보 없음';
  
  let cleaned = address.trim();
  
  // 전화번호 제거
  cleaned = cleaned.replace(/\b\d{2,4}-\d{3,4}-\d{4}\b/g, '');
  cleaned = cleaned.replace(/\b\d{3}-\d{4}-\d{4}\b/g, '');
  
  // URL 제거
  cleaned = cleaned.replace(/https?:\/\/[^\s]+/g, '');
  
  // 연속된 공백 정리
  cleaned = cleaned.replace(/\s+/g, ' ');
  
  return cleaned.trim() || '주소 정보 없음';
};

/**
 * 장소 데이터 전체를 정리하는 함수
 * @param {Object} place - 원본 장소 데이터
 * @returns {Object} - 정리된 장소 데이터
 */
export const cleanPlaceData = (place) => {
  if (!place) return null;
  
  return {
    ...place,
    name: cleanPlaceName(place.name),
    address: cleanPlaceAddress(place.address || place.roadAddress),
    // 전화번호는 별도 필드로 유지 (표시는 하되 장소명에서는 제거)
    phone: place.phone || null,
    // URL도 별도 필드로 유지
    url: place.url || null
  };
};

/**
 * 장소 배열을 일괄 정리하는 함수
 * @param {Array} places - 원본 장소 배열
 * @returns {Array} - 정리된 장소 배열
 */
export const cleanPlacesArray = (places) => {
  if (!Array.isArray(places)) return [];
  
  return places.map(place => cleanPlaceData(place)).filter(place => place !== null);
};

/**
 * AI 응답에서 URL 텍스트를 제거하고 사용자 친화적으로 변환
 * @param {string} response - AI 응답 텍스트
 * @returns {string} - 정리된 응답 텍스트
 */
export const cleanAIResponse = (response) => {
  if (!response || typeof response !== 'string') return '';
  
  let cleaned = response;
  
  // ** 표기 제거 (bold 마크다운 문법)
  cleaned = cleaned.replace(/\*\*(.*?)\*\*/g, '$1');
  
  // 카카오맵 URL 패턴을 사용자 친화적 텍스트로 변환
  cleaned = cleaned.replace(/\[?https?:\/\/place\.map\.kakao\.com\/\d+\]?/g, '');
  cleaned = cleaned.replace(/\(https?:\/\/place\.map\.kakao\.com\/\d+\)/g, '');
  
  // 일반 URL 패턴 제거
  cleaned = cleaned.replace(/https?:\/\/[^\s\)]+/g, '');
  
  // 빈 괄호나 대괄호 제거
  cleaned = cleaned.replace(/\[\s*\]/g, '');
  cleaned = cleaned.replace(/\(\s*\)/g, '');
  
  // 연속된 공백 정리 (단, 줄바꿈은 보존)
  cleaned = cleaned.replace(/[ \t]+/g, ' ');
  
  // numbering마다 줄바꿈 추가 (예: 1. , 2. , 3. 등) - 문장 중간에 있는 경우
  cleaned = cleaned.replace(/([^\n])(\d+\.\s)/g, '$1\n\n$2');
  
  // 문장 시작 부분의 numbering 앞에도 줄바꿈 추가 (첫 번째 제외)
  cleaned = cleaned.replace(/^(\d+\.\s)/gm, '$1');
  
  // 연속된 줄바꿈 정리 (최대 2개까지만)
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
  
  // 문장 끝에 카카오맵 안내 추가 (URL이 제거된 경우)
  if (response.includes('kakao.com') && !cleaned.includes('카카오맵')) {
    cleaned += '\n\n📍 자세한 위치와 정보는 카카오맵에서 확인하실 수 있습니다.';
  }
  
  return cleaned.trim();
}; 