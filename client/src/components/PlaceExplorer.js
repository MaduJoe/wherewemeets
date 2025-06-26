import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { cleanPlacesArray, cleanPlaceData } from '../utils/placeUtils';
import { 
  MagnifyingGlassIcon,
  StarIcon,
  FunnelIcon,
  PhotoIcon,
  ChatBubbleBottomCenterTextIcon
} from '@heroicons/react/24/outline';
import { StarIcon as StarSolidIcon } from '@heroicons/react/24/solid';

const PlaceExplorer = ({ onPlaceSelected }) => {
  const [places, setPlaces] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
    category: 'all',
    minRating: 0,
    sortBy: 'rating'
  });
  const [selectedPlace, setSelectedPlace] = useState(null);
  const [newReview, setNewReview] = useState({ rating: 5, comment: '' });

  const categories = [
    { value: 'all', label: '전체', icon: '🌟' },
    { value: 'restaurant', label: '음식점', icon: '🍽️' },
    { value: 'cafe', label: '카페', icon: '☕' },
    { value: 'park', label: '공원', icon: '🌳' },
    { value: 'entertainment', label: '오락시설', icon: '🎮' },
    { value: 'shopping', label: '쇼핑', icon: '🛍️' }
  ];

  const sortOptions = [
    { value: 'rating', label: '평점 높은순' },
    { value: 'name', label: '이름순' },
    { value: 'reviews', label: '리뷰 많은순' }
  ];

  // 카카오 카테고리 코드 매핑 (6가지 categories에 맞춤)
  const kakaoCategoryMap = {
    all: '',
    restaurant: 'FD6',      // 음식점
    cafe: 'CE7',            // 카페
    park: '',               // 공원 (카카오에서 직접 지원 안함)
    entertainment: '',      // 오락시설 (카카오에서 직접 지원 안함)
    shopping: 'MT1',        // 쇼핑 (대형마트)
  };

  useEffect(() => {
    searchPlaces();
  }, [filters]);

  const searchPlaces = async () => {
    console.log('searchPlaces 함수 시작');
    setLoading(true);
    try {
      // 검색어가 없으면 카테고리별 기본 검색어 사용
      let queryTerm = searchTerm.trim();
      if (!queryTerm) {
        // 카테고리별 기본 검색어 설정 (6가지만)
        const defaultQueries = {
          all: '맛집',
          restaurant: '맛집',
          cafe: '카페',
          park: '공원',
          entertainment: '놀거리',
          shopping: '쇼핑몰'
        };
        queryTerm = defaultQueries[filters.category] || '장소';
      }

      console.log('API 요청 시작:', {
        url: '/api/places/search',
        params: {
          category: kakaoCategoryMap[filters.category] || '',
          query: queryTerm
        }
      });

      const response = await api.get('/places/search', {
        params: {
          category: kakaoCategoryMap[filters.category] || '',
          query: queryTerm
        }
      });

      console.log('API 응답 받음:', response.data);
      
      // 장소 데이터 정리 (전화번호, URL 등 정리)
      let filteredPlaces = cleanPlacesArray(response.data.places || []);
      
      // 카테고리 매핑 함수
      const mapKakaoCategory = (kakaoCategory) => {
        if (!kakaoCategory) return 'other';
        
        const fullCategory = kakaoCategory.toLowerCase();
        const lastCategory = kakaoCategory.split(' > ').pop().toLowerCase();
        
        console.log('카테고리 매핑 중:', { original: kakaoCategory, full: fullCategory, last: lastCategory });
        
        // 오락시설 관련 (우선 처리)
        if (fullCategory.includes('오락') || fullCategory.includes('레저') || fullCategory.includes('스포츠') ||
            lastCategory.includes('노래방') || lastCategory.includes('볼링') || lastCategory.includes('게임') || 
            lastCategory.includes('영화') || lastCategory.includes('pc방') || lastCategory.includes('당구') ||
            lastCategory.includes('카라오케') || lastCategory.includes('코인노래방') || lastCategory.includes('멀티방') ||
            lastCategory.includes('vr') || lastCategory.includes('방탈출') || lastCategory.includes('찜질방') ||
            lastCategory.includes('사우나') || lastCategory.includes('헬스') || lastCategory.includes('체육관') ||
            lastCategory.includes('수영장') || lastCategory.includes('골프') || lastCategory.includes('테니스') ||
            lastCategory.includes('배드민턴') || lastCategory.includes('탁구') || lastCategory.includes('클럽') ||
            lastCategory.includes('펍') || lastCategory.includes('바') || lastCategory.includes('룸') ||
            fullCategory.includes('엔터테인먼트') || fullCategory.includes('entertainment')) {
          return 'entertainment';
        }
        
        // 카페 관련
        if (lastCategory.includes('카페') || lastCategory.includes('커피') || lastCategory.includes('디저트') ||
            lastCategory.includes('베이커리') || lastCategory.includes('빵집') || lastCategory.includes('케이크')) {
          return 'cafe';
        }
        
        // 공원 관련
        if (lastCategory.includes('공원') || lastCategory.includes('놀이터') || lastCategory.includes('산책로') ||
            lastCategory.includes('자연') || lastCategory.includes('산') || lastCategory.includes('강') ||
            lastCategory.includes('해변') || lastCategory.includes('바다')) {
          return 'park';
        }
        
        // 쇼핑 관련
        if (lastCategory.includes('마트') || lastCategory.includes('백화점') || lastCategory.includes('쇼핑') || 
            lastCategory.includes('상가') || lastCategory.includes('몰') || lastCategory.includes('시장') ||
            lastCategory.includes('편의점') || lastCategory.includes('슈퍼')) {
          return 'shopping';
        }
        
        // 문화시설 관련
        if (lastCategory.includes('박물관') || lastCategory.includes('미술관') || lastCategory.includes('도서관') ||
            lastCategory.includes('문화') || lastCategory.includes('전시') || lastCategory.includes('공연') ||
            lastCategory.includes('극장') || lastCategory.includes('콘서트')) {
          return 'culture';
        }
        
        // 음식점 관련 (더 포괄적으로)
        if (lastCategory.includes('음식') || lastCategory.includes('식당') || lastCategory.includes('레스토랑') ||
            lastCategory.includes('한식') || lastCategory.includes('중식') || lastCategory.includes('일식') ||
            lastCategory.includes('양식') || lastCategory.includes('치킨') || lastCategory.includes('피자') ||
            lastCategory.includes('햄버거') || lastCategory.includes('분식') || lastCategory.includes('고기') ||
            lastCategory.includes('회') || lastCategory.includes('초밥') || lastCategory.includes('파스타') ||
            lastCategory.includes('뷔페') || lastCategory.includes('맛집') || lastCategory.includes('요리') ||
            lastCategory.includes('먹거리') || lastCategory.includes('술집') || lastCategory.includes('호프') ||
            lastCategory.includes('주점') || lastCategory.includes('포차') || lastCategory.includes('삼겹살') ||
            lastCategory.includes('갈비') || lastCategory.includes('국밥') || lastCategory.includes('찜') ||
            lastCategory.includes('탕') || lastCategory.includes('죽') || lastCategory.includes('면') ||
            lastCategory.includes('국수') || lastCategory.includes('냉면') || lastCategory.includes('라면') ||
            lastCategory.includes('족발') || lastCategory.includes('보쌈') || lastCategory.includes('곱창') ||
            lastCategory.includes('순대') || lastCategory.includes('떡볶이') || lastCategory.includes('김밥') ||
            lastCategory.includes('도시락') || lastCategory.includes('샐러드') || lastCategory.includes('샌드위치') ||
            lastCategory.includes('토스트') || lastCategory.includes('스테이크') || lastCategory.includes('리조또') ||
            lastCategory.includes('돈까스') || lastCategory.includes('우동') || lastCategory.includes('라멘') ||
            lastCategory.includes('소바') || lastCategory.includes('덮밥') || lastCategory.includes('볶음밥') ||
            lastCategory.includes('김치') || lastCategory.includes('반찬') || lastCategory.includes('밑반찬') ||
            fullCategory.includes('food') || fullCategory.includes('restaurant') || fullCategory.includes('dining')) {
          return 'restaurant';
        }
        
        // 일반적인 업종명으로 추가 매핑 시도
        if (lastCategory.includes('업소') || lastCategory.includes('상점') || lastCategory.includes('가게') ||
            lastCategory.includes('점포') || lastCategory.includes('매장') || lastCategory.includes('전문점')) {
          // 이름에서 추가 단서 찾기
          if (fullCategory.includes('식') || fullCategory.includes('먹') || fullCategory.includes('요리') ||
              fullCategory.includes('맛') || fullCategory.includes('음료') || fullCategory.includes('주류')) {
            return 'restaurant';
          }
        }
        
        // 특정 지역 카테고리나 브랜드명이 포함된 경우 기본적으로 음식점으로 분류
        if (lastCategory.length > 0 && !lastCategory.includes('시설') && !lastCategory.includes('센터') &&
            !lastCategory.includes('건물') && !lastCategory.includes('사무소') && !lastCategory.includes('병원') &&
            !lastCategory.includes('학교') && !lastCategory.includes('교육') && !lastCategory.includes('은행') &&
            !lastCategory.includes('관공서') && !lastCategory.includes('기관')) {
          // 일반적인 상호명이나 업소명인 경우 음식점으로 추정
          console.log('🍽️ 일반 업소로 추정하여 음식점으로 분류:', kakaoCategory);
          return 'restaurant';
        }
        
        // 기본값 - 카테고리를 알 수 없는 경우
        console.log('🔍 알 수 없는 카테고리 - 기타로 분류됨:', {
          original: kakaoCategory,
          full: fullCategory,
          last: lastCategory
        });
        return 'other';
      };
      
      // 장소 데이터에 카테고리 매핑 (서버에서 이미 Google 리뷰가 통합되어 옴)
      filteredPlaces = filteredPlaces.map(place => {
        const mappedCategory = mapKakaoCategory(place.category);
        
        return {
          ...place,
          category: mappedCategory,
          // rating과 reviews는 서버에서 Google API로 가져온 실제 데이터 사용
          rating: place.rating || 0,
          reviews: place.reviews || [],
          reviewCount: place.reviewCount || 0,
          photos: place.photos || []
        };
      });
      
      console.log('카테고리 매핑 후 장소들:', filteredPlaces.map(p => ({ name: p.name, category: p.category })));
      
      // 선택된 카테고리 필터링 (all이 아닌 경우)
      if (filters.category !== 'all') {
        filteredPlaces = filteredPlaces.filter(place => place.category === filters.category);
        console.log(`${filters.category} 카테고리 필터링 후:`, filteredPlaces.length, '개');
      }
      
      // 평점 필터링
      if (filters.minRating > 0) {
        filteredPlaces = filteredPlaces.filter(place => place.rating >= filters.minRating);
      }
      
      // 정렬
      filteredPlaces.sort((a, b) => {
        switch (filters.sortBy) {
          case 'rating':
            return b.rating - a.rating;
          case 'name':
            return a.name.localeCompare(b.name);
          case 'reviews':
            return (b.reviews?.length || 0) - (a.reviews?.length || 0);
          default:
            return 0;
        }
      });
      
      setPlaces(filteredPlaces);
      console.log('검색 완료, 장소 개수:', filteredPlaces.length);
    } catch (error) {
      console.error('장소 검색 실패:', error);
      console.error('에러 상세:', error.response?.data || error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    console.log('검색 버튼 클릭됨');
    console.log('검색어:', searchTerm);
    console.log('필터:', filters);
    searchPlaces();
  };

  const renderStars = (rating, size = 'h-4 w-4') => {
    return Array.from({ length: 5 }, (_, i) => (
      <StarIcon
        key={i}
        className={`${size} ${
          i < Math.floor(rating)
            ? 'text-yellow-400 fill-current'
            : 'text-gray-300'
        }`}
      />
    ));
  };

  const submitReview = async (placeId) => {
    try {
      const response = await api.post(`/places/${placeId}/reviews`, {
        ...newReview,
        userId: 1 // 임시 사용자 ID
      });
      
      // 장소 정보 업데이트
      setPlaces(places.map(place => 
        place.id === placeId ? response.data : place
      ));
      
      setSelectedPlace(response.data);
      setNewReview({ rating: 5, comment: '' });
      alert('리뷰가 등록되었습니다!');
    } catch (error) {
      console.error('리뷰 등록 실패:', error);
      alert('리뷰 등록 중 오류가 발생했습니다.');
    }
  };

  const PlaceDetailModal = ({ place, onClose }) => {
    // ESC 키 이벤트 리스너
    React.useEffect(() => {
      const handleEscapeKey = (event) => {
        if (event.key === 'Escape') {
          onClose();
        }
      };

      document.addEventListener('keydown', handleEscapeKey);
      return () => {
        document.removeEventListener('keydown', handleEscapeKey);
      };
    }, [onClose]);

    return (
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            onClose();
          }
        }}
      >
        <div className="bg-white rounded-lg w-full max-w-4xl max-h-[85vh] flex flex-col">
          {/* 헤더 - 고정 */}
          <div className="flex justify-between items-start p-6 border-b border-gray-200 flex-shrink-0">
            <div className="flex-1 mr-4">
              <h3 className="text-xl font-bold text-gray-900 mb-1">{place.name}</h3>
              <p className="text-gray-600 text-sm">{place.address}</p>
              <div className="flex items-center mt-2">
                {renderStars(place.rating, 'h-4 w-4')}
                <span className="ml-2 text-lg font-medium text-gray-900">
                  {place.rating?.toFixed(1)}
                </span>
                <span className="ml-2 text-gray-600">
                  ({place.reviewCount || place.reviews?.length || 0}개 리뷰)
                </span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl flex-shrink-0 w-8 h-8 flex items-center justify-center"
            >
              ×
            </button>
          </div>

          {/* 리뷰 목록 - 스크롤 가능 */}
          <div className="flex-1 overflow-y-auto">
            <div className="p-6">
              <h4 className="font-medium text-gray-900 mb-4 sticky top-0 bg-white py-2">리뷰</h4>
              {place.reviews && place.reviews.length > 0 ? (
                <div className="space-y-4">
                  {place.reviews.map((review) => (
                    <div key={review.id} className="border-b border-gray-100 pb-4 last:border-b-0">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center">
                          {renderStars(review.rating, 'h-4 w-4')}
                          <span className="ml-2 text-sm font-medium text-gray-700">
                            {review.userId}
                          </span>
                        </div>
                        <div className="flex items-center text-xs text-gray-500">
                          {review.source === 'google' && (
                            <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full mr-2">
                              Google 리뷰
                            </span>
                          )}
                          <span>
                            {new Date(review.createdAt).toLocaleDateString('ko-KR')}
                          </span>
                        </div>
                      </div>
                      <p className="text-sm text-gray-700 leading-relaxed">{review.comment}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-gray-500 text-sm">아직 리뷰가 없습니다.</p>
                  {place.source === 'kakao_only' && (
                    <p className="text-xs text-gray-400 mt-1">
                      Google 리뷰 정보를 가져올 수 없었습니다.
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* 하단 버튼 - 고정 */}
          <div className="flex space-x-3 p-6 border-t border-gray-200 flex-shrink-0">
            <button
              onClick={(e) => {
                e.stopPropagation();
                
                // place.category는 이미 mapKakaoCategory 함수로 매핑된 값임
                const rawPlaceData = {
                  id: place.id,
                  name: place.name,
                  category: place.category, // 이미 매핑된 카테고리 사용
                  address: place.address,
                  coordinates: {
                    lat: parseFloat(place.coordinates.y), // y -> lat
                    lng: parseFloat(place.coordinates.x)  // x -> lng
                  },
                  rating: place.rating || 0,
                  phone: place.phone,
                  photos: place.photos || []
                };

                // 장소 데이터 정리 적용
                const cleanedPlaceData = cleanPlaceData(rawPlaceData);
                onPlaceSelected && onPlaceSelected(cleanedPlaceData);
              }}
              className="flex-1 bg-secondary-600 text-white py-2 px-4 rounded-lg hover:bg-secondary-700 transition duration-200"
            >
              이 장소 선택
            </button>
            <button
              onClick={onClose}
              className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-400 transition duration-200"
            >
              닫기
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center mb-6">
        <MagnifyingGlassIcon className="h-6 w-6 text-primary-600 mr-2" />
        <h3 className="text-lg font-semibold text-gray-900">장소 탐색</h3>
      </div>

      {/* 검색 및 필터 */}
      <div className="space-y-4 mb-6">
        {/* 검색바 */}
        <div className="flex space-x-2">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="장소명이나 주소를 검색하세요..."
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          <button
            onClick={handleSearch}
            className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition duration-200"
          >
            <MagnifyingGlassIcon className="h-4 w-4" />
          </button>
        </div>

        {/* 카테고리 필터 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            카테고리
          </label>
          <div className="grid grid-cols-3 gap-2">
            {categories.map(category => (
              <button
                key={category.value}
                onClick={() => setFilters({...filters, category: category.value})}
                className={`p-2 text-sm rounded-lg border transition-colors ${
                  filters.category === category.value
                    ? 'border-primary-500 bg-primary-50 text-primary-700'
                    : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                }`}
              >
                <span className="mr-1">{category.icon}</span>
                {category.label}
              </button>
            ))}
          </div>
        </div>

        {/* 추가 필터 */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              최소 평점
            </label>
            <select
              value={filters.minRating}
              onChange={(e) => setFilters({...filters, minRating: parseFloat(e.target.value)})}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value={0}>전체</option>
              <option value={3}>3점 이상</option>
              <option value={4}>4점 이상</option>
              <option value={4.5}>4.5점 이상</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              정렬
            </label>
            <select
              value={filters.sortBy}
              onChange={(e) => setFilters({...filters, sortBy: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              {sortOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* 장소 목록 */}
      {loading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">장소를 검색하는 중...</p>
        </div>
      ) : (
        <div className="space-y-4">
          {places.length > 0 ? (
            places.map((place) => (
              <div
                key={place.id}
                className="border rounded-lg p-4 hover:bg-gray-50 transition-colors cursor-pointer"
                onClick={() => setSelectedPlace(place)}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900 mb-1">{place.name}</h4>
                    <p className="text-sm text-gray-600 mb-2">{place.address}</p>
                    
                    <div className="flex items-center mb-2">
                      {renderStars(place.rating)}
                      <span className="ml-2 text-sm text-gray-600">
                        {place.rating?.toFixed(1)} ({place.reviewCount || place.reviews?.length || 0}개 리뷰)
                      </span>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                        {categories.find(c => c.value === place.category)?.icon} {categories.find(c => c.value === place.category)?.label || '기타'}
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex flex-col space-y-2 ml-4">
                    <button
                      onClick={async (e) => {
                        e.stopPropagation();
                        
                        // place.category는 이미 mapKakaoCategory 함수로 매핑된 값임
                        // 좌표 데이터 안전하게 처리
                        let coordinates;
                        if (place.coordinates) {
                          if (place.coordinates.lat !== undefined && place.coordinates.lng !== undefined) {
                            // 이미 {lat, lng} 형식
                            coordinates = {
                              lat: parseFloat(place.coordinates.lat),
                              lng: parseFloat(place.coordinates.lng)
                            };
                          } else if (place.coordinates.y !== undefined && place.coordinates.x !== undefined) {
                            // Kakao API 형식 {x, y}
                            coordinates = {
                              lat: parseFloat(place.coordinates.y),
                              lng: parseFloat(place.coordinates.x)
                            };
                          } else {
                            coordinates = { lat: 0, lng: 0 };
                          }
                        } else {
                          coordinates = { lat: 0, lng: 0 };
                        }

                        // photos 데이터 안전하게 처리
                        let processedPhotos = [];
                        if (place.photos && Array.isArray(place.photos)) {
                          processedPhotos = place.photos.map(photo => {
                            if (typeof photo === 'string') {
                              return photo; // 이미 문자열이면 그대로
                            } else if (photo && photo.photo_reference) {
                              // Google Places API 형식
                              return photo.photo_reference;
                            } else if (photo && photo.url) {
                              return photo.url;
                            }
                            return null;
                          }).filter(photo => photo !== null);
                        }

                        const rawPlaceData = {
                          id: place.id,
                          name: place.name,
                          category: place.category, // 이미 매핑된 카테고리 사용
                          address: place.address,
                          coordinates: coordinates,
                          rating: place.rating || 0,
                          phone: place.phone,
                          photos: processedPhotos
                        };

                        // 장소 데이터 정리 적용
                        const cleanedPlaceData = cleanPlaceData(rawPlaceData);
                        
                        console.log('PlaceExplorer - 전송할 장소 데이터:', cleanedPlaceData);
                        
                        try {
                          if (onPlaceSelected) {
                            await onPlaceSelected(cleanedPlaceData);
                          } else {
                            console.error('onPlaceSelected 함수가 전달되지 않았습니다.');
                          }
                        } catch (error) {
                          console.error('PlaceExplorer - 장소 선택 처리 중 에러:', error);
                          alert('장소 추가 중 오류가 발생했습니다. 다시 시도해주세요.');
                        }
                      }}
                      className="bg-secondary-600 text-white px-3 py-1 rounded text-sm hover:bg-secondary-700 transition duration-200"
                    >
                      선택
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedPlace(place);
                      }}
                      className="bg-gray-200 text-gray-700 px-3 py-1 rounded text-sm hover:bg-gray-300 transition duration-200"
                    >
                      상세보기
                    </button>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-8 text-gray-500">
              <MagnifyingGlassIcon className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <p>검색 결과가 없습니다.</p>
              <p className="text-sm">다른 검색어나 필터를 시도해보세요.</p>
            </div>
          )}
        </div>
      )}

      {/* 장소 상세 모달 */}
      {selectedPlace && (
        <PlaceDetailModal
          place={selectedPlace}
          onClose={() => setSelectedPlace(null)}
        />
      )}
    </div>
  );
};

export default PlaceExplorer; 