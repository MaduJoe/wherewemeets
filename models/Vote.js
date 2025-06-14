const mongoose = require('mongoose');

const voteSchema = new mongoose.Schema({
  meetingId: {
    type: String,
    required: true,
    index: true
  },
  placeId: {
    type: String,
    required: true
  },
  placeName: {
    type: String,
    required: true
  },
  voter: {
    id: { type: String, required: true },
    name: { type: String, required: true },
    email: { type: String }
  },
  votedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// 복합 인덱스: 한 미팅에서 한 사용자는 하나의 장소에만 투표 가능
voteSchema.index({ meetingId: 1, 'voter.id': 1 }, { unique: true });

// 투표 집계를 위한 스태틱 메서드
voteSchema.statics.getVotesByMeeting = async function(meetingId) {
  const votes = await this.find({ meetingId });
  const votesByPlace = {};
  
  votes.forEach(vote => {
    if (!votesByPlace[vote.placeId]) {
      votesByPlace[vote.placeId] = [];
    }
    votesByPlace[vote.placeId].push({
      id: vote.voter.id,
      name: vote.voter.name,
      email: vote.voter.email,
      votedAt: vote.votedAt
    });
  });
  
  return votesByPlace;
};

// 사용자의 현재 투표 확인
voteSchema.statics.getUserVote = async function(meetingId, userId) {
  return await this.findOne({ meetingId, 'voter.id': userId });
};

module.exports = mongoose.model('Vote', voteSchema); 