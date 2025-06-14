const express = require('express');
const { auth } = require('../middleware/auth');
const axios = require('axios');

const router = express.Router();

// 주소로 좌표 검색 (Geocoding)
router.post('/geocode', auth, async (req, res) => {
  try {
    const { address } = req.body;

    if (!address) {
      return res.status(400).json({ message: '주소를 입력해주세요.' });
    }

    const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY;
    
    if (!googleMapsApiKey) {
      // API 키가 없는 경우 더미 응답
      return res.json({
        address: address,
        coordinates: {
          lat: 37.5665 + (Math.random() - 0.5) * 0.1,
          lng: 126.9780 + (Math.random() - 0.5) * 0.1
        },
        formatted_address: `${address} (더미 주소)`
      });
    }

    const response = await axios.get(
      'https://maps.googleapis.com/maps/api/geocode/json',
      {
        params: {
          address: address,
          key: googleMapsApiKey
        }
      }
    );

    if (response.data.results && response.data.results.length > 0) {
      const result = response.data.results[0];
      res.json({
        address: result.formatted_address,
        coordinates: {
          lat: result.geometry.location.lat,
          lng: result.geometry.location.lng
        },
        formatted_address: result.formatted_address
      });
    } else {
      res.status(404).json({ message: '주소를 찾을 수 없습니다.' });
    }
  } catch (error) {
    console.error('Geocoding error:', error);
    res.status(500).json({ message: '주소 검색 중 오류가 발생했습니다.' });
  }
});

// 주변 장소 검색
router.post('/nearby', auth, async (req, res) => {
  try {
    const { lat, lng, radius = 1000, type = 'restaurant' } = req.body;

    if (!lat || !lng) {
      return res.status(400).json({ message: '위치 정보가 필요합니다.' });
    }

    const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY;
    
    if (!googleMapsApiKey) {
      // API 키가 없는 경우 더미 데이터 반환
      return res.json([
        {
          name: '스타벅스',
          address: '서울시 강남구',
          rating: 4.2,
          price_level: 2,
          coordinates: { lat: lat + 0.001, lng: lng + 0.001 }
        },
        {
          name: '맥도날드',
          address: '서울시 강남구',
          rating: 4.0,
          price_level: 1,
          coordinates: { lat: lat - 0.001, lng: lng + 0.001 }
        }
      ]);
    }

    const response = await axios.get(
      'https://maps.googleapis.com/maps/api/place/nearbysearch/json',
      {
        params: {
          location: `${lat},${lng}`,
          radius: radius,
          type: type,
          key: googleMapsApiKey
        }
      }
    );

    if (response.data.results) {
      const places = response.data.results.slice(0, 20).map(place => ({
        name: place.name,
        address: place.vicinity,
        rating: place.rating || 4.0,
        price_level: place.price_level || 2,
        coordinates: {
          lat: place.geometry.location.lat,
          lng: place.geometry.location.lng
        },
        place_id: place.place_id,
        types: place.types
      }));

      res.json(places);
    } else {
      res.json([]);
    }
  } catch (error) {
    console.error('Nearby search error:', error);
    res.status(500).json({ message: '주변 장소 검색 중 오류가 발생했습니다.' });
  }
});

// 장소 상세 정보 조회
router.get('/place/:placeId', auth, async (req, res) => {
  try {
    const { placeId } = req.params;
    const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY;
    
    if (!googleMapsApiKey) {
      // API 키가 없는 경우 더미 데이터 반환
      return res.json({
        name: '더미 장소',
        address: '서울시 강남구',
        rating: 4.2,
        price_level: 2,
        photos: [],
        reviews: [],
        opening_hours: '월-일 09:00-22:00'
      });
    }

    const response = await axios.get(
      'https://maps.googleapis.com/maps/api/place/details/json',
      {
        params: {
          place_id: placeId,
          fields: 'name,formatted_address,rating,price_level,photos,reviews,opening_hours,formatted_phone_number',
          key: googleMapsApiKey
        }
      }
    );

    if (response.data.result) {
      res.json(response.data.result);
    } else {
      res.status(404).json({ message: '장소를 찾을 수 없습니다.' });
    }
  } catch (error) {
    console.error('Place details error:', error);
    res.status(500).json({ message: '장소 정보 조회 중 오류가 발생했습니다.' });
  }
});

module.exports = router; 