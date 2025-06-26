const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  avatar: {
    type: String,
    default: ''
  },
  phone: {
    type: String,
    default: ''
  },
  bio: {
    type: String,
    maxlength: 500,
    default: ''
  },
  location: {
    city: {
      type: String,
      default: ''
    },
    address: {
      type: String,
      default: ''
    },
    coordinates: {
      latitude: Number,
      longitude: Number
    }
  },
  subscription: {
    type: String,
    enum: ['free', 'premium', 'pro'],
    default: 'free'
  },
  subscriptionEndDate: {
    type: Date,
    default: null
  },
  socialLogin: {
    provider: {
      type: String,
      enum: ['google', 'kakao', 'naver', 'local'],
      default: 'local'
    },
    providerId: String
  },
  preferences: {
    transportMode: {
      type: String,
      enum: ['driving', 'walking', 'transit', 'bicycling'],
      default: 'driving'
    },
    preferredCategories: [{
      type: String,
      enum: ['restaurant', 'cafe', 'park', 'shopping', 'entertainment', 'bar']
    }],
    maxDistance: {
      type: Number,
      default: 30 // km
    },
    language: {
      type: String,
      enum: ['ko', 'en'],
      default: 'ko'
    },
    notifications: {
      email: {
        type: Boolean,
        default: true
      },
      push: {
        type: Boolean,
        default: true
      },
      sms: {
        type: Boolean,
        default: false
      }
    }
  },
  analytics: {
    totalMeetings: {
      type: Number,
      default: 0
    },
    totalVotes: {
      type: Number,
      default: 0
    },
    favoriteCategories: [String],
    lastActivity: {
      type: Date,
      default: Date.now
    },
    featureUsage: [{
      feature: String,
      count: {
        type: Number,
        default: 1
      },
      lastUsed: {
        type: Date,
        default: Date.now
      }
    }],
    aiRecommendationUsage: {
      type: Number,
      default: 0
    },
    loginHistory: [{
      timestamp: {
        type: Date,
        default: Date.now
      },
      ip: String,
      userAgent: String,
      provider: String
    }]
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  verificationToken: String,
  resetPasswordToken: String,
  resetPasswordExpire: Date,
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// 업데이트 시간 자동 설정
UserSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// 비밀번호 해싱
UserSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// 비밀번호 검증
UserSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// 기능 사용 추적
UserSchema.methods.trackFeatureUsage = function(featureName) {
  const existingFeature = this.analytics.featureUsage.find(f => f.feature === featureName);
  
  if (existingFeature) {
    existingFeature.count += 1;
    existingFeature.lastUsed = new Date();
  } else {
    this.analytics.featureUsage.push({
      feature: featureName,
      count: 1,
      lastUsed: new Date()
    });
  }
  
  this.analytics.lastActivity = new Date();
  return this.save();
};

// 로그인 이력 추가
UserSchema.methods.addLoginHistory = function(ip, userAgent, provider = 'local') {
  this.analytics.loginHistory.push({
    timestamp: new Date(),
    ip,
    userAgent,
    provider
  });
  
  // 최근 10개 로그인 이력만 유지
  if (this.analytics.loginHistory.length > 10) {
    this.analytics.loginHistory = this.analytics.loginHistory.slice(-10);
  }
  
  return this.save();
};

// 미팅 참여 통계 업데이트
UserSchema.methods.incrementMeetingCount = function() {
  this.analytics.totalMeetings += 1;
  this.analytics.lastActivity = new Date();
  return this.save();
};

// 투표 통계 업데이트
UserSchema.methods.incrementVoteCount = function() {
  this.analytics.totalVotes += 1;
  this.analytics.lastActivity = new Date();
  return this.save();
};

// AI 추천 사용 횟수 증가
UserSchema.methods.incrementAIRecommendationUsage = function() {
  this.analytics.aiRecommendationUsage += 1;
  this.analytics.lastActivity = new Date();
  return this.save();
};

// AI 추천 사용 가능 여부 확인
UserSchema.methods.canUseAIRecommendation = function() {
  // 프리미엄 사용자는 무제한
  if (this.subscription === 'premium' || this.subscription === 'pro') {
    return { canUse: true, remaining: 'unlimited' };
  }
  
  // 게스트/무료 사용자는 5회 제한
  const used = this.analytics.aiRecommendationUsage || 0;
  const limit = 5;
  const remaining = Math.max(0, limit - used);
  
  return {
    canUse: remaining > 0,
    remaining: remaining,
    limit: limit,
    used: used
  };
};

module.exports = mongoose.model('User', UserSchema); 