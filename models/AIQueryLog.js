const mongoose = require('mongoose');

const aiQueryLogSchema = new mongoose.Schema({
  // 사용자 정보
  userId: {
    type: String,
    required: true,
    index: true
  },
  userType: {
    type: String,
    enum: ['guest', 'member', 'premium'],
    required: true,
    index: true
  },
  sessionId: {
    type: String,
    required: true,
    index: true
  },
  
  // 질의 정보
  query: {
    type: String,
    required: true
  },
  queryType: {
    type: String,
    enum: ['place_recommendation', 'chat_assistance', 'smart_collection', 'general'],
    required: true,
    index: true
  },
  context: {
    meetingId: String,
    location: String,
    preferences: mongoose.Schema.Types.Mixed,
    previousMessages: [String]
  },
  
  // AI 응답 정보
  response: {
    type: String,
    required: true
  },
  responseTime: {
    type: Number, // milliseconds
    required: true
  },
  aiModel: {
    type: String,
    default: 'gpt-3.5-turbo'
  },
  
  // 메타데이터
  success: {
    type: Boolean,
    default: true,
    index: true
  },
  errorMessage: String,
  tokenUsed: Number,
  
  // 분석용 필드
  sentiment: {
    type: String,
    enum: ['positive', 'neutral', 'negative'],
    index: true
  },
  category: {
    type: String,
    index: true
  },
  tags: [String],
  
  // 사용자 피드백
  userRating: {
    type: Number,
    min: 1,
    max: 5
  },
  userFeedback: String,
  
  // 시스템 정보
  ipAddress: String,
  userAgent: String,
  platform: {
    type: String,
    enum: ['web', 'mobile'],
    default: 'web'
  },
  
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// 복합 인덱스
aiQueryLogSchema.index({ userId: 1, createdAt: -1 });
aiQueryLogSchema.index({ queryType: 1, createdAt: -1 });
aiQueryLogSchema.index({ userType: 1, success: 1 });
aiQueryLogSchema.index({ createdAt: -1, success: 1 });

// 업데이트 시 updatedAt 자동 설정
aiQueryLogSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// 민감한 정보 필터링을 위한 메서드
aiQueryLogSchema.methods.getSafeData = function() {
  const safeData = this.toObject();
  // IP 주소 마스킹
  if (safeData.ipAddress) {
    const parts = safeData.ipAddress.split('.');
    if (parts.length === 4) {
      safeData.ipAddress = `${parts[0]}.${parts[1]}.*.* `;
    }
  }
  return safeData;
};

// 통계 생성을 위한 스태틱 메서드
aiQueryLogSchema.statics.getQueryStats = async function(dateRange = {}) {
  const { startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), endDate = new Date() } = dateRange;
  
  return await this.aggregate([
    {
      $match: {
        createdAt: { $gte: startDate, $lte: endDate }
      }
    },
    {
      $group: {
        _id: {
          date: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          queryType: "$queryType"
        },
        totalQueries: { $sum: 1 },
        successRate: { 
          $avg: { $cond: [{ $eq: ["$success", true] }, 1, 0] }
        },
        avgResponseTime: { $avg: "$responseTime" },
        uniqueUsers: { $addToSet: "$userId" }
      }
    },
    {
      $project: {
        date: "$_id.date",
        queryType: "$_id.queryType",
        totalQueries: 1,
        successRate: { $multiply: ["$successRate", 100] },
        avgResponseTime: { $round: ["$avgResponseTime", 2] },
        uniqueUserCount: { $size: "$uniqueUsers" }
      }
    },
    {
      $sort: { date: -1, queryType: 1 }
    }
  ]);
};

module.exports = mongoose.model('AIQueryLog', aiQueryLogSchema); 