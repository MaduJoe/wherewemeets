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
    
    const candidate = new this({
      meetingId,
      placeId: placeData.id,
      name: placeData.name,
      category: placeData.category || 'other',
      address: placeData.address || '주소 정보 없음',
      coordinates: placeData.coordinates || { lat: 0, lng: 0 },
      rating: placeData.rating || 0,
      photos: placeData.photos || [],
      additionalInfo: placeData.additionalInfo || '',
      addedBy: placeData.addedBy
    });
    
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