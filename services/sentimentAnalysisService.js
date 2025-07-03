const axios = require('axios');

class SentimentAnalysisService {
  constructor() {
    this.emotionalKeywords = {
      // 분위기 관련 키워드
      atmosphere: {
        positive: ['분위기', '좋은', '아늑한', '편안한', '멋진', '로맨틱', '따뜻한', '차분한', '고급스러운', '세련된'],
        negative: ['시끄러운', '불편한', '답답한', '어수선한', '복잡한']
      },
      // 음식 관련 키워드  
      food: {
        positive: ['맛있는', '신선한', '고급', '정성스러운', '맛집', '유명한', '인기있는'],
        negative: ['맛없는', '별로', '실망', '비싼', '짠', '달다']
      },
      // 서비스 관련 키워드
      service: {
        positive: ['친절한', '빠른', '정확한', '세심한', '프로페셔널'],
        negative: ['불친절', '느린', '서비스 안좋음', '무례한']
      },
      // 가격 관련 키워드
      price: {
        positive: ['가성비', '저렴한', '합리적', '적당한'],
        negative: ['비싼', '비쌈', '가격대비']
      },
      // 위치/접근성 관련 키워드
      location: {
        positive: ['접근성', '편리한', '가까운', '찾기쉬운', '주차'],
        negative: ['불편한', '멀다', '찾기어려움', '주차어려움']
      }
    };
  }

  /**
   * 사용자 입력에서 감성 키워드를 추출
   * @param {string} userInput - 사용자 입력 텍스트
   * @returns {Object} - 감성 키워드 분석 결과
   */
  extractEmotionalKeywords(userInput) {
    const foundKeywords = {
      atmosphere: [],
      food: [],
      service: [],
      price: [],
      location: [],
      overall_sentiment: 'neutral'
    };

    let positiveScore = 0;
    let negativeScore = 0;

    // 각 카테고리별로 키워드 검색
    Object.keys(this.emotionalKeywords).forEach(category => {
      const categoryKeywords = this.emotionalKeywords[category];
      
      // 긍정적 키워드 검색
      categoryKeywords.positive.forEach(keyword => {
        if (userInput.includes(keyword)) {
          foundKeywords[category].push({
            keyword,
            sentiment: 'positive',
            relevance_score: this.calculateRelevanceScore(keyword, userInput)
          });
          positiveScore += 1;
        }
      });

      // 부정적 키워드 검색
      categoryKeywords.negative.forEach(keyword => {
        if (userInput.includes(keyword)) {
          foundKeywords[category].push({
            keyword,
            sentiment: 'negative',
            relevance_score: this.calculateRelevanceScore(keyword, userInput)
          });
          negativeScore += 1;
        }
      });
    });

    // 전체적인 감성 점수 계산
    if (positiveScore > negativeScore) {
      foundKeywords.overall_sentiment = 'positive';
    } else if (negativeScore > positiveScore) {
      foundKeywords.overall_sentiment = 'negative';
    }

    foundKeywords.sentiment_score = positiveScore - negativeScore;

    return foundKeywords;
  }

  /**
   * 키워드의 관련성 점수 계산
   * @param {string} keyword - 키워드
   * @param {string} text - 전체 텍스트
   * @returns {number} - 관련성 점수 (0-1)
   */
  calculateRelevanceScore(keyword, text) {
    const keywordCount = (text.match(new RegExp(keyword, 'g')) || []).length;
    const totalWords = text.split(' ').length;
    return Math.min(keywordCount / totalWords * 10, 1); // 0-1 사이로 정규화
  }

  /**
   * Google Maps API 리뷰에서 감성 키워드 매칭
   * @param {Array} reviews - Google Maps API에서 가져온 리뷰 배열
   * @param {Object} targetKeywords - 찾고자 하는 감성 키워드
   * @returns {Object} - 매칭 결과와 점수
   */
  analyzeReviewsForKeywords(reviews, targetKeywords) {
    if (!reviews || reviews.length === 0) {
      return {
        matching_score: 0,
        matched_reviews: [],
        keyword_frequency: {},
        sentiment_distribution: { positive: 0, negative: 0, neutral: 0 }
      };
    }

    const matchedReviews = [];
    const keywordFrequency = {};
    const sentimentDistribution = { positive: 0, negative: 0, neutral: 0 };

    reviews.forEach(review => {
      const reviewText = review.comment || review.text || '';
      const reviewMatches = [];
      let reviewScore = 0;

      // 각 카테고리의 키워드들을 리뷰에서 검색
      Object.keys(targetKeywords).forEach(category => {
        if (targetKeywords[category] && targetKeywords[category].length > 0) {
          targetKeywords[category].forEach(keywordObj => {
            const keyword = keywordObj.keyword;
            if (reviewText.includes(keyword)) {
              reviewMatches.push({
                keyword,
                category,
                sentiment: keywordObj.sentiment,
                context: this.extractContext(reviewText, keyword)
              });

              // 키워드 빈도 계산
              keywordFrequency[keyword] = (keywordFrequency[keyword] || 0) + 1;

              // 점수 계산 (긍정 키워드 +1, 부정 키워드 -1)
              reviewScore += keywordObj.sentiment === 'positive' ? 1 : -1;
            }
          });
        }
      });

      if (reviewMatches.length > 0) {
        matchedReviews.push({
          ...review,
          matched_keywords: reviewMatches,
          review_score: reviewScore
        });

        // 감성 분포 계산
        if (reviewScore > 0) sentimentDistribution.positive++;
        else if (reviewScore < 0) sentimentDistribution.negative++;
        else sentimentDistribution.neutral++;
      }
    });

    // 전체 매칭 점수 계산
    const totalMatches = matchedReviews.length;
    const totalReviews = reviews.length;
    const matchingScore = totalReviews > 0 ? (totalMatches / totalReviews) * 100 : 0;

    return {
      matching_score: Math.round(matchingScore * 100) / 100,
      matched_reviews: matchedReviews.slice(0, 5), // 상위 5개만 반환
      keyword_frequency: keywordFrequency,
      sentiment_distribution: sentimentDistribution,
      total_reviews_analyzed: totalReviews,
      matched_reviews_count: totalMatches
    };
  }

  /**
   * 키워드 주변 문맥 추출
   * @param {string} text - 전체 텍스트
   * @param {string} keyword - 키워드
   * @returns {string} - 키워드 주변 문맥
   */
  extractContext(text, keyword) {
    const keywordIndex = text.indexOf(keyword);
    if (keywordIndex === -1) return '';

    const start = Math.max(0, keywordIndex - 20);
    const end = Math.min(text.length, keywordIndex + keyword.length + 20);
    
    return '...' + text.substring(start, end) + '...';
  }

  /**
   * 장소별 감성 점수 계산
   * @param {Object} place - 장소 정보
   * @param {Object} targetKeywords - 목표 감성 키워드
   * @returns {Object} - 감성 분석 결과가 포함된 장소 정보
   */
  calculatePlaceSentimentScore(place, targetKeywords) {
    if (!place.reviews || place.reviews.length === 0) {
      return {
        ...place,
        sentiment_analysis: {
          score: 0,
          confidence: 0,
          matched_keywords: [],
          recommendation_reason: '리뷰 정보가 없어 분석할 수 없습니다.'
        }
      };
    }

    const analysisResult = this.analyzeReviewsForKeywords(place.reviews, targetKeywords);
    
    // 감성 점수 계산 (0-100 스케일)
    const sentimentScore = this.calculateFinalSentimentScore(analysisResult, place);
    
    // 추천 이유 생성
    const recommendationReason = this.generateRecommendationReason(analysisResult, targetKeywords);

    return {
      ...place,
      sentiment_analysis: {
        score: sentimentScore,
        confidence: analysisResult.matching_score,
        matched_keywords: Object.keys(analysisResult.keyword_frequency),
        keyword_frequency: analysisResult.keyword_frequency,
        sentiment_distribution: analysisResult.sentiment_distribution,
        recommendation_reason: recommendationReason,
        matched_reviews_count: analysisResult.matched_reviews_count
      }
    };
  }

  /**
   * 최종 감성 점수 계산
   * @param {Object} analysisResult - 리뷰 분석 결과
   * @param {Object} place - 장소 정보
   * @returns {number} - 최종 감성 점수 (0-100)
   */
  calculateFinalSentimentScore(analysisResult, place) {
    let score = 0;

    // 매칭 점수 기여도 (40%)
    score += analysisResult.matching_score * 0.4;

    // 감성 분포 기여도 (30%)
    const { positive, negative, neutral } = analysisResult.sentiment_distribution;
    const total = positive + negative + neutral;
    if (total > 0) {
      const positiveRatio = positive / total;
      const negativeRatio = negative / total;
      score += (positiveRatio - negativeRatio) * 50 * 0.3; // -50 ~ +50 범위를 0.3 가중치로
    }

    // Google 평점 기여도 (20%)
    if (place.rating) {
      score += (place.rating / 5) * 100 * 0.2;
    }

    // 리뷰 수 기여도 (10%) - 많은 리뷰가 있으면 신뢰도 증가
    const reviewBonus = Math.min(place.reviewCount / 50, 1) * 10 * 0.1;
    score += reviewBonus;

    return Math.max(0, Math.min(100, Math.round(score)));
  }

  /**
   * 추천 이유 생성
   * @param {Object} analysisResult - 분석 결과
   * @param {Object} targetKeywords - 목표 키워드
   * @returns {string} - 추천 이유 텍스트
   */
  generateRecommendationReason(analysisResult, targetKeywords) {
    const { keyword_frequency, sentiment_distribution, matched_reviews_count } = analysisResult;
    
    if (matched_reviews_count === 0) {
      return '해당 키워드와 관련된 리뷰를 찾지 못했습니다.';
    }

    const topKeywords = Object.entries(keyword_frequency)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .map(([keyword]) => keyword);

    let reason = `${matched_reviews_count}개의 리뷰에서 `;
    
    if (topKeywords.length > 0) {
      reason += `"${topKeywords.join('", "')}" 등의 키워드가 언급되었습니다. `;
    }

    if (sentiment_distribution.positive > sentiment_distribution.negative) {
      reason += '대부분 긍정적인 평가를 받고 있어 추천드립니다.';
    } else if (sentiment_distribution.negative > sentiment_distribution.positive) {
      reason += '일부 부정적인 의견도 있으니 참고하시기 바랍니다.';
    } else {
      reason += '다양한 의견이 있으니 개인 취향을 고려해 선택하시기 바랍니다.';
    }

    return reason;
  }
}

module.exports = new SentimentAnalysisService(); 