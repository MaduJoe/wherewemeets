const express = require('express');
const router = express.Router();
const UserMeetingHistory = require('../models/UserMeetingHistory');
const { auth } = require('../middleware/auth');

// 사용자의 미팅 히스토리 조회
router.get('/:userId/history', async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 20, status, category } = req.query;
    
    console.log(`미팅 히스토리 조회: userId=${userId}, page=${page}, limit=${limit}`);
    
    // 필터 조건 구성
    const filter = { userId };
    if (status && status !== 'all') {
      filter.meetingStatus = status;
    }
    if (category && category !== 'all') {
      filter['selectedPlace.category'] = category;
    }
    
    // 페이지네이션 계산
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // 히스토리 조회와 총 개수를 병렬로 실행
    const [history, totalCount] = await Promise.all([
      UserMeetingHistory.find(filter)
        .sort({ createdAt: -1 })
        .limit(parseInt(limit))
        .skip(skip)
        .lean(),
      UserMeetingHistory.countDocuments(filter)
    ]);
    
    console.log(`조회 완료: ${history.length}개 항목, 총 ${totalCount}개`);
    
    res.json({
      success: true,
      data: {
        history,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalCount / parseInt(limit)),
          totalCount,
          hasNext: skip + history.length < totalCount,
          hasPrev: parseInt(page) > 1
        }
      }
    });
  } catch (error) {
    console.error('미팅 히스토리 조회 실패:', error);
    res.status(500).json({
      success: false,
      message: '미팅 히스토리 조회 중 오류가 발생했습니다.'
    });
  }
});

// 사용자 통계 정보 조회
router.get('/:userId/stats', async (req, res) => {
  try {
    const { userId } = req.params;
    
    console.log(`사용자 통계 조회: userId=${userId}`);
    
    const stats = await UserMeetingHistory.getUserStats(userId);
    
    console.log('통계 조회 완료:', stats);
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('사용자 통계 조회 실패:', error);
    res.status(500).json({
      success: false,
      message: '통계 조회 중 오류가 발생했습니다.'
    });
  }
});

// 미팅 히스토리 저장/업데이트
router.post('/:userId/history', async (req, res) => {
  try {
    const { userId } = req.params;
    const meetingData = req.body;
    
    console.log('미팅 히스토리 저장:', { userId, meetingId: meetingData.meetingId });
    
    // 필수 필드 검증
    if (!meetingData.meetingId) {
      return res.status(400).json({
        success: false,
        message: '미팅 ID가 필요합니다.'
      });
    }
    
    const savedHistory = await UserMeetingHistory.saveOrUpdate(userId, meetingData);
    
    console.log('미팅 히스토리 저장 완료:', savedHistory._id);
    
    res.json({
      success: true,
      data: savedHistory,
      message: '미팅 히스토리가 저장되었습니다.'
    });
  } catch (error) {
    console.error('미팅 히스토리 저장 실패:', error);
    res.status(500).json({
      success: false,
      message: '미팅 히스토리 저장 중 오류가 발생했습니다.'
    });
  }
});

// 특정 미팅 히스토리 조회
router.get('/:userId/history/:meetingId', async (req, res) => {
  try {
    const { userId, meetingId } = req.params;
    
    console.log(`특정 미팅 히스토리 조회: userId=${userId}, meetingId=${meetingId}`);
    
    const history = await UserMeetingHistory.findOne({ userId, meetingId }).lean();
    
    if (!history) {
      return res.status(404).json({
        success: false,
        message: '해당 미팅 히스토리를 찾을 수 없습니다.'
      });
    }
    
    res.json({
      success: true,
      data: history
    });
  } catch (error) {
    console.error('미팅 히스토리 조회 실패:', error);
    res.status(500).json({
      success: false,
      message: '미팅 히스토리 조회 중 오류가 발생했습니다.'
    });
  }
});

// 미팅 히스토리 삭제
router.delete('/:userId/history/:meetingId', async (req, res) => {
  try {
    const { userId, meetingId } = req.params;
    
    console.log(`미팅 히스토리 삭제: userId=${userId}, meetingId=${meetingId}`);
    
    const deletedHistory = await UserMeetingHistory.findOneAndDelete({ userId, meetingId });
    
    if (!deletedHistory) {
      return res.status(404).json({
        success: false,
        message: '해당 미팅 히스토리를 찾을 수 없습니다.'
      });
    }
    
    res.json({
      success: true,
      message: '미팅 히스토리가 삭제되었습니다.'
    });
  } catch (error) {
    console.error('미팅 히스토리 삭제 실패:', error);
    res.status(500).json({
      success: false,
      message: '미팅 히스토리 삭제 중 오류가 발생했습니다.'
    });
  }
});

// 미팅 상태 업데이트 (완료/취소)
router.patch('/:userId/history/:meetingId/status', async (req, res) => {
  try {
    const { userId, meetingId } = req.params;
    const { status, notes } = req.body;
    
    console.log(`미팅 상태 업데이트: userId=${userId}, meetingId=${meetingId}, status=${status}`);
    
    if (!['planning', 'completed', 'cancelled'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: '유효하지 않은 상태입니다.'
      });
    }
    
    const updateData = { meetingStatus: status };
    if (status === 'completed') {
      updateData.completedAt = new Date();
    }
    if (notes) {
      updateData.notes = notes;
    }
    
    const updatedHistory = await UserMeetingHistory.findOneAndUpdate(
      { userId, meetingId },
      { $set: updateData },
      { new: true }
    );
    
    if (!updatedHistory) {
      return res.status(404).json({
        success: false,
        message: '해당 미팅 히스토리를 찾을 수 없습니다.'
      });
    }
    
    res.json({
      success: true,
      data: updatedHistory,
      message: '미팅 상태가 업데이트되었습니다.'
    });
  } catch (error) {
    console.error('미팅 상태 업데이트 실패:', error);
    res.status(500).json({
      success: false,
      message: '미팅 상태 업데이트 중 오류가 발생했습니다.'
    });
  }
});

module.exports = router; 