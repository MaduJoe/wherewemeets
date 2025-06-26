const express = require('express');
const axios = require('axios');
const router = express.Router();

// Kakao API 키 (환경변수에서 가져오기)
const KAKAO_API_KEY = process.env.KAKAO_API_KEY || 'f562a71b13dcad881fee2b157d93121c';
const GOOGLE_API_KEY = process.env.GOOGLE_PLACES_API_KEY || 'YOUR_GOOGLE_API_KEY';

// Google Places API로 장소 상세 정보 및 리뷰 가져오기
const getGooglePlaceDetails = async (placeName, address) => {
  try {
    // 1단계: Place Search로 place_id 찾기
    const searchQuery = `${placeName} ${address}`;
    const searchUrl = 'https://maps.googleapis.com/maps/api/place/textsearch/json';
    
    const searchResponse = await axios.get(searchUrl, {
      params: {
        query: searchQuery,
        key: GOOGLE_API_KEY,
        language: 'ko'
      }
    });

    if (!searchResponse.data.results || searchResponse.data.results.length === 0) {
      return null;
    }

    const place = searchResponse.data.results[0];
    const placeId = place.place_id;

    // 2단계: Place Details로 리뷰 가져오기
    const detailsUrl = 'https://maps.googleapis.com/maps/api/place/details/json';
    
    const detailsResponse = await axios.get(detailsUrl, {
      params: {
        place_id: placeId,
        fields: 'rating,reviews,user_ratings_total,photos',
        key: GOOGLE_API_KEY,
        language: 'ko'
      }
    });

    const details = detailsResponse.data.result;
    
    // 리뷰 데이터 정리
    const reviews = (details.reviews || []).map(review => ({
      id: `google_${review.time}`,
      userId: review.author_name,
      rating: review.rating,
      comment: review.text,
      createdAt: new Date(review.time * 1000).toISOString(),
      source: 'google'
    }));

    return {
      rating: details.rating || 0,
      reviews: reviews,
      reviewCount: details.user_ratings_total || 0,
      photos: details.photos || []
    };

  } catch (error) {
    console.error('Google Places API 호출 실패:', error.response?.data || error.message);
    return null;
  }
};

// 테스트 엔드포인트
router.get('/test', (req, res) => {
  console.log('Places 테스트 엔드포인트 호출됨');
  res.json({
    success: true,
    message: 'Places API 정상 작동',
    kakaoApiKey: KAKAO_API_KEY ? '설정됨' : '설정안됨',
    googleApiKey: GOOGLE_API_KEY ? '설정됨' : '설정안됨'
  });
});

// Kakao REST API를 통한 장소 검색
router.get('/search', async (req, res) => {
  console.log('=== Places Search API 호출됨 ===');
  console.log('쿼리 파라미터:', req.query);
  console.log('KAKAO_API_KEY:', KAKAO_API_KEY ? '설정됨' : '설정안됨');
  
  try {
    const { query, category, size = 15 } = req.query;
    
    if (!query) {
      console.log('검색어가 없어서 400 에러 반환');
      return res.status(400).json({ 
        success: false, 
        message: '검색어가 필요합니다.' 
      });
    }

    console.log(`장소 검색 요청: ${query}`);
    console.log('실제 KAKAO_API_KEY:', KAKAO_API_KEY);
    console.log('헤더 Authorization:', `KakaoAK ${KAKAO_API_KEY}`);

    // Kakao Local API 호출
    const kakaoUrl = 'https://dapi.kakao.com/v2/local/search/keyword.json';
    const headers = {
      'Authorization': `KakaoAK ${KAKAO_API_KEY}`
    };
    const params = {
      query: query,
      size: Math.min(size, 15), // 최대 15개
      page: 1,
      sort: 'accuracy'
    };
    
    // category가 있을 때만 category_group_code 추가
    if (category && category.trim()) {
      params.category_group_code = category;
    }
    
    console.log('요청 URL:', kakaoUrl);
    console.log('요청 헤더:', headers);
    console.log('요청 파라미터:', params);

    const response = await axios.get(kakaoUrl, {
      headers: headers,
      params: params
    });

    // 장소명에서 전화번호나 불필요한 정보 제거하는 함수
    const cleanPlaceName = (name) => {
      if (!name) return '';
      let cleaned = name.trim();
      
      // 카테고리 정보 제거 (가장 먼저 처리)
      cleaned = cleaned.replace(/^(카페|맛집|레스토랑|커피전문점|음식점|디저트|브런치|술집|바|펜션|호텔|모텔|노래방|볼링장|영화관|공원|마트|백화점|쇼핑몰)\s*:\s*/i, '');
      
      // 전화번호 패턴 제거
      cleaned = cleaned.replace(/\b\d{2,4}-\d{3,4}-\d{4}\b/g, '');
      cleaned = cleaned.replace(/\b\d{3}-\d{4}-\d{4}\b/g, '');
      cleaned = cleaned.replace(/\b\d{4}-\d{4}\b/g, '');
      
      // 괄호 안의 전화번호나 기타 정보 제거
      cleaned = cleaned.replace(/\([^)]*\d{3,4}[^)]*\)/g, '');
      
      // 카테고리 정보가 뒤에 있는 경우도 제거
      cleaned = cleaned.replace(/\s+(카페|맛집|레스토랑|커피전문점|음식점|디저트|브런치|술집|바|펜션|호텔|모텔|노래방|볼링장|영화관|공원|마트|백화점|쇼핑몰)$/i, '');
      cleaned = cleaned.replace(/\s*\((카페|맛집|레스토랑|커피전문점|음식점|디저트|브런치|술집|바|펜션|호텔|모텔|노래방|볼링장|영화관|공원|마트|백화점|쇼핑몰)\)$/i, '');
      
      // 연속된 공백 정리
      cleaned = cleaned.replace(/\s+/g, ' ');
      cleaned = cleaned.trim();
      
      return cleaned || name; // 정리 결과가 비어있으면 원본 반환
    };

    // 응답 데이터 변환 (Google Places API 리뷰 통합)
    // 성능 최적화: 처음 5개 장소만 Google API 호출
    const places = await Promise.all(
      response.data.documents.slice(0, 5).map(async (place) => {
        const cleanedName = cleanPlaceName(place.place_name);
        
        // Google Places API로 리뷰 데이터 가져오기 (비동기)
        const googleData = await getGooglePlaceDetails(cleanedName, place.address_name);
        
        return {
          id: place.id,
          name: cleanedName,
          category: place.category_name.split(' > ').pop(), // 마지막 카테고리만
          address: place.address_name,
          roadAddress: place.road_address_name,
          coordinates: {
            x: parseFloat(place.x), // 경도
            y: parseFloat(place.y)  // 위도
          },
          phone: place.phone || null,
          rating: googleData?.rating || 0, // Google API에서 가져온 실제 평점
          reviews: googleData?.reviews || [], // Google API에서 가져온 실제 리뷰
          reviewCount: googleData?.reviewCount || 0,
          photos: googleData?.photos || [],
          url: place.place_url,
          distance: place.distance ? parseInt(place.distance) : null,
          source: 'kakao_google_hybrid' // 하이브리드 방식 표시
        };
      })
    );

    // 나머지 장소들은 Google API 없이 기본 데이터만
    const remainingPlaces = response.data.documents.slice(5).map(place => ({
      id: place.id,
      name: cleanPlaceName(place.place_name),
      category: place.category_name.split(' > ').pop(),
      address: place.address_name,
      roadAddress: place.road_address_name,
      coordinates: {
        x: parseFloat(place.x),
        y: parseFloat(place.y)
      },
      phone: place.phone || null,
      rating: 0,
      reviews: [],
      reviewCount: 0,
      photos: [],
      url: place.place_url,
      distance: place.distance ? parseInt(place.distance) : null,
      source: 'kakao_only'
    }));

    const allPlaces = [...places, ...remainingPlaces];

    console.log(`검색 결과: ${allPlaces.length}개 장소 찾음 (상위 ${places.length}개 Google 리뷰 통합 완료)`);

    res.json({
      success: true,
      places: allPlaces,
      meta: {
        total_count: response.data.meta.total_count,
        pageable_count: response.data.meta.pageable_count,
        is_end: response.data.meta.is_end
      }
    });

  } catch (error) {
    console.error('장소 검색 실패:', error.response?.data || error.message);
    
    // API 키 관련 에러 처리
    if (error.response?.status === 401) {
      return res.status(401).json({
        success: false,
        message: 'Kakao API 키가 올바르지 않습니다.'
      });
    }
    
    // API 할당량 초과 에러 처리
    if (error.response?.status === 429) {
      return res.status(429).json({
        success: false,
        message: 'API 호출 한도를 초과했습니다. 잠시 후 다시 시도해주세요.'
      });
    }

    res.status(500).json({
      success: false,
      message: '장소 검색 중 오류가 발생했습니다.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// 카테고리별 장소 검색
router.get('/category/:categoryCode', async (req, res) => {
  try {
    const { categoryCode } = req.params;
    const { x, y, radius = 1000, size = 15 } = req.query;

    if (!x || !y) {
      return res.status(400).json({
        success: false,
        message: '좌표 정보(x, y)가 필요합니다.'
      });
    }

    // Kakao Local API - 카테고리 검색
    const response = await axios.get('https://dapi.kakao.com/v2/local/search/category.json', {
      headers: {
        'Authorization': `KakaoAK ${KAKAO_API_KEY}`
      },
      params: {
        category_group_code: categoryCode,
        x: x,
        y: y,
        radius: Math.min(radius, 20000), // 최대 20km
        size: Math.min(size, 15),
        page: 1,
        sort: 'distance'
      }
    });

    // 장소명 정리 함수 (동일한 로직)
    const cleanPlaceName = (name) => {
      if (!name) return '';
      let cleaned = name.trim();
      
      // 카테고리 정보 제거 (가장 먼저 처리)
      cleaned = cleaned.replace(/^(카페|맛집|레스토랑|커피전문점|음식점|디저트|브런치|술집|바|펜션|호텔|모텔|노래방|볼링장|영화관|공원|마트|백화점|쇼핑몰)\s*:\s*/i, '');
      
      // 전화번호 패턴 제거
      cleaned = cleaned.replace(/\b\d{2,4}-\d{3,4}-\d{4}\b/g, '');
      cleaned = cleaned.replace(/\b\d{3}-\d{4}-\d{4}\b/g, '');
      cleaned = cleaned.replace(/\b\d{4}-\d{4}\b/g, '');
      
      // 괄호 안의 전화번호나 기타 정보 제거
      cleaned = cleaned.replace(/\([^)]*\d{3,4}[^)]*\)/g, '');
      
      // 카테고리 정보가 뒤에 있는 경우도 제거
      cleaned = cleaned.replace(/\s+(카페|맛집|레스토랑|커피전문점|음식점|디저트|브런치|술집|바|펜션|호텔|모텔|노래방|볼링장|영화관|공원|마트|백화점|쇼핑몰)$/i, '');
      cleaned = cleaned.replace(/\s*\((카페|맛집|레스토랑|커피전문점|음식점|디저트|브런치|술집|바|펜션|호텔|모텔|노래방|볼링장|영화관|공원|마트|백화점|쇼핑몰)\)$/i, '');
      
      // 연속된 공백 정리
      cleaned = cleaned.replace(/\s+/g, ' ');
      cleaned = cleaned.trim();
      
      return cleaned || name;
    };

    const places = response.data.documents.map(place => ({
      id: place.id,
      name: cleanPlaceName(place.place_name), // 장소명 정리
      category: place.category_name.split(' > ').pop(),
      address: place.address_name,
      roadAddress: place.road_address_name,
      coordinates: {
        x: parseFloat(place.x),
        y: parseFloat(place.y)
      },
      phone: place.phone || null,
      rating: null,
      url: place.place_url,
      distance: place.distance ? parseInt(place.distance) : null
    }));

    res.json({
      success: true,
      places: places,
      meta: {
        total_count: response.data.meta.total_count,
        pageable_count: response.data.meta.pageable_count,
        is_end: response.data.meta.is_end
      }
    });

  } catch (error) {
    console.error('카테고리 검색 실패:', error.response?.data || error.message);
    
    res.status(500).json({
      success: false,
      message: '카테고리 검색 중 오류가 발생했습니다.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// 장소 상세 정보 (Kakao에서는 제한적)
router.get('/detail/:placeId', async (req, res) => {
  try {
    const { placeId } = req.params;

    // Kakao API에서는 장소 ID로 직접 상세 정보를 가져올 수 없으므로
    // 대신 장소명으로 재검색하여 정보를 제공
    res.json({
      success: false,
      message: 'Kakao API에서는 장소 상세 정보를 직접 제공하지 않습니다.'
    });

  } catch (error) {
    console.error('장소 상세 정보 조회 실패:', error);
    res.status(500).json({
      success: false,
      message: '장소 상세 정보 조회 중 오류가 발생했습니다.'
    });
  }
});

module.exports = router; 