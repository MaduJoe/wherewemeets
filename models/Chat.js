const mongoose = require('mongoose');

const chatSchema = new mongoose.Schema({
  meetingId: {
    type: String,
    required: true,
    index: true // 미팅별 조회 최적화
  },
  userId: {
    type: String,
    required: true
  },
  userName: {
    type: String,
    required: true,
    trim: true
  },
  message: {
    type: String,
    required: true,
    trim: true,
    maxlength: 1000 // 메시지 최대 길이 제한
  },
  reactions: {
    type: Map,
    of: Number,
    default: new Map()
  },
  // 사용자별 반응 추적 (이모지 -> 사용자 ID 배열)
  userReactions: {
    type: Map,
    of: [String],
    default: new Map()
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true // 시간순 정렬 최적화
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true // createdAt, updatedAt 자동 관리
});

// 복합 인덱스: 미팅별 시간순 조회 최적화
chatSchema.index({ meetingId: 1, createdAt: -1 });

// 메시지 ID를 virtual field로 생성 (기존 코드 호환성 유지)
chatSchema.virtual('id').get(function() {
  return this._id.toHexString();
});

// JSON 직렬화 시 virtual field 포함
chatSchema.set('toJSON', {
  virtuals: true,
  transform: function(doc, ret) {
    // id 필드를 명시적으로 추가 (virtual field 대신)
    ret.id = ret._id.toString();
    
    // reactions를 일반 객체로 변환 (Map → Object)
    if (ret.reactions instanceof Map) {
      ret.reactions = Object.fromEntries(ret.reactions);
    } else if (ret.reactions && typeof ret.reactions === 'object') {
      ret.reactions = ret.reactions;
    } else {
      ret.reactions = {};
    }
    
    // userReactions를 일반 객체로 변환 (Map → Object)
    if (ret.userReactions instanceof Map) {
      ret.userReactions = Object.fromEntries(ret.userReactions);
    } else if (ret.userReactions && typeof ret.userReactions === 'object') {
      ret.userReactions = ret.userReactions;
    } else {
      ret.userReactions = {};
    }
    
    // timestamp 필드명 통일 (createdAt → timestamp)
    ret.timestamp = ret.createdAt;
    
    return ret;
  }
});

// 미팅별 메시지 개수 제한 (100개 초과 시 오래된 메시지 삭제)
chatSchema.statics.maintainMessageLimit = async function(meetingId, limit = 100) {
  try {
    const messageCount = await this.countDocuments({ meetingId });
    
    if (messageCount > limit) {
      const excessCount = messageCount - limit;
      const oldestMessages = await this.find({ meetingId })
        .sort({ createdAt: 1 })
        .limit(excessCount)
        .select('_id');
      
      const idsToDelete = oldestMessages.map(msg => msg._id);
      await this.deleteMany({ _id: { $in: idsToDelete } });
      
      console.log(`🗑️ 미팅 ${meetingId}: ${excessCount}개 오래된 메시지 삭제`);
    }
  } catch (error) {
    console.error('메시지 개수 제한 처리 실패:', error);
  }
};

// 미팅별 메시지 조회 메서드
chatSchema.statics.getMessagesByMeeting = async function(meetingId, limit = 50) {
  try {
    return await this.find({ meetingId })
      .sort({ createdAt: -1 }) // 최신순
      .limit(limit)
      .lean(); // 성능 최적화
  } catch (error) {
    console.error('미팅별 메시지 조회 실패:', error);
    return [];
  }
};

module.exports = mongoose.model('Chat', chatSchema); 