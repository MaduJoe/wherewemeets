const express = require('express');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const { auth } = require('../middleware/auth');
const { requirePremium } = require('../middleware/subscription');
const User = require('../models/User');
const router = express.Router();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// 환경변수 디버깅용 테스트 엔드포인트
router.get('/test', (req, res) => {
  console.log('AI Assistant 테스트 엔드포인트 호출됨');
  res.json({
    success: true,
    message: 'AI Assistant API 정상 작동',
    environment: {
      GEMINI_API_KEY: GEMINI_API_KEY ? '설정됨' : '설정안됨',
      NODE_ENV: process.env.NODE_ENV
    }
  });
});

// 사용 가능한 Gemini 모델들
const AVAILABLE_MODELS = {
  'flash-latest': 'gemini-1.5-flash-latest',
  'flash': 'gemini-1.5-flash',
  'flash-001': 'gemini-1.5-flash-001', 
  'flash-002': 'gemini-1.5-flash-002',
  'pro': 'gemini-1.5-pro',
  'pro-001': 'gemini-1.5-pro-001',
  'pro-002': 'gemini-1.5-pro-002',
  '2.5-flash': 'gemini-2.5-flash-preview-05-20',
  '2.5-pro': 'gemini-2.5-pro-preview-06-05',
  '2.0-flash': 'gemini-2.0-flash'
};

// 현재 사용할 모델 (환경변수로 변경 가능)
// const CURRENT_MODEL = process.env.GEMINI_MODEL || 'flash-latest';
const CURRENT_MODEL = process.env.GEMINI_MODEL || '2.0-flash';
console.log(AVAILABLE_MODELS[CURRENT_MODEL]);
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${AVAILABLE_MODELS[CURRENT_MODEL]}:generateContent`; 





// AI 도우미와 채팅 (Gemini API만 사용) - 게스트도 허용
router.post('/chat', async (req, res) => {
  console.log('🚀 AI Assistant 요청 받음!');
  console.log('Request body:', JSON.stringify(req.body, null, 2));
  console.log('현재 모델:', CURRENT_MODEL, '->', AVAILABLE_MODELS[CURRENT_MODEL]);
  
  try {
    const { message, context } = req.body;

    if (!message) {
      console.log('❌ 메시지가 없음');
      return res.status(400).json({
        success: false,
        message: '메시지가 필요합니다.'
      });
    }

    // 사용자 정보 가져오기 (게스트는 선택사항)
    let user = null;
    let isGuest = true;
    
    // Authorization 헤더가 있으면 사용자 인증 시도
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const token = authHeader.substring(7);
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        user = await User.findById(decoded.userId);
        if (user) {
          isGuest = false;
        }
      } catch (error) {
        console.log('토큰 검증 실패, 게스트로 처리:', error.message);
      }
    }

    // 장소 추천 요청인지 확인 (키워드 기반)
    const isPlaceRecommendation = message.toLowerCase().includes('추천') || 
                                 message.toLowerCase().includes('장소') ||
                                 message.toLowerCase().includes('곳') ||
                                 message.toLowerCase().includes('카페') ||
                                 message.toLowerCase().includes('음식점') ||
                                 message.toLowerCase().includes('레스토랑') ||
                                 message.toLowerCase().includes('맛집') ||
                                 message.toLowerCase().includes('공원') ||
                                 message.toLowerCase().includes('만날') ||
                                 message.toLowerCase().includes('미팅') ||
                                 context?.isPlaceRecommendation;

    // 로그인 사용자의 경우 AI 추천 사용 제한 확인
    if (isPlaceRecommendation && !isGuest && user) {
      const usageStatus = user.canUseAIRecommendation();
      console.log('AI 추천 사용 상태:', usageStatus);
      
      if (!usageStatus.canUse) {
        return res.status(403).json({
          success: false,
          message: '무료 사용자는 AI 장소 추천을 5회만 이용할 수 있습니다. 프리미엄으로 업그레이드하여 무제한 이용하세요!',
          data: {
            usageLimit: true,
            used: usageStatus.used,
            limit: usageStatus.limit,
            remaining: usageStatus.remaining
          }
        });
      }
    }

    console.log('📝 사용자 메시지:', message);
    console.log('📋 컨텍스트:', JSON.stringify(context, null, 2));

    // 대화 기록 포함한 프롬프트 설정 
    const conversationHistory = context?.conversationHistory || [];
    const historyText = conversationHistory.length > 0 
      ? `\n이전 대화 기록:\n${conversationHistory.map(msg => 
          `${msg.role === 'user' ? '사용자' : 'AI'}: ${msg.content}`
        ).join('\n')}\n`
      : '';

    // 단순화된 시스템 프롬프트 (Function Calling 제거)
    const systemPrompt = `당신은 한국의 미팅 장소 추천 전문 AI 도우미입니다.

🇰🇷 한국 장소 전문가:
- 서울, 부산, 대구, 인천, 광주, 대전, 울산 등 주요 도시의 인기 장소들을 잘 알고 있습니다
- 실제 존재하는 유명한 카페, 레스토랑, 브런치, 카페, 문화공간 등을 추천할 수 있습니다
- 지역별 특색있는 장소와 분위기를 고려한 추천이 가능합니다

📝 응답 형식 (반드시 준수):
장소 추천 시 다음 형식을 사용하세요:

1. **장소명**: 간단한 설명 (1줄)
2. **장소명**: 간단한 설명 (1줄) 
3. **장소명**: 간단한 설명 (1줄)

⚠️ 중요 규칙:
- 각 장소당 1줄로 간결하게 작성하세요
- 전화번호, 주소, URL은 표시하지 마세요
- 마크다운 bold 형식(**장소명**)을 사용하세요
- 장소 설명은 분위기나 특징을 한 문장으로만 작성하세요
- 불필요한 부가 설명이나 긴 문장은 피하세요
- 실제 존재하는 유명한 장소들을 추천하세요

🎯 목표:
- 간결하고 읽기 쉬운 추천 목록 제공
- 사용자의 요구사항에 맞는 적절한 장소 추천
- 자연스럽고 친근한 대화체

현재 컨텍스트: ${context ? JSON.stringify(context) : '정보 없음'}${historyText}`;

    // Gemini API 직접 호출 (Function Calling 없음)
    console.log('📤 Gemini API 직접 호출...');
    
    const requestBody = {
      contents: [{
        parts: [{ text: `${systemPrompt}\n\n사용자 질문: ${message}` }]
      }],
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.8,
        maxOutputTokens: 1000
      }
    };

    const response = await axios.post(
      `${GEMINI_API_URL}?key=${GEMINI_API_KEY}`,
      requestBody,
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 15000
      }
    );

    console.log('✅ Gemini API 응답 받음');
    
    const candidate = response.data.candidates[0];
    const aiResponse = candidate?.content?.parts[0]?.text || '죄송합니다. 응답을 생성할 수 없습니다.';

    console.log('📝 AI 응답:', aiResponse.substring(0, 100) + '...');

    // 로그인 사용자의 경우 장소 추천 성공 시 사용 횟수 증가
    if (isPlaceRecommendation && aiResponse && aiResponse.length > 0 && !isGuest && user) {
      try {
        await user.incrementAIRecommendationUsage();
        console.log('✅ AI 추천 사용 횟수 증가:', user.analytics.aiRecommendationUsage);
      } catch (error) {
        console.error('⚠️ AI 추천 사용 횟수 증가 실패:', error);
      }
    }

    res.json({
      success: true,
      data: {
        response: aiResponse,
        timestamp: new Date(),
        context: context,
        usedFunctionCalls: false, // Function Calling 사용하지 않음
        debug: process.env.NODE_ENV === 'development' ? {
          candidateContent: candidate.content
        } : undefined
      }
    });

  } catch (error) {
    console.error('AI 도우미 에러:', error.response?.data || error.message);
    
    if (error.response?.status === 400) {
      return res.status(400).json({
        success: false,
        message: 'AI 요청이 올바르지 않습니다.',
        error: error.response.data
      });
    }
    
    if (error.response?.status === 403) {
      return res.status(403).json({
        success: false,
        message: 'API 키 권한이 없습니다.'
      });
    }

    res.status(500).json({
      success: false,
      message: 'AI 도우미 서비스에 일시적인 문제가 발생했습니다.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// AI 도우미 상태 확인
router.get('/status', (req, res) => {
  res.json({
    success: true,
    data: {
      status: 'active',
      currentModel: AVAILABLE_MODELS[CURRENT_MODEL],
      modelKey: CURRENT_MODEL,
      availableModels: AVAILABLE_MODELS,
      features: [
        '실시간 대화',
        '장소 추천',
        '상황별 조언',
        '다양한 카테고리 지원'
      ]
    }
  });
});

// AI 장소 추천 (기존 프론트엔드 호환용) - 게스트도 허용
router.post('/recommend-places', async (req, res) => {
  console.log('🚀 AI 장소 추천 요청 받음!');
  console.log('Request body:', JSON.stringify(req.body, null, 2));
  
  try {
    const { preferences } = req.body;

    if (!preferences) {
      return res.status(400).json({
        success: false,
        message: '추천 설정이 필요합니다.'
      });
    }

        // 사용자 정보 가져오기 (게스트는 선택사항)
    let user = null;
    let isGuest = true;
    
    // Authorization 헤더가 있으면 사용자 인증 시도
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const token = authHeader.substring(7);
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        user = await User.findById(decoded.id);
        if (user) {
          isGuest = false;
        }
      } catch (error) {
        console.log('토큰 검증 실패, 게스트로 처리:', error.message);
      }
    }

    // 로그인 사용자의 경우 사용 제한 확인
    if (!isGuest && user) {
      const usageStatus = user.canUseAIRecommendation();
      console.log('AI 추천 사용 상태:', usageStatus);
      
      if (!usageStatus.canUse) {
        return res.status(403).json({
          success: false,
          message: '무료 사용자는 AI 장소 추천을 5회만 이용할 수 있습니다. 프리미엄으로 업그레이드하여 무제한 이용하세요!',
          data: {
            usageLimit: true,
            used: usageStatus.used,
            limit: usageStatus.limit,
            remaining: usageStatus.remaining
          }
        });
      }
    }

    // 장소 추천 메시지 생성
    const message = `다음 조건에 맞는 장소를 추천해주세요:
- 위치: ${preferences.location || '서울'}
- 인원: ${preferences.participants || '2-4명'}
- 예산: ${preferences.budget || '중간'}
- 목적: ${preferences.purpose || '친목'}
- 카테고리: ${preferences.category || '음식점'}
- 교통수단: ${preferences.transportMode || '자가용'}
- 최대거리: ${preferences.maxDistance || 30}km`;

    // AI 채팅 API 로직 재사용
    const systemPrompt = `당신은 한국의 미팅 장소 추천 전문 AI 도우미입니다.

중요 규칙:
- 장소를 추천할 때는 반드시 search_places 함수를 사용해 실제 존재하는 장소를 검색해야 합니다
- 추상적이거나 일반적인 답변보다는 구체적인 실제 장소를 추천하세요
- 사용자가 지역을 명시하지 않으면 "서울"을 기본값으로 사용하세요

역할과 목표:
- 실제 검색된 장소 데이터를 바탕으로 신뢰할 수 있는 추천을 제공합니다
- 한국어로 친근하고 전문적으로 답변합니다`;

    // Function Calling을 통한 AI 요청
    let requestBody = {
      contents: [{
        parts: [{ text: `${systemPrompt}\n\n사용자 요청: ${message}` }]
      }],
      tools: [{
        function_declarations: Object.values(AVAILABLE_FUNCTIONS)
      }],
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.8,
        maxOutputTokens: 1500
      }
    };

    console.log('📤 AI 요청 전송 중...');
    let response = await axios.post(
      `${GEMINI_API_URL}?key=${GEMINI_API_KEY}`,
      requestBody,
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 30000
      }
    );

    let candidate = response.data.candidates[0];
    
    // Function Call 처리
    let functionCall = null;
    for (const part of candidate.content?.parts || []) {
      if (part.functionCall) {
        functionCall = part.functionCall;
        break;
      }
    }
    
    if (functionCall) {
      console.log('🔧 AI가 함수 호출 요청:', functionCall.name, functionCall.args);
      
      let functionResult;
      try {
        if (functionCall.name === 'search_places') {
          const { query, location = '서울', radius = 5000 } = functionCall.args;
          functionResult = await searchPlaces(query, location, radius);
        } else {
          functionResult = { status: 'error', message: '지원하지 않는 함수입니다.' };
        }
      } catch (error) {
        functionResult = { status: 'error', message: error.message };
      }

      // 함수 결과를 AI에게 다시 전달
      requestBody = {
        contents: [
          {
            parts: [{ text: `${systemPrompt}\n\n사용자 요청: ${message}` }],
            role: 'user'
          },
          {
            parts: [{ functionCall: functionCall }],
            role: 'model'
          },
          {
            parts: [{
              functionResponse: {
                name: functionCall.name,
                response: functionResult
              }
            }],
            role: 'function'
          }
        ],
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.8,
          maxOutputTokens: 1500
        }
      };

      response = await axios.post(
        `${GEMINI_API_URL}?key=${GEMINI_API_KEY}`,
        requestBody,
        {
          headers: { 'Content-Type': 'application/json' }
        }
      );
      candidate = response.data.candidates[0];
    }

    // 최종 응답 처리
    let aiResponse = '';
    for (const part of candidate.content?.parts || []) {
      if (part.text) {
        aiResponse += part.text;
      }
    }

    if (!aiResponse) {
      aiResponse = '죄송합니다. 장소 추천을 생성할 수 없습니다.';
    }

    // 로그인 사용자의 경우 사용 횟수 증가
    if (!isGuest && user) {
      try {
        await user.incrementAIRecommendationUsage();
        console.log('✅ AI 추천 사용 횟수 증가:', user.analytics.aiRecommendationUsage);
      } catch (error) {
        console.error('⚠️ AI 추천 사용 횟수 증가 실패:', error);
      }
    }

    // 응답 형식을 기존 프론트엔드와 호환되도록 변환
    res.json({
      success: true,
      data: {
        recommendations: {
          rawText: aiResponse,
          places: [] // 실제 파싱 로직은 프론트엔드에서 처리
        },
        note: '실제 장소 검색 결과를 바탕으로 추천되었습니다.',
        usageInfo: !isGuest && user ? {
          used: user.analytics.aiRecommendationUsage,
          remaining: user.canUseAIRecommendation().remaining
        } : null
      }
    });

  } catch (error) {
    console.error('AI 장소 추천 에러:', error.response?.data || error.message);
    
    res.status(500).json({
      success: false,
      message: 'AI 장소 추천 서비스에 일시적인 문제가 발생했습니다.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// 모델 테스트 엔드포인트
router.post('/test-model', auth, requirePremium, async (req, res) => {
  try {
    const { modelKey } = req.body;
    
    if (!modelKey || !AVAILABLE_MODELS[modelKey]) {
      return res.status(400).json({
        success: false,
        message: '유효하지 않은 모델입니다.',
        availableModels: Object.keys(AVAILABLE_MODELS)
      });
    }

    const testUrl = `https://generativelanguage.googleapis.com/v1beta/models/${AVAILABLE_MODELS[modelKey]}:generateContent`;

    const response = await axios.post(
      `${testUrl}?key=${GEMINI_API_KEY}`,
      {
        contents: [{
          parts: [{
            text: '안녕하세요! 간단한 테스트 메시지입니다.'
          }]
        }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 100
        }
      },
      {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 10000
      }
    );

    res.json({
      success: true,
      message: `${AVAILABLE_MODELS[modelKey]} 모델이 정상 작동합니다.`,
      modelResponse: response.data.candidates[0]?.content?.parts[0]?.text || 'No response'
    });

  } catch (error) {
    console.error(`모델 테스트 실패 (${modelKey}):`, error.response?.data || error.message);
    
    res.json({
      success: false,
      message: `${modelKey} 모델 테스트 실패`,
      error: error.response?.data || error.message,
      statusCode: error.response?.status
    });
  }
});

module.exports = router; 
