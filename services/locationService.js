const axios = require('axios');

class LocationService {
  constructor() {
    this.googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY;
  }

  // 여러 참가자들을 고려한 최적의 장소들을 찾는 메인 함수
  async findOptimalLocations(participants) {
    try {
      // 1. 중심점 계산
      const centerPoint = this.calculateCenterPoint(participants);
      
      // 2. 각 참가자의 선호도를 종합
      const preferences = this.aggregatePreferences(participants);
      
      // 3. Google Places API를 사용해 후보 장소들 검색
      const candidateLocations = await this.searchNearbyPlaces(
        centerPoint, 
        preferences
      );
      
      // 4. 각 장소에 대해 모든 참가자의 이동 시간 계산
      const locationsWithTravelTimes = await this.calculateTravelTimes(
        candidateLocations, 
        participants
      );
      
      // 5. 점수 계산 및 정렬
      const scoredLocations = this.scoreLocations(
        locationsWithTravelTimes, 
        participants, 
        preferences
      );
      
      return scoredLocations.slice(0, 10); // 상위 10개 추천
    } catch (error) {
      console.error('Location service error:', error);
      throw new Error('장소 추천 중 오류가 발생했습니다.');
    }
  }

  // 모든 참가자 위치의 중심점 계산
  calculateCenterPoint(participants) {
    const validParticipants = participants.filter(p => 
      p.location && p.location.coordinates
    );

    if (validParticipants.length === 0) {
      throw new Error('유효한 참가자 위치가 없습니다.');
    }

    const sumLat = validParticipants.reduce((sum, p) => 
      sum + p.location.coordinates.lat, 0
    );
    const sumLng = validParticipants.reduce((sum, p) => 
      sum + p.location.coordinates.lng, 0
    );

    return {
      lat: sumLat / validParticipants.length,
      lng: sumLng / validParticipants.length
    };
  }

  // 참가자들의 선호도를 종합
  aggregatePreferences(participants) {
    const allCategories = [];
    const transportModes = [];
    let maxDistance = 30; // 기본값

    participants.forEach(p => {
      if (p.preferences) {
        if (p.preferences.categories) {
          allCategories.push(...p.preferences.categories);
        }
        if (p.preferences.transportMode) {
          transportModes.push(p.preferences.transportMode);
        }
        if (p.preferences.maxDistance) {
          maxDistance = Math.min(maxDistance, p.preferences.maxDistance);
        }
      }
    });

    // 가장 많이 선호되는 카테고리들을 찾기
    const categoryCount = {};
    allCategories.forEach(cat => {
      categoryCount[cat] = (categoryCount[cat] || 0) + 1;
    });

    const topCategories = Object.entries(categoryCount)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .map(([cat]) => cat);

    return {
      categories: topCategories.length > 0 ? topCategories : ['restaurant'],
      maxDistance,
      primaryTransportMode: this.getMostCommonTransportMode(transportModes)
    };
  }

  getMostCommonTransportMode(modes) {
    if (modes.length === 0) return 'driving';
    
    const modeCount = {};
    modes.forEach(mode => {
      modeCount[mode] = (modeCount[mode] || 0) + 1;
    });
    
    return Object.entries(modeCount)
      .sort(([,a], [,b]) => b - a)[0][0];
  }

  // Google Places API를 사용해 근처 장소 검색
  async searchNearbyPlaces(centerPoint, preferences) {
    if (!this.googleMapsApiKey) {
      // API 키가 없는 경우 더미 데이터 반환
      return this.getDummyLocations(centerPoint);
    }

    const places = [];
    
    for (const category of preferences.categories) {
      try {
        const response = await axios.get(
          'https://maps.googleapis.com/maps/api/place/nearbysearch/json',
          {
            params: {
              location: `${centerPoint.lat},${centerPoint.lng}`,
              radius: preferences.maxDistance * 1000, // km to meters
              type: this.mapCategoryToGoogleType(category),
              key: this.googleMapsApiKey
            }
          }
        );

        if (response.data.results) {
          places.push(...response.data.results.slice(0, 5)); // 카테고리당 5개
        }
      } catch (error) {
        console.error(`Error searching for ${category}:`, error.message);
      }
    }

    return places.map(place => ({
      name: place.name,
      address: place.vicinity,
      coordinates: {
        lat: place.geometry.location.lat,
        lng: place.geometry.location.lng
      },
      category: this.mapGoogleTypeToCategory(place.types[0]),
      rating: place.rating || 4.0,
      priceLevel: place.price_level || 2,
      googlePlaceId: place.place_id
    }));
  }

  // Google Places API 키가 없을 때 사용할 더미 데이터
  getDummyLocations(centerPoint) {
    return [
      {
        name: '스타벅스 강남점',
        address: '서울시 강남구 테헤란로',
        coordinates: {
          lat: centerPoint.lat + 0.001,
          lng: centerPoint.lng + 0.001
        },
        category: 'cafe',
        rating: 4.2,
        priceLevel: 2,
        googlePlaceId: 'dummy_1'
      },
      {
        name: '놀부부대찌개',
        address: '서울시 강남구 역삼동',
        coordinates: {
          lat: centerPoint.lat - 0.001,
          lng: centerPoint.lng + 0.002
        },
        category: 'restaurant',
        rating: 4.0,
        priceLevel: 2,
        googlePlaceId: 'dummy_2'
      },
      {
        name: '한강공원',
        address: '서울시 강남구 반포동',
        coordinates: {
          lat: centerPoint.lat + 0.002,
          lng: centerPoint.lng - 0.001
        },
        category: 'park',
        rating: 4.5,
        priceLevel: 0,
        googlePlaceId: 'dummy_3'
      }
    ];
  }

  mapCategoryToGoogleType(category) {
    const mapping = {
      'restaurant': 'restaurant',
      'cafe': 'cafe',
      'park': 'park',
      'shopping': 'shopping_mall',
      'entertainment': 'movie_theater',
      'bar': 'bar'
    };
    return mapping[category] || 'establishment';
  }

  mapGoogleTypeToCategory(googleType) {
    const mapping = {
      'restaurant': 'restaurant',
      'cafe': 'cafe',
      'park': 'park',
      'shopping_mall': 'shopping',
      'movie_theater': 'entertainment',
      'bar': 'bar'
    };
    return mapping[googleType] || 'restaurant';
  }

  // 각 장소에 대해 모든 참가자의 이동 시간 계산
  async calculateTravelTimes(locations, participants) {
    const locationsWithTimes = [];

    for (const location of locations) {
      const travelTimes = [];

      for (const participant of participants) {
        if (!participant.location || !participant.location.coordinates) {
          continue;
        }

        const travelTime = await this.calculateSingleTravelTime(
          participant.location.coordinates,
          location.coordinates,
          participant.preferences?.transportMode || 'driving'
        );

        travelTimes.push({
          participantId: participant.user,
          duration: travelTime.duration,
          distance: travelTime.distance,
          mode: participant.preferences?.transportMode || 'driving'
        });
      }

      locationsWithTimes.push({
        ...location,
        travelTimes
      });
    }

    return locationsWithTimes;
  }

  // 단일 경로의 이동 시간 계산
  async calculateSingleTravelTime(origin, destination, mode) {
    if (!this.googleMapsApiKey) {
      // API 키가 없는 경우 더미 계산
      const distance = this.calculateDistance(origin, destination);
      const speedKmH = mode === 'walking' ? 5 : mode === 'transit' ? 25 : 40;
      return {
        duration: Math.round((distance / speedKmH) * 60), // minutes
        distance: Math.round(distance * 1000) // meters
      };
    }

    try {
      const response = await axios.get(
        'https://maps.googleapis.com/maps/api/directions/json',
        {
          params: {
            origin: `${origin.lat},${origin.lng}`,
            destination: `${destination.lat},${destination.lng}`,
            mode: mode,
            key: this.googleMapsApiKey
          }
        }
      );

      if (response.data.routes && response.data.routes[0]) {
        const route = response.data.routes[0].legs[0];
        return {
          duration: Math.round(route.duration.value / 60), // seconds to minutes
          distance: route.distance.value // meters
        };
      }
    } catch (error) {
      console.error('Travel time calculation error:', error.message);
    }

    // 폴백: 직선 거리 기반 계산
    const distance = this.calculateDistance(origin, destination);
    const speedKmH = mode === 'walking' ? 5 : mode === 'transit' ? 25 : 40;
    return {
      duration: Math.round((distance / speedKmH) * 60),
      distance: Math.round(distance * 1000)
    };
  }

  // 두 지점 간의 직선 거리 계산 (km)
  calculateDistance(point1, point2) {
    const R = 6371; // 지구의 반지름 (km)
    const dLat = this.toRad(point2.lat - point1.lat);
    const dLon = this.toRad(point2.lng - point1.lng);
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(this.toRad(point1.lat)) * Math.cos(this.toRad(point2.lat)) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  toRad(deg) {
    return deg * (Math.PI/180);
  }

  // 각 장소의 점수 계산
  scoreLocations(locations, participants, preferences) {
    return locations.map(location => {
      let score = 0;
      const travelTimes = location.travelTimes || [];

      // 1. 이동 시간 점수 (가중치: 40%)
      if (travelTimes.length > 0) {
        const avgTravelTime = travelTimes.reduce((sum, tt) => sum + tt.duration, 0) / travelTimes.length;
        const maxTravelTime = Math.max(...travelTimes.map(tt => tt.duration));
        
        // 평균 이동 시간이 짧을수록, 최대 이동 시간이 짧을수록 좋음
        const timeScore = Math.max(0, 100 - (avgTravelTime * 2) - (maxTravelTime * 0.5));
        score += timeScore * 0.4;
      }

      // 2. 장소 평점 점수 (가중치: 25%)
      const ratingScore = (location.rating || 4.0) * 20;
      score += ratingScore * 0.25;

      // 3. 카테고리 선호도 점수 (가중치: 20%)
      const categoryScore = preferences.categories.includes(location.category) ? 100 : 50;
      score += categoryScore * 0.2;

      // 4. 가격 수준 점수 (가중치: 15%)
      const priceScore = Math.max(0, 100 - (location.priceLevel || 2) * 20);
      score += priceScore * 0.15;

      return {
        ...location,
        score: Math.round(score)
      };
    }).sort((a, b) => b.score - a.score);
  }
}

module.exports = new LocationService(); 