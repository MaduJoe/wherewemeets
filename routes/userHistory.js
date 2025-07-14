const express = require('express');
const router = express.Router();
const UserMeetingHistory = require('../models/UserMeetingHistory');
const { auth } = require('../middleware/auth');

// 인증된 사용자의 미팅 히스토리 조회 (대시보드용)
router.get('/history', auth, async (req, res) => {
  try {
    const userId = req.user.userId; // 인증된 사용자 ID
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
    
    // 히스토리가 없는 경우 샘플 데이터 생성 (개발/테스트용)
    if (history.length === 0 && totalCount === 0) {
      const sampleData = [
        {
          userId: userId,
          meetingId: `meeting_${Date.now()}_1`,
          title: '팀 점심 미팅',
          description: '프로젝트 진행 상황 논의',
          role: 'host',
          participantCount: 4,
          selectedPlace: {
            name: '맛나는 김치찌개',
            category: 'restaurant',
            address: '서울시 강남구 테헤란로 123',
            rating: 4.5,
            coordinates: { lat: 37.5665, lng: 126.9780 }
          },
          candidatePlaces: [
            { name: '맛나는 김치찌개', category: 'restaurant', address: '서울시 강남구 테헤란로 123', rating: 4.5, votes: 3 },
            { name: '스타벅스 강남점', category: 'cafe', address: '서울시 강남구 테헤란로 456', rating: 4.2, votes: 1 }
          ],
          totalVotes: 4,
          selectionMethod: 'voting',
          meetingStatus: 'completed',
          createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7일 전
          completedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        },
        {
          userId: userId,
          meetingId: `meeting_${Date.now()}_2`,
          title: '카페 스터디 모임',
          description: '주말 스터디 그룹 모임',
          role: 'participant',
          participantCount: 3,
          selectedPlace: {
            name: '커피빈 홍대점',
            category: 'cafe',
            address: '서울시 마포구 홍대거리 789',
            rating: 4.3,
            coordinates: { lat: 37.5563, lng: 126.9236 }
          },
          candidatePlaces: [
            { name: '커피빈 홍대점', category: 'cafe', address: '서울시 마포구 홍대거리 789', rating: 4.3, votes: 2 },
            { name: '투썸플레이스 홍대점', category: 'cafe', address: '서울시 마포구 홍대거리 101', rating: 4.1, votes: 1 }
          ],
          totalVotes: 3,
          selectionMethod: 'voting',
          meetingStatus: 'completed',
          createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3일 전
          completedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
        },
        {
          userId: userId,
          meetingId: `meeting_${Date.now()}_3`,
          title: '친구들과 저녁 약속',
          description: '오랜만에 만나는 친구들과의 저녁 식사',
          role: 'host',
          participantCount: 5,
          selectedPlace: {
            name: '한강공원 치킨집',
            category: 'restaurant',
            address: '서울시 영등포구 한강공원로 234',
            rating: 4.7,
            coordinates: { lat: 37.5326, lng: 126.9619 }
          },
          candidatePlaces: [
            { name: '한강공원 치킨집', category: 'restaurant', address: '서울시 영등포구 한강공원로 234', rating: 4.7, votes: 4 },
            { name: '맥주창고', category: 'bar', address: '서울시 영등포구 한강대로 567', rating: 4.4, votes: 1 }
          ],
          totalVotes: 5,
          selectionMethod: 'voting',
          meetingStatus: 'planning',
          createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000) // 1일 전
        }
      ];
      
      try {
        // 샘플 데이터 저장
        await UserMeetingHistory.insertMany(sampleData);
        console.log('샘플 미팅 히스토리 데이터 생성 완료');
        
        // 다시 조회
        const [newHistory, newTotalCount] = await Promise.all([
          UserMeetingHistory.find(filter)
            .sort({ createdAt: -1 })
            .limit(parseInt(limit))
            .skip(skip)
            .lean(),
          UserMeetingHistory.countDocuments(filter)
        ]);
        
        return res.json({
          success: true,
          data: {
            history: newHistory,
            pagination: {
              currentPage: parseInt(page),
              totalPages: Math.ceil(newTotalCount / parseInt(limit)),
              totalCount: newTotalCount,
              hasNext: skip + newHistory.length < newTotalCount,
              hasPrev: parseInt(page) > 1
            }
          }
        });
      } catch (insertError) {
        console.error('샘플 데이터 생성 실패:', insertError);
        // 에러가 발생해도 빈 배열 반환
      }
    }
    
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

// 인증된 사용자의 통계 조회 (대시보드용)
router.get('/stats', auth, async (req, res) => {
  try {
    const userId = req.user.userId; // 인증된 사용자 ID
    
    console.log(`사용자 통계 조회: userId=${userId}`);
    
    const stats = await UserMeetingHistory.getUserStats(userId);
    
    console.log('통계 조회 완료:', stats);
    
    // 통계가 없는 경우 기본 통계 제공
    const finalStats = {
      totalMeetings: stats.totalMeetings || 0,
      hostCount: stats.hostCount || 0,
      participantCount: stats.participantCount || 0,
      completedMeetings: stats.completedMeetings || 0,
      avgParticipants: stats.avgParticipants || 0,
      favoriteCategories: stats.favoriteCategories || []
    };
    
    res.json({
      success: true,
      data: finalStats
    });
  } catch (error) {
    console.error('사용자 통계 조회 실패:', error);
    res.status(500).json({
      success: false,
      message: '통계 조회 중 오류가 발생했습니다.'
    });
  }
});

// 인증된 사용자의 미팅 상태 업데이트
router.patch('/history/:meetingId/status', auth, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { meetingId } = req.params;
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

// 인증된 사용자의 미팅 히스토리 삭제
router.delete('/history/:meetingId', auth, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { meetingId } = req.params;
    
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