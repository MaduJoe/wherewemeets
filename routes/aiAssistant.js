const express = require('express');
const axios = require('axios');
const { auth } = require('../middleware/auth');
const { requirePremium } = require('../middleware/subscription');
const router = express.Router();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY;

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
const CURRENT_MODEL = process.env.GEMINI_MODEL || 'flash-latest';
// const CURRENT_MODEL = process.env.GEMINI_MODEL || 'flash';
console.log(AVAILABLE_MODELS[CURRENT_MODEL]);
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${AVAILABLE_MODELS[CURRENT_MODEL]}:generateContent`; 

// 실제 장소 검색을 위한 함수들
const searchPlaces = async (query, location = '서울', radius = 5000) => {
  try {
    if (!GOOGLE_PLACES_API_KEY) {
      console.warn('Google Places API 키가 설정되지 않음. 더미 데이터 반환.');
      return {
        status: 'fallback',
        places: [
          {
            name: '검색 결과 (API 키 필요)',
            address: '실제 장소 검색을 위해서는 Google Places API 키가 필요합니다.',
            rating: 0,
            types: ['establishment'],
            businessStatus: 'OPERATIONAL'
          }
        ]
      };
    }

    const geocodeResponse = await axios.get(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(location)}&key=${GOOGLE_PLACES_API_KEY}`
    );
    
    const locationCoords = geocodeResponse.data.results[0]?.geometry?.location;
    if (!locationCoords) {
      throw new Error('위치를 찾을 수 없습니다.');
    }

    const placesResponse = await axios.get(
      `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${locationCoords.lat},${locationCoords.lng}&radius=${radius}&keyword=${encodeURIComponent(query)}&type=restaurant|cafe&key=${GOOGLE_PLACES_API_KEY}`
    );

    const places = placesResponse.data.results.slice(0, 5).map(place => ({
      name: place.name,
      address: place.vicinity || place.formatted_address,
      rating: place.rating || 0,
      priceLevel: place.price_level || 0,
      types: place.types,
      businessStatus: place.business_status,
      placeId: place.place_id,
      photoReference: place.photos?.[0]?.photo_reference
    }));

    return {
      status: 'success',
      places,
      location: locationCoords
    };

  } catch (error) {
    console.error('장소 검색 실패:', error.message);
    return {
      status: 'error',
      message: error.message,
      places: []
    };
  }
};

const getPlaceDetails = async (placeId) => {
  try {
    if (!GOOGLE_PLACES_API_KEY) {
      return { status: 'error', message: 'API 키가 필요합니다.' };
    }

    const response = await axios.get(
      `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=name,formatted_address,formatted_phone_number,website,opening_hours,price_level&key=${GOOGLE_PLACES_API_KEY}`
    );

    return {
      status: 'success',
      details: response.data.result
    };

  } catch (error) {
    console.error('장소 상세정보 실패:', error.message);
    return {
      status: 'error',
      message: error.message
    };
  }
};

// AI가 사용할 수 있는 함수들 정의
const AVAILABLE_FUNCTIONS = {
  search_places: {
    name: 'search_places',
    description: '실제 존재하는 장소를 검색합니다. 미팅 장소 추천 시 반드시 사용해야 합니다.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: '검색할 장소 키워드 (예: "카페", "레스토랑", "회의실")'
        },
        location: {
          type: 'string',
          description: '검색할 지역 (예: "강남역", "홍대", "서울")'
        },
        radius: {
          type: 'number',
          description: '검색 반경 (미터 단위, 기본값: 5000)'
        }
      },
      required: ['query', 'location']
    }
  },
  get_place_details: {
    name: 'get_place_details',
    description: '특정 장소의 상세 정보를 가져옵니다.',
    parameters: {
      type: 'object',
      properties: {
        placeId: {
          type: 'string',
          description: 'Google Places의 place_id'
        }
      },
      required: ['placeId']
    }
  }
};

// AI 도우미와 채팅 (Function Calling 지원)
router.post('/chat', auth, requirePremium, async (req, res) => {
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

    console.log('📝 사용자 메시지:', message);
    console.log('📋 컨텍스트:', JSON.stringify(context, null, 2));

    // 대화 기록 포함한 프롬프트 설정 
    const conversationHistory = context?.conversationHistory || [];
    const historyText = conversationHistory.length > 0 
      ? `\n이전 대화 기록:\n${conversationHistory.map(msg => 
          `${msg.role === 'user' ? '사용자' : 'AI'}: ${msg.content}`
        ).join('\n')}\n`
      : '';

    const systemPrompt = `당신은 한국의 미팅 장소 추천 전문 AI 도우미입니다.

중요 규칙:
- 장소를 추천할 때는 반드시 search_places 함수를 사용해 실제 존재하는 장소를 검색해야 합니다
- 추상적이거나 일반적인 답변보다는 구체적인 실제 장소를 추천하세요
- 사용자가 지역을 명시하지 않으면 "서울"을 기본값으로 사용하세요

역할과 목표:
- 이전 대화 맥락을 기억하고 연속적인 대화를 진행합니다
- 실제 검색된 장소 데이터를 바탕으로 신뢰할 수 있는 추천을 제공합니다
- 한국어로 친근하고 전문적으로 답변합니다

현재 컨텍스트: ${context ? JSON.stringify(context) : '정보 없음'}${historyText}`;

    // 1단계: Function Calling을 우선적으로 시도
    console.log('🎯 Function Calling 모드로 시작...');
    
    let requestBody = {
      contents: [{
        parts: [{ text: `${systemPrompt}\n\n사용자 질문: ${message}` }]
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

    console.log('📤 AI 요청 전송 중 (Function Calling)...');
    let response;
    let functionCallUsed = true;

    try {
      response = await axios.post(
      `${GEMINI_API_URL}?key=${GEMINI_API_KEY}`,
        requestBody,
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 30000
        }
      );
      console.log('✅ AI 응답 받음 (Function Calling 모드)');
    } catch (functionError) {
      console.log('⚠️ Function Calling 실패, 간단 모드로 폴백...');
      console.log('Function Calling 오류:', functionError.response?.data || functionError.message);
      
      // 간단한 텍스트 응답으로 폴백
      let simpleRequestBody = {
        contents: [{
          parts: [{ text: `${systemPrompt}\n\n사용자 질문: ${message}\n\n참고: 구체적인 장소명, 주소, 특징을 포함해서 답변해주세요. 실제 존재하는 장소를 추천해주세요.` }]
        }],
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.8,
          maxOutputTokens: 1500
        }
      };

      response = await axios.post(
        `${GEMINI_API_URL}?key=${GEMINI_API_KEY}`,
        simpleRequestBody,
      {
          headers: { 'Content-Type': 'application/json' },
          timeout: 30000
        }
      );
      functionCallUsed = false;
      console.log('✅ AI 응답 받음 (간단 모드 폴백)');
    }

    let candidate = response.data.candidates[0];
    
    // 2단계: AI가 함수 호출을 요청했는지 확인
    console.log('AI 응답 확인 중...');
    console.log('Candidate:', JSON.stringify(candidate, null, 2));
    
    // 모든 parts에서 functionCall 찾기
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
      
      // 3단계: 요청된 함수 실행
      try {
        if (functionCall.name === 'search_places') {
          const { query, location = '서울', radius = 5000 } = functionCall.args;
          console.log(`🔍 장소 검색 시작: query="${query}", location="${location}", radius=${radius}`);
          functionResult = await searchPlaces(query, location, radius);
        } else if (functionCall.name === 'get_place_details') {
          const { placeId } = functionCall.args;
          console.log(`📍 장소 상세정보 조회: placeId="${placeId}"`);
          functionResult = await getPlaceDetails(placeId);
        } else {
          functionResult = { status: 'error', message: '지원하지 않는 함수입니다.' };
        }
      } catch (error) {
        console.error('❌ 함수 실행 중 오류:', error);
        functionResult = { status: 'error', message: error.message };
      }

      console.log('✅ 함수 실행 결과:', JSON.stringify(functionResult, null, 2));

      // 4단계: 함수 결과를 AI에게 다시 전달
      requestBody = {
        contents: [
          {
            parts: [{ text: `${systemPrompt}\n\n사용자 질문: ${message}` }],
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

      console.log('📤 함수 결과와 함께 AI에게 재요청...');
      console.log('Request Body:', JSON.stringify(requestBody, null, 2));
      
      try {
        response = await axios.post(
          `${GEMINI_API_URL}?key=${GEMINI_API_KEY}`,
          requestBody,
          {
            headers: { 'Content-Type': 'application/json' }
          }
        );

        console.log('📥 AI 재응답 받음:', JSON.stringify(response.data, null, 2));
        candidate = response.data.candidates[0];
      } catch (error) {
        console.error('❌ AI 재요청 실패:', error.response?.data || error.message);
        throw error;
      }
    }

    // 5단계: 최종 AI 응답 반환
    console.log('🎯 최종 응답 처리 중...');
    console.log('Final Candidate:', JSON.stringify(candidate, null, 2));
    
    let aiResponse;
    let usedFunctionCalls = false;
    
    // 텍스트 응답 찾기
    let textResponse = '';
    let hasFunctionCall = false;
    
    for (const part of candidate.content?.parts || []) {
      if (part.text) {
        textResponse += part.text;
      }
      if (part.functionCall) {
        hasFunctionCall = true;
      }
    }
    
    if (textResponse) {
      aiResponse = textResponse;
      console.log('✅ 텍스트 응답 발견:', aiResponse.substring(0, 100) + '...');
      if (hasFunctionCall) {
        usedFunctionCalls = true;
        console.log('⚠️ Function Call도 함께 있었지만 텍스트만 반환 (Function Call 미실행)');
      }
    } else if (hasFunctionCall) {
      usedFunctionCalls = true;
      aiResponse = '죄송합니다. 함수 호출 후 응답 생성에 실패했습니다. 다시 시도해주세요.';
      console.log('⚠️ 함수 호출만 있고 텍스트 응답 없음');
    } else {
      // 폴백: Function Calling 없이 일반 응답 시도
      console.log('🔄 폴백 모드: Function Calling 없이 일반 응답 시도');
      try {
        const fallbackRequest = {
          contents: [{
            parts: [{ text: `${systemPrompt}\n\n사용자 질문: ${message}\n\n참고: 구체적인 장소명, 주소, 특징을 포함해서 답변해주세요.` }]
          }],
          generationConfig: {
            temperature: 0.7,
            topK: 40,
            topP: 0.8,
            maxOutputTokens: 1000
          }
        };

        const fallbackResponse = await axios.post(
          `${GEMINI_API_URL}?key=${GEMINI_API_KEY}`,
          fallbackRequest,
          {
            headers: { 'Content-Type': 'application/json' }
          }
        );

        aiResponse = fallbackResponse.data.candidates[0]?.content?.parts[0]?.text || 
                    '죄송합니다. 응답을 생성할 수 없습니다.';
        console.log('✅ 폴백 응답 성공:', aiResponse.substring(0, 100) + '...');
      } catch (error) {
        console.error('❌ 폴백 응답도 실패:', error.message);
        aiResponse = '죄송합니다. 일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요.';
      }
    }

    console.log('📝 최종 AI 응답:', aiResponse);

    res.json({
      success: true,
      data: {
        response: aiResponse,
        timestamp: new Date(),
        context: context,
        usedFunctionCalls: usedFunctionCalls,
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
