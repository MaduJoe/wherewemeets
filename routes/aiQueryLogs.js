const express = require('express');
const router = express.Router();
const AIQueryLog = require('../models/AIQueryLog');
const { auth } = require('../middleware/auth');

// AI 질의 로그 저장
router.post('/log', async (req, res) => {
  try {
    const {
      userId,
      userType,
      sessionId,
      query,
      queryType,
      context,
      response,
      responseTime,
      aiModel,
      success = true,
      errorMessage,
      tokenUsed,
      sentiment,
      category,
      tags
    } = req.body;

    // 필수 필드 검증
    if (!userId || !userType || !sessionId || !query || !queryType || !response) {
      return res.status(400).json({
        success: false,
        message: '필수 필드가 누락되었습니다.'
      });
    }

    // IP 주소와 User Agent 수집
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.get('User-Agent');

    const logData = {
      userId,
      userType,
      sessionId,
      query,
      queryType,
      context,
      response,
      responseTime: responseTime || 0,
      aiModel: aiModel || 'gpt-3.5-turbo',
      success,
      errorMessage,
      tokenUsed,
      sentiment,
      category,
      tags,
      ipAddress,
      userAgent,
      platform: 'web'
    };

    const aiQueryLog = new AIQueryLog(logData);
    await aiQueryLog.save();

    res.status(201).json({
      success: true,
      message: 'AI 질의 로그가 저장되었습니다.',
      logId: aiQueryLog._id
    });

  } catch (error) {
    console.error('AI 질의 로그 저장 실패:', error);
    res.status(500).json({
      success: false,
      message: '서버 오류가 발생했습니다.'
    });
  }
});

// 사용자 피드백 업데이트
router.patch('/feedback/:logId', async (req, res) => {
  try {
    const { logId } = req.params;
    const { userRating, userFeedback } = req.body;

    if (!userRating && !userFeedback) {
      return res.status(400).json({
        success: false,
        message: '평점 또는 피드백이 필요합니다.'
      });
    }

    const updateData = {};
    if (userRating) updateData.userRating = userRating;
    if (userFeedback) updateData.userFeedback = userFeedback;
    updateData.updatedAt = new Date();

    const updatedLog = await AIQueryLog.findByIdAndUpdate(
      logId,
      updateData,
      { new: true }
    );

    if (!updatedLog) {
      return res.status(404).json({
        success: false,
        message: '로그를 찾을 수 없습니다.'
      });
    }

    res.json({
      success: true,
      message: '피드백이 저장되었습니다.',
      data: updatedLog.getSafeData()
    });

  } catch (error) {
    console.error('피드백 업데이트 실패:', error);
    res.status(500).json({
      success: false,
      message: '서버 오류가 발생했습니다.'
    });
  }
});

// 운영자용 AI 질의 로그 조회 (관리자 권한 필요)
router.get('/admin/logs', auth, async (req, res) => {
  try {
    // 관리자 권한 확인 (추후 관리자 권한 시스템 구축 시 수정)
    if (!req.user || req.user.email !== 'admin@wherewemeets.com') {
      return res.status(403).json({
        success: false,
        message: '관리자 권한이 필요합니다.'
      });
    }

    const {
      page = 1,
      limit = 50,
      queryType,
      userType,
      success,
      startDate,
      endDate,
      search
    } = req.query;

    // 필터 조건 구성
    const filter = {};
    
    if (queryType) filter.queryType = queryType;
    if (userType) filter.userType = userType;
    if (success !== undefined) filter.success = success === 'true';
    
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    if (search) {
      filter.$or = [
        { query: { $regex: search, $options: 'i' } },
        { response: { $regex: search, $options: 'i' } },
        { category: { $regex: search, $options: 'i' } }
      ];
    }

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      sort: { createdAt: -1 },
      select: '-ipAddress -userAgent' // 민감한 정보 제외
    };

    const logs = await AIQueryLog.find(filter)
      .sort(options.sort)
      .limit(options.limit)
      .skip((options.page - 1) * options.limit)
      .lean();

    const totalCount = await AIQueryLog.countDocuments(filter);
    const totalPages = Math.ceil(totalCount / options.limit);

    res.json({
      success: true,
      data: {
        logs,
        pagination: {
          currentPage: options.page,
          totalPages,
          totalCount,
          hasNext: options.page < totalPages,
          hasPrev: options.page > 1
        }
      }
    });

  } catch (error) {
    console.error('AI 질의 로그 조회 실패:', error);
    res.status(500).json({
      success: false,
      message: '서버 오류가 발생했습니다.'
    });
  }
});

// 운영자용 AI 질의 통계 조회
router.get('/admin/stats', auth, async (req, res) => {
  try {
    // 관리자 권한 확인
    if (!req.user || req.user.email !== 'admin@wherewemeets.com') {
      return res.status(403).json({
        success: false,
        message: '관리자 권한이 필요합니다.'
      });
    }

    const { startDate, endDate } = req.query;
    const dateRange = {};
    
    if (startDate) dateRange.startDate = new Date(startDate);
    if (endDate) dateRange.endDate = new Date(endDate);

    // 기본 통계
    const stats = await AIQueryLog.getQueryStats(dateRange);

    // 전체 통계
    const totalStats = await AIQueryLog.aggregate([
      {
        $match: {
          createdAt: {
            $gte: dateRange.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
            $lte: dateRange.endDate || new Date()
          }
        }
      },
      {
        $group: {
          _id: null,
          totalQueries: { $sum: 1 },
          uniqueUsers: { $addToSet: "$userId" },
          avgResponseTime: { $avg: "$responseTime" },
          successRate: { 
            $avg: { $cond: [{ $eq: ["$success", true] }, 1, 0] }
          },
          queryTypeDistribution: {
            $push: "$queryType"
          },
          userTypeDistribution: {
            $push: "$userType"
          }
        }
      },
      {
        $project: {
          _id: 0,
          totalQueries: 1,
          uniqueUserCount: { $size: "$uniqueUsers" },
          avgResponseTime: { $round: ["$avgResponseTime", 2] },
          successRate: { $multiply: ["$successRate", 100] },
          queryTypeDistribution: 1,
          userTypeDistribution: 1
        }
      }
    ]);

    // 인기 질의 카테고리
    const popularCategories = await AIQueryLog.aggregate([
      {
        $match: {
          createdAt: {
            $gte: dateRange.startDate || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
            $lte: dateRange.endDate || new Date()
          },
          category: { $exists: true, $ne: null }
        }
      },
      {
        $group: {
          _id: "$category",
          count: { $sum: 1 }
        }
      },
      {
        $sort: { count: -1 }
      },
      {
        $limit: 10
      }
    ]);

    res.json({
      success: true,
      data: {
        dailyStats: stats,
        overallStats: totalStats[0] || {},
        popularCategories
      }
    });

  } catch (error) {
    console.error('AI 질의 통계 조회 실패:', error);
    res.status(500).json({
      success: false,
      message: '서버 오류가 발생했습니다.'
    });
  }
});

// 자주 묻는 질문 분석
router.get('/admin/frequent-queries', auth, async (req, res) => {
  try {
    // 관리자 권한 확인
    if (!req.user || req.user.email !== 'admin@wherewemeets.com') {
      return res.status(403).json({
        success: false,
        message: '관리자 권한이 필요합니다.'
      });
    }

    const { limit = 20, days = 30 } = req.query;

    const frequentQueries = await AIQueryLog.aggregate([
      {
        $match: {
          createdAt: {
            $gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000)
          },
          success: true
        }
      },
      {
        $group: {
          _id: {
            // 질의를 정규화하여 그룹핑 (소문자, 공백 정리)
            normalizedQuery: {
              $toLower: {
                $trim: { input: "$query" }
              }
            }
          },
          originalQuery: { $first: "$query" },
          count: { $sum: 1 },
          queryType: { $first: "$queryType" },
          avgResponseTime: { $avg: "$responseTime" },
          avgRating: { $avg: "$userRating" },
          lastAsked: { $max: "$createdAt" }
        }
      },
      {
        $sort: { count: -1 }
      },
      {
        $limit: parseInt(limit)
      },
      {
        $project: {
          _id: 0,
          query: "$originalQuery",
          count: 1,
          queryType: 1,
          avgResponseTime: { $round: ["$avgResponseTime", 2] },
          avgRating: { $round: ["$avgRating", 1] },
          lastAsked: 1
        }
      }
    ]);

    res.json({
      success: true,
      data: frequentQueries
    });

  } catch (error) {
    console.error('자주 묻는 질문 분석 실패:', error);
    res.status(500).json({
      success: false,
      message: '서버 오류가 발생했습니다.'
    });
  }
});

module.exports = router; 