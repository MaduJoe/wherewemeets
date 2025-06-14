import React, { useState, useEffect } from 'react';
import axios from 'axios';
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

      const response = await axios.get('/api/places/search', {
        params: {
          category: kakaoCategoryMap[filters.category] || '',
          query: queryTerm
        }
      });
      
      let filteredPlaces = response.data.places || [];
      
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
    } catch (error) {
      console.error('장소 검색 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
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
      const response = await axios.post(`/api/places/${placeId}/reviews`, {
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

  const PlaceDetailModal = ({ place, onClose }) => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="text-xl font-bold text-gray-900">{place.name}</h3>
              <p className="text-gray-600">{place.address}</p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl"
            >
              ×
            </button>
          </div>

          <div className="flex items-center mb-4">
            {renderStars(place.rating, 'h-5 w-5')}
            <span className="ml-2 text-lg font-medium text-gray-900">
              {place.rating?.toFixed(1)}
            </span>
            <span className="ml-2 text-gray-600">
              ({place.reviews?.length || 0}개 리뷰)
            </span>
          </div>

          {/* 리뷰 목록 */}
          <div className="mb-6">
            <h4 className="font-medium text-gray-900 mb-3">리뷰</h4>
            {place.reviews && place.reviews.length > 0 ? (
              <div className="space-y-3 max-h-40 overflow-y-auto">
                {place.reviews.map((review) => (
                  <div key={review.id} className="border-b pb-3">
                    <div className="flex items-center mb-1">
                      {renderStars(review.rating, 'h-3 w-3')}
                      <span className="ml-2 text-sm text-gray-600">
                        사용자{review.userId}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700">{review.comment}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-sm">아직 리뷰가 없습니다.</p>
            )}
          </div>

          {/* 리뷰 작성 */}
          <div className="border-t pt-4">
            <h4 className="font-medium text-gray-900 mb-3">리뷰 작성</h4>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  평점
                </label>
                <div className="flex space-x-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      onClick={() => setNewReview({...newReview, rating: star})}
                      className="focus:outline-none"
                    >
                      <StarSolidIcon
                        className={`h-6 w-6 ${
                          star <= newReview.rating
                            ? 'text-yellow-400'
                            : 'text-gray-300'
                        }`}
                      />
                    </button>
                  ))}
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  리뷰 내용
                </label>
                <textarea
                  value={newReview.comment}
                  onChange={(e) => setNewReview({...newReview, comment: e.target.value})}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="이 장소에 대한 리뷰를 작성해주세요..."
                />
              </div>
              
              <button
                onClick={() => submitReview(place.id)}
                className="w-full bg-primary-600 text-white py-2 px-4 rounded-lg hover:bg-primary-700 transition duration-200"
              >
                리뷰 등록
              </button>
            </div>
          </div>

          <div className="flex space-x-3 mt-6">
            <button
              onClick={(e) => {
                e.stopPropagation();
                
                // 카테고리 매핑 (한국어 -> 영어/표준화)
                const categoryMapping = {
                  '음식점': 'restaurant',
                  '카페': 'cafe',
                  '커피전문점': 'cafe',
                  '테마카페': 'cafe',
                  '디저트카페': 'cafe',
                  '한식': 'restaurant',
                  '중식': 'restaurant',
                  '일식': 'restaurant',
                  '양식': 'restaurant',
                  '치킨': 'restaurant',
                  '피자': 'restaurant',
                  '햄버거': 'restaurant',
                  '분식': 'restaurant',
                  '냉면': 'restaurant',
                  '국수': 'restaurant',
                  '술집': 'restaurant',
                  '호프': 'restaurant',
                  '펜션': 'accommodation',
                  '모텔': 'accommodation',
                  '호텔': 'accommodation',
                  '노래방': 'entertainment',
                  '볼링장': 'entertainment',
                  '영화관': 'entertainment',
                  '공원': 'park',
                  '마트': 'shopping',
                  '백화점': 'shopping',
                  '쇼핑몰': 'shopping'
                };

                // 카테고리 변환 (카카오 카테고리명에서 마지막 부분 추출 후 매핑)
                const lastCategory = place.category ? place.category.split(' > ').pop() : '';
                const standardCategory = categoryMapping[lastCategory] || 'other';

                const placeData = {
                  id: place.id,
                  name: place.name,
                  category: standardCategory,
                  address: place.address,
                  coordinates: {
                    lat: parseFloat(place.coordinates.y), // y -> lat
                    lng: parseFloat(place.coordinates.x)  // x -> lng
                  },
                  rating: place.rating || 0,
                  phone: place.phone,
                  photos: place.photos || []
                };

                onPlaceSelected && onPlaceSelected(placeData);
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
    </div>
  );

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
                        {place.rating?.toFixed(1)} ({place.reviews?.length || 0}개 리뷰)
                      </span>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <span className="bg-gray-100 text-gray-700 text-xs px-2 py-1 rounded">
                        {categories.find(c => c.value === place.category)?.label || '기타'}
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex flex-col space-y-2 ml-4">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        
                        // 카테고리 매핑 (한국어 -> 영어/표준화)
                        const categoryMapping = {
                          '음식점': 'restaurant',
                          '카페': 'cafe',
                          '커피전문점': 'cafe',
                          '테마카페': 'cafe',
                          '디저트카페': 'cafe',
                          '한식': 'restaurant',
                          '중식': 'restaurant',
                          '일식': 'restaurant',
                          '양식': 'restaurant',
                          '치킨': 'restaurant',
                          '피자': 'restaurant',
                          '햄버거': 'restaurant',
                          '분식': 'restaurant',
                          '냉면': 'restaurant',
                          '국수': 'restaurant',
                          '술집': 'restaurant',
                          '호프': 'restaurant',
                          '펜션': 'accommodation',
                          '모텔': 'accommodation',
                          '호텔': 'accommodation',
                          '노래방': 'entertainment',
                          '볼링장': 'entertainment',
                          '영화관': 'entertainment',
                          '공원': 'park',
                          '마트': 'shopping',
                          '백화점': 'shopping',
                          '쇼핑몰': 'shopping'
                        };

                        // 카테고리 변환 (카카오 카테고리명에서 마지막 부분 추출 후 매핑)
                        const lastCategory = place.category ? place.category.split(' > ').pop() : '';
                        const standardCategory = categoryMapping[lastCategory] || 'other';

                        const placeData = {
                          id: place.id,
                          name: place.name,
                          category: standardCategory,
                          address: place.address,
                          coordinates: {
                            lat: parseFloat(place.coordinates.y), // y -> lat
                            lng: parseFloat(place.coordinates.x)  // x -> lng
                          },
                          rating: place.rating || 0,
                          phone: place.phone,
                          photos: place.photos || []
                        };

                        onPlaceSelected && onPlaceSelected(placeData);
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