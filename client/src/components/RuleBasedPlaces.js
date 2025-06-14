import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { FireIcon, SparklesIcon, PlusCircleIcon, ExclamationTriangleIcon, ChevronRightIcon } from '@heroicons/react/24/outline';

const PlaceCard = ({ place, onPlaceSelected, icon, badgeText, badgeColor }) => (
  <div className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
    <div className="flex items-center mb-2">
      {icon}
      <span className={`ml-2 text-xs font-semibold px-2 py-0.5 rounded-full ${badgeColor}`}>
        {badgeText}
      </span>
    </div>
    <h4 className="text-md font-semibold text-gray-800 mb-1">{place.name}</h4>
    <p className="text-sm text-gray-600 mb-1">
      {place.category} • ⭐ {place.rating || 'N/A'}
    </p>
    <p className="text-xs text-gray-500 mb-2">{place.address}</p>
    {place.phone && (
      <p className="text-xs text-blue-600 mb-2">📞 {place.phone}</p>
    )}
    <button
      onClick={() => {
        // 카테고리 매핑 (한국어 -> 영어/표준화)
        const categoryMapping = {
          '커피전문점': 'cafe',
          '카페': 'cafe',
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
          '술집': 'bar',
          '호프': 'bar',
          '펜션': 'accommodation',
          '모텔': 'accommodation',
          '호텔': 'accommodation',
          '노래방': 'entertainment',
          '볼링장': 'entertainment',
          '영화관': 'entertainment',
          '공원': 'park',
          '마트': 'shopping',
          '백화점': 'shopping'
        };

        const standardCategory = categoryMapping[place.category] || 'other';

        onPlaceSelected({
          id: place.id,
          name: place.name,
          category: standardCategory,
          address: place.address,
          coordinates: {
            lat: place.coordinates.y, // y -> lat
            lng: place.coordinates.x  // x -> lng
          },
          rating: place.rating,
          phone: place.phone,
          photos: place.photos || []
        });
      }}
      className="w-full bg-gradient-to-r from-blue-500 to-indigo-500 text-white py-2 px-3 rounded-md text-sm font-medium hover:from-blue-600 hover:to-indigo-600 transition duration-150 flex items-center justify-center"
    >
      <PlusCircleIcon className="h-4 w-4 mr-1.5" />
      후보에 추가
    </button>
  </div>
);

const LoadingCard = () => (
  <div className="bg-white border border-gray-200 rounded-lg p-4 animate-pulse">
    <div className="flex items-center mb-2">
      <div className="h-5 w-5 bg-gray-300 rounded mr-2"></div>
      <div className="h-4 w-12 bg-gray-300 rounded"></div>
    </div>
    <div className="h-5 bg-gray-300 rounded mb-2"></div>
    {/* <div className="h-4 bg-gray-300 rounded mb-2"></div>
    <div className="h-3 bg-gray-300 rounded mb-3"></div>
    <div className="h-8 bg-gray-300 rounded"></div> */}
  </div>
);

const ErrorCard = ({ message, onRetry }) => (
  <div className="col-span-full bg-red-50 border border-red-200 rounded-lg p-6 text-center">
    <ExclamationTriangleIcon className="h-12 w-12 text-red-500 mx-auto mb-4" />
    <h3 className="text-lg font-medium text-red-900 mb-2">데이터 로딩 실패</h3>
    <p className="text-red-700 mb-4">{message}</p>
    <button
      onClick={onRetry}
      className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 transition-colors"
    >
      다시 시도
    </button>
  </div>
);

const RuleBasedPlaces = ({ onPlaceSelected }) => {
  const [hotPlaces, setHotPlaces] = useState([]);
  const [newPlaces, setNewPlaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Kakao API를 통한 장소 검색
  const searchPlaces = async (query, category = '') => {
    try {
      const response = await axios.get('/api/places/search', {
        params: {
          query,
          category,
          size: 5
        }
      });
      return response.data.places || [];
    } catch (error) {
      console.error('장소 검색 실패:', error);
      throw error;
    }
  };

  // 인기 장소 데이터 로드
  const loadHotPlaces = async () => {
    try {
      const queries = [
        '강남 맛집',
        '홍대 카페', 
        '성수동 브런치',
        '이태원 바',
        '명동 디저트'
      ];
      
      const allPlaces = [];
      for (const query of queries) {
        const places = await searchPlaces(query);
        allPlaces.push(...places.slice(0, 1)); // 각 쿼리당 1개씩
      }
      
      return allPlaces.map(place => ({
        ...place,
        reason: '인기 검색어 상위'
      }));
    } catch (error) {
      console.error('인기 장소 로드 실패:', error);
      return [];
    }
  };

  // 새로운 장소 데이터 로드 (최근 개업한 곳들)
  const loadNewPlaces = async () => {
    try {
      const queries = [
        '신규 오픈 카페',
        '새로 생긴 맛집',
        '오픈 예정 레스토랑',
        '신상 브런치',
        '새로운 펜션'
      ];
      
      const allPlaces = [];
      for (const query of queries) {
        const places = await searchPlaces(query);
        allPlaces.push(...places.slice(0, 1)); // 각 쿼리당 1개씩
      }
      
      return allPlaces.map(place => ({
        ...place,
        reason: '최근 신규 오픈'
      }));
    } catch (error) {
      console.error('신규 장소 로드 실패:', error);
      return [];
    }
  };

  // 초기 데이터 로드
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const [hotData, newData] = await Promise.all([
          loadHotPlaces(),
          loadNewPlaces()
        ]);
        
        setHotPlaces(hotData);
        setNewPlaces(newData);
      } catch (error) {
        console.error('데이터 로드 실패:', error);
        setError(error.response?.data?.message || '장소 데이터를 불러오는데 실패했습니다.');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const handleRetry = () => {
    setError(null);
    setLoading(true);
    // 1초 후 재시도
    setTimeout(() => {
      window.location.reload();
    }, 1000);
  };

  if (error) {
    return (
      <div className="space-y-8 mt-8">
        <ErrorCard message={error} onRetry={handleRetry} />
      </div>
    );
  }

  return (
    <div className="space-y-8 mt-8">
      {/* Hot Places */}
      <button
        onClick={() => {}}
        className="w-full text-left p-3 rounded-lg transition-colors text-gray-600 hover:bg-gray-50 border border-transparent"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <FireIcon className="h-6 w-6 mr-2 text-red-500" />
            <h3 className="text-xl font-bold text-gray-900">
              요즘 뜨는 Hot 플레이스
            </h3>
          </div>
          <ChevronRightIcon className="h-5 w-5 text-gray-400" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
          {loading ? (
            Array.from({ length: 3 }).map((_, index) => (
              <LoadingCard key={`hot-loading-${index}`} />
            ))
          ) : (
            hotPlaces.map((place, index) => (
              <PlaceCard
                key={`hot-${place.id || index}`}
                place={place}
                onPlaceSelected={onPlaceSelected}
                icon={<FireIcon className="h-5 w-5 text-red-500" />}
                badgeText="HOT"
                badgeColor="bg-red-100 text-red-700"
              />
            ))
          )}
        </div>
      </button>

      {/* New Places */}
      <button
        onClick={() => {}}
        className="w-full text-left p-3 rounded-lg transition-colors text-gray-600 hover:bg-gray-50 border border-transparent"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <SparklesIcon className="h-6 w-6 mr-2 text-yellow-500" />
            <h3 className="text-xl font-bold text-gray-900">
              새로 생긴 New 플레이스
            </h3>
          </div>
          <ChevronRightIcon className="h-5 w-5 text-gray-400" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
          {loading ? (
            Array.from({ length: 3 }).map((_, index) => (
              <LoadingCard key={`new-loading-${index}`} />
            ))
          ) : (
            newPlaces.map((place, index) => (
              <PlaceCard
                key={`new-${place.id || index}`}
                place={place}
                onPlaceSelected={onPlaceSelected}
                icon={<SparklesIcon className="h-5 w-5 text-yellow-500" />}
                badgeText="NEW"
                badgeColor="bg-yellow-100 text-yellow-700"
              />
            ))
          )}
        </div>
      </button>
    </div>
  );
};

export default RuleBasedPlaces; 