const express = require('express');
const axios = require('axios');
const router = express.Router();

// Kakao API 키 (환경변수에서 가져오기)
const KAKAO_API_KEY = process.env.KAKAO_API_KEY || 'f562a71b13dcad881fee2b157d93121c';

// 테스트 엔드포인트
router.get('/test', (req, res) => {
  console.log('Places 테스트 엔드포인트 호출됨');
  res.json({
    success: true,
    message: 'Places API 정상 작동',
    kakaoApiKey: KAKAO_API_KEY ? '설정됨' : '설정안됨'
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

    // 응답 데이터 변환
    const places = response.data.documents.map(place => ({
      id: place.id,
      name: place.place_name,
      category: place.category_name.split(' > ').pop(), // 마지막 카테고리만
      address: place.address_name,
      roadAddress: place.road_address_name,
      coordinates: {
        x: parseFloat(place.x), // 경도
        y: parseFloat(place.y)  // 위도
      },
      phone: place.phone || null,
      rating: null, // Kakao API에서는 평점 정보 제공 안함
      url: place.place_url,
      distance: place.distance ? parseInt(place.distance) : null
    }));

    console.log(`검색 결과: ${places.length}개 장소 찾음`);

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

    const places = response.data.documents.map(place => ({
      id: place.id,
      name: place.place_name,
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