const express = require('express');
const router = express.Router();
const Chat = require('../models/Chat');

// 미팅별 채팅 메시지 조회
router.get('/:meetingId', async (req, res) => {
  try {
    const { meetingId } = req.params;
    const limit = parseInt(req.query.limit) || 50;
    
    // MongoDB에서 미팅별 메시지 조회 (최신순으로 정렬 후 역순으로 반환)
    const messages = await Chat.find({ meetingId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
    
    // 시간순(오래된 것부터)으로 다시 정렬
    const sortedMessages = messages.reverse();
    
    console.log(`📋 채팅 메시지 조회 - 미팅: ${meetingId}, 메시지 수: ${sortedMessages.length}`);
    
    res.json({
      success: true,
      data: {
        messages: sortedMessages,
        total: sortedMessages.length
      }
    });
  } catch (error) {
    console.error('채팅 메시지 조회 실패:', error);
    res.status(500).json({
      success: false,
      message: '채팅 메시지 조회 중 오류가 발생했습니다.'
    });
  }
});

// 채팅 메시지 전송
router.post('/:meetingId/messages', async (req, res) => {
  try {
    const { meetingId } = req.params;
    const { userId, userName, message } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({
        success: false,
        message: '메시지 내용이 필요합니다.'
      });
    }

    if (!userName || !userName.trim()) {
      return res.status(400).json({
        success: false,
        message: '사용자 이름이 필요합니다.'
      });
    }

    // MongoDB에 새 메시지 저장
    const newMessage = new Chat({
      meetingId,
      userId: userId || `user_${Date.now()}`,
      userName: userName.trim(),
      message: message.trim(),
      reactions: new Map()
    });

    const savedMessage = await newMessage.save();

    // 메시지 개수 제한 적용 (100개 초과 시 오래된 메시지 삭제)
    await Chat.maintainMessageLimit(meetingId, 100);

    console.log(`💬 새 채팅 메시지 저장 - 미팅: ${meetingId}, 사용자: ${userName}, 메시지: ${message.substring(0, 50)}...`);

    // 저장된 메시지의 총 개수 조회
    const totalCount = await Chat.countDocuments({ meetingId });

    res.json({
      success: true,
      data: {
        message: savedMessage.toJSON(),
        total: totalCount
      }
    });
  } catch (error) {
    console.error('채팅 메시지 전송 실패:', error);
    
    // MongoDB 연결 오류 처리
    if (error.name === 'MongoError' || error.name === 'MongooseError') {
      return res.status(503).json({
        success: false,
        message: '데이터베이스 연결 오류입니다. 잠시 후 다시 시도해주세요.'
      });
    }
    
    res.status(500).json({
      success: false,
      message: '메시지 전송 중 오류가 발생했습니다.'
    });
  }
});

// 메시지에 반응 추가
router.post('/:meetingId/messages/:messageId/reactions', async (req, res) => {
  try {
    const { meetingId, messageId } = req.params;
    const { emoji } = req.body;

    if (!emoji) {
      return res.status(400).json({
        success: false,
        message: '이모지가 필요합니다.'
      });
    }

    // MongoDB에서 메시지 찾기 (ObjectId 또는 문자열 ID 모두 처리)
    let message;
    try {
      message = await Chat.findOne({ 
        meetingId, 
        $or: [
          { _id: messageId },
          { _id: messageId.replace('msg_', '') } // 기존 format 지원
        ]
      });
    } catch (err) {
      // ObjectId가 아닌 경우를 대비한 fallback
      message = await Chat.findOne({ meetingId, _id: messageId });
    }

    if (!message) {
      return res.status(404).json({
        success: false,
        message: '메시지를 찾을 수 없습니다.'
      });
    }

    // 이모지 반응 추가
    if (!message.reactions) {
      message.reactions = new Map();
    }
    
    const currentCount = message.reactions.get(emoji) || 0;
    message.reactions.set(emoji, currentCount + 1);
    
    const updatedMessage = await message.save();

    console.log(`😊 메시지 반응 추가 - 미팅: ${meetingId}, 이모지: ${emoji}`);

    res.json({
      success: true,
      data: {
        message: updatedMessage.toJSON()
      }
    });
  } catch (error) {
    console.error('메시지 반응 추가 실패:', error);
    
    // MongoDB 연결 오류 처리
    if (error.name === 'MongoError' || error.name === 'MongooseError') {
      return res.status(503).json({
        success: false,
        message: '데이터베이스 연결 오류입니다. 잠시 후 다시 시도해주세요.'
      });
    }
    
    res.status(500).json({
      success: false,
      message: '반응 추가 중 오류가 발생했습니다.'
    });
  }
});

// 채팅 메시지 삭제 (개발용)
router.delete('/:meetingId', async (req, res) => {
  try {
    const { meetingId } = req.params;
    
    // MongoDB에서 미팅별 모든 메시지 삭제
    const result = await Chat.deleteMany({ meetingId });
    
    console.log(`🗑️ 미팅 ${meetingId}의 채팅 메시지 ${result.deletedCount}개 삭제`);
    
    res.json({
      success: true,
      message: `채팅 메시지 ${result.deletedCount}개가 삭제되었습니다.`,
      deletedCount: result.deletedCount
    });
  } catch (error) {
    console.error('채팅 메시지 삭제 실패:', error);
    
    // MongoDB 연결 오류 처리
    if (error.name === 'MongoError' || error.name === 'MongooseError') {
      return res.status(503).json({
        success: false,
        message: '데이터베이스 연결 오류입니다. 잠시 후 다시 시도해주세요.'
      });
    }
    
    res.status(500).json({
      success: false,
      message: '채팅 메시지 삭제 중 오류가 발생했습니다.'
    });
  }
});

module.exports = router; 