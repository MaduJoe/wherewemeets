const mongoose = require('mongoose');

const userMeetingHistorySchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    index: true
  },
  meetingId: {
    type: String,
    required: true
  },
  title: {
    type: String,
    default: '미팅'
  },
  description: String,
  role: {
    type: String,
    enum: ['host', 'participant'],
    default: 'host'
  },
  participantCount: {
    type: Number,
    default: 1
  },
  selectedPlace: {
    id: String,
    name: String,
    category: String,
    address: String,
    rating: Number,
    coordinates: {
      lat: Number,
      lng: Number
    }
  },
  candidatePlaces: [{
    id: String,
    name: String,
    category: String,
    address: String,
    rating: Number,
    votes: Number
  }],
  totalVotes: {
    type: Number,
    default: 0
  },
  selectionMethod: {
    type: String,
    enum: ['voting', 'random', 'manual'],
    default: 'voting'
  },
  meetingStatus: {
    type: String,
    enum: ['planning', 'completed', 'cancelled'],
    default: 'planning'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  completedAt: Date,
  tags: [String], // 사용자가 추가할 수 있는 태그
  notes: String    // 미팅에 대한 메모
}, {
  timestamps: true
});

// 복합 인덱스 생성
userMeetingHistorySchema.index({ userId: 1, createdAt: -1 });
userMeetingHistorySchema.index({ userId: 1, meetingId: 1 }, { unique: true });

// 사용자별 미팅 히스토리 조회 (최신순)
userMeetingHistorySchema.statics.getByUser = async function(userId, limit = 20, skip = 0) {
  return this.find({ userId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .skip(skip)
    .lean();
};

// 사용자별 통계 정보
userMeetingHistorySchema.statics.getUserStats = async function(userId) {
  const stats = await this.aggregate([
    { $match: { userId } },
    {
      $group: {
        _id: null,
        totalMeetings: { $sum: 1 },
        hostCount: { $sum: { $cond: [{ $eq: ["$role", "host"] }, 1, 0] } },
        participantCount: { $sum: { $cond: [{ $eq: ["$role", "participant"] }, 1, 0] } },
        completedMeetings: { $sum: { $cond: [{ $eq: ["$meetingStatus", "completed"] }, 1, 0] } },
        avgParticipants: { $avg: "$participantCount" },
        favoriteCategories: { $push: "$selectedPlace.category" }
      }
    }
  ]);

  if (stats.length === 0) {
    return {
      totalMeetings: 0,
      hostCount: 0,
      participantCount: 0,
      completedMeetings: 0,
      avgParticipants: 0,
      favoriteCategories: []
    };
  }

  const result = stats[0];
  
  // 카테고리 빈도 계산
  const categoryCount = {};
  result.favoriteCategories.forEach(category => {
    if (category) {
      categoryCount[category] = (categoryCount[category] || 0) + 1;
    }
  });
  
  // 가장 많이 사용한 카테고리 정렬
  const sortedCategories = Object.entries(categoryCount)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 5)
    .map(([category, count]) => ({ category, count }));

  return {
    ...result,
    favoriteCategories: sortedCategories
  };
};

// 미팅 저장 또는 업데이트
userMeetingHistorySchema.statics.saveOrUpdate = async function(userId, meetingData) {
  const filter = { userId, meetingId: meetingData.meetingId };
  const update = {
    $set: {
      ...meetingData,
      userId,
      updatedAt: new Date()
    }
  };
  const options = { upsert: true, new: true };
  
  return this.findOneAndUpdate(filter, update, options);
};

module.exports = mongoose.model('UserMeetingHistory', userMeetingHistorySchema); 