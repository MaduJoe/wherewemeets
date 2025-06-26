const mongoose = require('mongoose');

const candidatePlaceSchema = new mongoose.Schema({
  meetingId: {
    type: String,
    required: true,
    index: true
  },
  placeId: {
    type: String,
    required: true
  },
  name: {
    type: String,
    required: true
  },
  category: {
    type: String,
    enum: [
      'restaurant', 'cafe', 'entertainment', 'park', 'shopping', 'culture', 'other', 'bar', 'accommodation',
      '한식', '중식', '일식', '양식', '카페', '술집', '기타', '커피전문점', '테마카페', '디저트카페',
      '치킨', '피자', '햄버거', '분식', '호프', '펜션', '모텔', '호텔', '노래방', '볼링장', '영화관', '공원', '마트', '백화점'
    ],
    default: 'other'
  },
  address: {
    type: String,
    required: false,
    default: ''
  },
  coordinates: {
    lat: { type: Number, required: true },
    lng: { type: Number, required: true }
  },
  rating: {
    type: Number,
    min: 0,
    max: 5
  },
  photos: [{
    type: String // 사진 URL
  }],
  additionalInfo: {
    type: String
  },
  addedBy: {
    id: { type: String, required: true },
    name: { type: String, required: true },
    email: { type: String }
  },
  addedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// 복합 인덱스: 한 미팅에서 같은 장소는 중복 추가 불가
candidatePlaceSchema.index({ meetingId: 1, placeId: 1 }, { unique: true });

// 미팅별 후보 장소 조회
candidatePlaceSchema.statics.getByMeeting = async function(meetingId) {
  return await this.find({ meetingId }).sort({ addedAt: 1 });
};

// 후보 장소 추가 (중복 체크 포함)
candidatePlaceSchema.statics.addCandidate = async function(meetingId, placeData) {
  try {
    console.log('CandidatePlace.addCandidate 시작:', { meetingId, placeData });
    
    if (!meetingId || !placeData) {
      throw new Error('meetingId와 placeData가 필요합니다.');
    }
    
    if (!placeData.id || !placeData.name) {
      throw new Error('장소 ID와 이름이 필요합니다.');
    }
    
    if (!placeData.addedBy || !placeData.addedBy.id) {
      throw new Error('addedBy 정보가 필요합니다.');
    }
    
    // photos 데이터 처리: 객체 배열이면 URL만 추출, 문자열 배열이면 그대로 사용
    let processedPhotos = [];
    if (placeData.photos && Array.isArray(placeData.photos)) {
      processedPhotos = placeData.photos.map(photo => {
        if (typeof photo === 'string') {
          return photo; // 이미 문자열이면 그대로 사용
        } else if (photo && photo.photo_reference) {
          // Google Places API 형식
          return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photoreference=${photo.photo_reference}&key=${process.env.GOOGLE_PLACES_API_KEY}`;
        } else if (photo && photo.url) {
          // URL 필드가 있는 경우
          return photo.url;
        } else if (photo && typeof photo === 'object') {
          // 다른 객체 형식인 경우 JSON 문자열로 변환하거나 빈 문자열
          return JSON.stringify(photo);
        }
        return ''; // 기본값
      }).filter(url => url && url.length > 0); // 빈 문자열 제거
    }

    // 데이터 타입 안전성 검사 및 변환
    const safeData = {
      meetingId: String(meetingId),
      placeId: String(placeData.id),
      name: String(placeData.name),
      category: String(placeData.category || 'other'),
      address: String(placeData.address || '주소 정보 없음'),
      coordinates: {
        lat: Number(placeData.coordinates?.lat || 0),
        lng: Number(placeData.coordinates?.lng || 0)
      },
      rating: Number(placeData.rating || 0),
      photos: processedPhotos,
      additionalInfo: String(placeData.additionalInfo || ''),
      addedBy: {
        id: String(placeData.addedBy.id),
        name: String(placeData.addedBy.name),
        email: placeData.addedBy.email ? String(placeData.addedBy.email) : null
      }
    };

    console.log('처리된 안전한 데이터:', safeData);

    const candidate = new this(safeData);
    
    console.log('CandidatePlace 객체 생성 완료:', candidate);
    
    const savedCandidate = await candidate.save();
    console.log('CandidatePlace 저장 완료:', savedCandidate);
    
    return savedCandidate;
  } catch (error) {
    console.error('CandidatePlace.addCandidate 에러:', error);
    
    if (error.code === 11000) {
      throw new Error('이미 추가된 장소입니다.');
    }
    
    // MongoDB 연결 에러 체크
    if (error.name === 'MongoNetworkError' || error.name === 'MongooseServerSelectionError') {
      throw new Error('데이터베이스 연결에 실패했습니다.');
    }
    
    // 유효성 검사 에러
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(e => e.message);
      throw new Error(`데이터 검증 실패: ${messages.join(', ')}`);
    }
    
    throw error;
  }
};

module.exports = mongoose.model('CandidatePlace', candidatePlaceSchema); 