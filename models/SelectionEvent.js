const mongoose = require('mongoose');

const selectionEventSchema = new mongoose.Schema({
  meetingId: {
    type: String,
    required: true,
    index: true
  },
  participantId: {
    type: String,
    required: true
  },
  participantName: {
    type: String,
    required: true
  },
  selectedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// 미팅별 선정 이력 조회
selectionEventSchema.statics.getByMeeting = async function(meetingId) {
  return await this.find({ meetingId }).sort({ selectedAt: -1 });
};

// 참가자별 선정 횟수 계산
selectionEventSchema.statics.getSelectionCounts = async function(meetingId) {
  const pipeline = [
    { $match: { meetingId } },
    { $group: { 
      _id: '$participantId', 
      count: { $sum: 1 },
      name: { $first: '$participantName' }
    }}
  ];
  
  const results = await this.aggregate(pipeline);
  const counts = {};
  results.forEach(result => {
    counts[result._id] = result.count;
  });
  
  return counts;
};

module.exports = mongoose.model('SelectionEvent', selectionEventSchema); 