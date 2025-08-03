import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import io from 'socket.io-client';
import { createOrRestoreGuestSession } from '../utils/sessionUtils';
import { 
  UserIcon,
  TrophyIcon,
  ScaleIcon
} from '@heroicons/react/24/outline';
import Dice3D from './Dice3D';

// 미팅 히스토리 저장 함수
const saveMeetingHistory = async (user, meetingData) => {
  try {
    if (!user || user.isGuest) {
      console.log('게스트 사용자는 히스토리를 저장하지 않습니다.');
      return { success: false, reason: 'guest' };
    }

    const historyData = {
      meetingId: meetingData.id,
      title: meetingData.title || '미팅 계획',
      description: meetingData.description || '',
      role: 'host',
      participantCount: meetingData.participants?.length || 0,
      selectedPlace: meetingData.selectedPlace,
      candidatePlaces: meetingData.candidatePlaces || [],
      totalVotes: meetingData.candidatePlaces?.reduce((sum, place) => sum + (place.votes || 0), 0) || 0,
      selectionMethod: meetingData.selectionMethod || 'random',
      meetingStatus: 'completed',
      completedAt: new Date()
    };

    console.log('📊 히스토리 저장 데이터:', historyData);

    const response = await api.post(`/users/${user.id}/history`, historyData);
    
    if (response.data.success) {
      console.log('✅ 미팅 히스토리 저장 성공');
      return { success: true, data: response.data.history };
    } else {
      console.error('❌ 미팅 히스토리 저장 실패:', response.data.error);
      return { success: false, error: response.data.error };
    }
  } catch (error) {
    console.error('❌ 미팅 히스토리 저장 중 오류:', error);
    return { success: false, error: error.message };
  }
};

// VoteService 클래스 (GroupVoting과 동일)
class VoteService {
  async getVoteData(meetingId) {
    try {
      const response = await api.get(`/votes/${meetingId}`);
      return response.data.data;
    } catch (error) {
      console.error('투표 데이터 조회 실패:', error);
      return { votes: {}, participants: [], candidatePlaces: [] };
    }
  }
}

const voteService = new VoteService();

// SVG 기반 휠 컴포넌트
const WheelComponent = ({ segments, onFinished, isSpinning, winningSegment, socket, meetingId, onCenterClick }) => {
  const [rotation, setRotation] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  const segmentColors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#F9CA24', 
    '#6C5CE7', '#FD79A8', '#FDCB6E', '#00B894',
    '#E17055', '#74B9FF', '#A29BFE', '#FF7675',
    '#55A3FF', '#FD79A8', '#20BF6B', '#FA8231'
  ];

  useEffect(() => {
    if (isSpinning && !isAnimating) {
      spin();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSpinning, isAnimating]);



  // Socket.io로 다른 클라이언트의 룰렛 시작을 감지
  useEffect(() => {
    if (socket) {
      socket.on('roulette-started', (data) => {
        console.log('다른 사용자가 룰렛을 시작했습니다:', data);
        // 다른 사용자가 시작한 룰렛을 같이 돌림
        if (!isAnimating && data.winningSegment) {
          const winnerIndex = segments.findIndex(segment => segment.name === data.winningSegment.name);
          if (winnerIndex !== -1) {
            startSharedSpin(winnerIndex);
          }
        }
      });

      return () => {
        socket.off('roulette-started');
      };
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, segments, isAnimating]);

  const spin = () => {
    setIsAnimating(true);
    
    // 승리 세그먼트 인덱스 찾기
    const winnerIndex = winningSegment ? 
      segments.findIndex(segment => segment.name === winningSegment.name) : 
      Math.floor(Math.random() * segments.length);
    
    // Socket.io로 다른 클라이언트에게 룰렛 시작 알림
    if (socket && meetingId) {
      socket.emit('game-start', {
        meetingId,
        gameType: 'roulette'
      });
      socket.emit('roulette-start', {
        meetingId,
        winningSegment: segments[winnerIndex]
      });
    }

    performSpin(winnerIndex);
  };

  const startSharedSpin = (winnerIndex) => {
    setIsAnimating(true);
    performSpin(winnerIndex);
  };

  const performSpin = (winnerIndex) => {
    const segmentAngle = 360 / segments.length;

    // 화살표는 상단(12시)에 위치. SVG 좌표계에서는 270도.
    // 우승자의 세그먼트 중앙이 이 각도를 가리켜야 함.
    const targetAngle = 270;

    // 우승자 세그먼트의 중간 각도 계산 (-90도 오프셋 적용)
    const winnerMiddleAngle = (winnerIndex * segmentAngle) + (segmentAngle / 2) - 90;
    
    // 최종적으로 룰렛이 멈춰야 할 각도
    const finalAngle = targetAngle - winnerMiddleAngle;

    // 애니메이션을 위해 여러 바퀴 회전
    // 현재 회전 수에 추가 회전 수를 더해 항상 앞으로만 돌도록 설정
    const spins = 8 + Math.floor(Math.random() * 8);
    const currentTurns = Math.floor(rotation / 360);
    const newRotation = (currentTurns + spins) * 360 + finalAngle;
    
    setRotation(newRotation);
    
    // 애니메이션 완료 후 콜백
    setTimeout(() => {
      setIsAnimating(false);
      if (onFinished) {
        onFinished(segments[winnerIndex]);
        
        // Socket.io로 룰렛 완료 알림
        if (socket && meetingId) {
          socket.emit('roulette-finish', {
            meetingId,
            winner: segments[winnerIndex]
          });
        }
      }
    }, 4000); // 4초 애니메이션
  };

  // SVG 경로 생성 함수
  const createSegmentPath = (index, radius = 160) => {
    const segmentAngle = 360 / segments.length;
    const startAngle = index * segmentAngle - 90; // -90도로 12시 방향 시작
    const endAngle = startAngle + segmentAngle;
    
    const startAngleRad = (startAngle * Math.PI) / 180;
    const endAngleRad = (endAngle * Math.PI) / 180;
    
    const largeArcFlag = segmentAngle > 180 ? 1 : 0;
    
    const x1 = 200 + radius * Math.cos(startAngleRad);
    const y1 = 200 + radius * Math.sin(startAngleRad);
    const x2 = 200 + radius * Math.cos(endAngleRad);
    const y2 = 200 + radius * Math.sin(endAngleRad);
    
    return `M 200,200 L ${x1},${y1} A ${radius},${radius} 0 ${largeArcFlag},1 ${x2},${y2} z`;
  };

  // 텍스트 위치 계산
  const getTextPosition = (index, radius = 120) => {
    const segmentAngle = 360 / segments.length;
    const angle = index * segmentAngle + segmentAngle / 2 - 90; // 중앙 각도
    const angleRad = (angle * Math.PI) / 180;
    
    return {
      x: 200 + radius * Math.cos(angleRad),
      y: 200 + radius * Math.sin(angleRad),
      rotation: angle > 90 && angle < 270 ? angle + 180 : angle // 텍스트 뒤집힘 방지
    };
  };

  return (
    <div className="flex flex-col items-center">
      {/* SVG 휠 */}
              <div className="relative">
          {/* 고정 화살표 포인터 (SVG 아래쪽에 절대 위치) */}
          <div className="absolute top-0 left-1/2 transform -translate-x-1/2 translate-y-2 z-30">
            <div
              className={`w-0 h-0 border-l-[12px] border-r-[12px] border-t-[20px] border-l-transparent border-r-transparent transition-all duration-300 ${
                isAnimating ? 'border-t-yellow-500 animate-bounce filter drop-shadow-lg' : 'border-t-red-500 filter drop-shadow-md'
              }`}
            />
          </div>
          
        <div className={`transition-all duration-300 ${
          isAnimating ? 'filter drop-shadow-2xl' : 'filter drop-shadow-lg'
        }`}>
          <svg 
            width="400" 
            height="400" 
            className="rounded-full border-4 border-white shadow-2xl"
            style={{
              transform: `rotate(${rotation}deg)`,
              transition: isAnimating ? 'transform 4s cubic-bezier(0.25, 0.46, 0.45, 0.94)' : 'none',
            }}
          >
            {/* 배경 원 */}
            <circle cx="200" cy="200" r="180" fill="#f8f9fa" stroke="#ffffff" strokeWidth="4"/>
            
            {/* 세그먼트들 */}
            {segments.map((segment, index) => {
              const textPos = getTextPosition(index);
              return (
                <g key={index}>
                  {/* 세그먼트 경로 */}
                  <path
                    d={createSegmentPath(index)}
                    fill={segmentColors[index % segmentColors.length]}
                    stroke="#ffffff"
                    strokeWidth="2"
                    className="transition-all duration-200 hover:brightness-110"
                  />
                  
                  {/* 사용자 아바타 (더 큰 크기) */}
                  <text
                    x={textPos.x}
                    y={textPos.y - 15}
                    textAnchor="middle"
                    fontSize="24"
                    fill="#ffffff"
                    fontWeight="bold"
                    style={{
                      textShadow: '2px 2px 4px rgba(0,0,0,0.8)',
                      filter: 'drop-shadow(1px 1px 2px rgba(0,0,0,0.8))'
                    }}
                    transform={`rotate(${textPos.rotation}, ${textPos.x}, ${textPos.y - 15})`}
                  >
                    {segment.avatar}
                  </text>
                  
                  {/* 사용자 이름 (더 큰 폰트, 더 진한 그림자) */}
                  <text
                    x={textPos.x}
                    y={textPos.y + 8}
                    textAnchor="middle"
                    fontSize="14"
                    fill="#ffffff"
                    fontWeight="bold"
                    style={{
                      textShadow: '2px 2px 4px rgba(0,0,0,0.9)',
                      filter: 'drop-shadow(1px 1px 3px rgba(0,0,0,0.9))'
                    }}
                    transform={`rotate(${textPos.rotation}, ${textPos.x}, ${textPos.y + 8})`}
                  >
                    {segment.name}
                  </text>
                </g>
              );
            })}
            
            {/* 중앙 원 */}
            <circle 
              cx="200" 
              cy="200" 
              r="30" 
              fill={isAnimating ? 'url(#gradientCenter)' : '#ffffff'}
              stroke={isAnimating ? '#fbbf24' : '#3b82f6'}
              strokeWidth="4"
              className={`transition-all duration-300 ${!isAnimating ? 'cursor-pointer hover:fill-blue-50' : 'cursor-not-allowed'}`}
              onClick={!isAnimating ? onCenterClick : undefined}
            />
            
            {/* 중앙 그라데이션 정의 */}
            <defs>
              <linearGradient id="gradientCenter" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#fef3c7"/>
                <stop offset="100%" stopColor="#f59e0b"/>
              </linearGradient>
            </defs>
            
            {/* 중앙 아이콘 */}
            <g 
              transform="translate(200, 200)" 
              onClick={!isAnimating ? onCenterClick : undefined} 
              className={`${!isAnimating ? 'cursor-pointer' : 'cursor-not-allowed'}`}
            >
              <circle 
                r="8" 
                fill={isAnimating ? '#f59e0b' : '#3b82f6'}
                className="transition-all duration-300"
              />
              {isAnimating && (
                <circle 
                  r="15" 
                  fill="none" 
                  stroke="#fbbf24" 
                  strokeWidth="2"
                  className="animate-ping"
                />
              )}
              {/* 클릭 가능 상태일 때 텍스트 표시 */}
              {!isAnimating && (
                <text
                  textAnchor="middle"
                  y="25"
                  fontSize="9"
                  fill="#3b82f6"
                  className="font-bold select-none"
                >
                  CLICK
                </text>
              )}
            </g>
          </svg>
        </div>
        
        {/* 회전 중 추가 효과 */}
        {isAnimating && (
          <>
            <div className="absolute inset-0 rounded-full border-4 border-yellow-300 animate-ping opacity-60"></div>
            <div className="absolute inset-0 rounded-full border-2 border-orange-400 animate-pulse opacity-40"></div>
          </>
        )}
      </div>
    </div>
  );
};

const RandomSelector = ({ meetingId, onLocationSelected, user, meeting, isOwner, onMeetingUpdate }) => {
  // 유저 정보
  const userId = user?.id || createOrRestoreGuestSession()?.id || 'anonymous';
  const userData = user;

  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState(null);
  const [candidatePlaces, setCandidatePlaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectionHistory, setSelectionHistory] = useState([]);
  const [fairnessMode, setFairnessMode] = useState('random');
  // const [showFairnessStats, setShowFairnessStats] = useState(false);
  const [winningSegment, setWinningSegment] = useState(null);
  const [socket, setSocket] = useState(null);
  const [isDataLoading, setIsDataLoading] = useState(false);
  const [isRouletteOwner, setIsRouletteOwner] = useState(false);
  const [resultAnimating, setResultAnimating] = useState(false);
  // const [socketConnected, setSocketConnected] = useState(false);
  // const [lastUpdated, setLastUpdated] = useState(null);
  
  // 주사위 관련 상태
  const [diceRolling, setDiceRolling] = useState(false);
  const [diceResult, setDiceResult] = useState(null);
  const [shouldRoll3D, setShouldRoll3D] = useState(false);
  
  // 퀴즈 관련 상태
  const [quizMode, setQuizMode] = useState(false);
  const [currentQuiz, setCurrentQuiz] = useState(null);
  const [quizAnswer, setQuizAnswer] = useState('');
  const [isQuizOwner, setIsQuizOwner] = useState(false);
  
  // 스피드 퀴즈 관련 상태
  const [speedQuizMode, setSpeedQuizMode] = useState(false);
  const [quizRounds, setQuizRounds] = useState([]);
  const [currentRound, setCurrentRound] = useState(0);
  const [participants, setParticipants] = useState(new Map());
  const [roundAnswers, setRoundAnswers] = useState(new Map());
  const [quizStartTime, setQuizStartTime] = useState(null);
  const [roundTimeLeft, setRoundTimeLeft] = useState(15); // 15초 제한시간
  const [timerInterval, setTimerInterval] = useState(null);
  
  // 타이밍 게임 상태
  const [timingGameMode, setTimingGameMode] = useState(false);
  const [targetTime, setTargetTime] = useState(null); // 목표 시간 (초)
  const [currentTime, setCurrentTime] = useState(0); // 현재 타이머 시간 (밀리초)
  const [gameRunning, setGameRunning] = useState(false);
  const [gamePhase, setGamePhase] = useState('waiting'); // 'waiting', 'running', 'stopped', 'finished'
  const [gameInterval, setGameInterval] = useState(null);
  const [stoppedTime, setStoppedTime] = useState(null);
  
  // 멀티플레이어 타이밍 게임 상태
  const [multiplayerMode, setMultiplayerMode] = useState(false);
  const [gameId, setGameId] = useState(null);
  const [gamePlayers, setGamePlayers] = useState([]);
  const [currentPlayer, setCurrentPlayer] = useState(null);
  const [gameResults, setGameResults] = useState([]);
  const [gameWinner, setGameWinner] = useState(null);
  const [isGameOwner, setIsGameOwner] = useState(false);
  const [gameAutoEndTime, setGameAutoEndTime] = useState(null);
  const [gameTimeRemaining, setGameTimeRemaining] = useState(null);

  // localStorage에서 룰렛 결과 복원
  useEffect(() => {
    if (meetingId) {
      const savedResult = localStorage.getItem(`roulette_result_${meetingId}`);
      if (savedResult) {
        try {
          const parsedResult = JSON.parse(savedResult);
          console.log('🎲 localStorage에서 룰렛 결과 복원:', parsedResult);
          setResult(parsedResult);
          setResultAnimating(false);
        } catch (error) {
          console.error('룰렛 결과 복원 실패:', error);
          localStorage.removeItem(`roulette_result_${meetingId}`);
        }
      }
    }
  }, [meetingId]);

  // 컴포넌트 언마운트 시 인터벌 정리
  useEffect(() => {
    return () => {
      if (gameInterval) {
        clearInterval(gameInterval);
      }
    };
  }, [gameInterval]);

  // 게임 자동 종료 시간 카운트다운
  useEffect(() => {
    if (gameAutoEndTime && gameRunning) {
      const interval = setInterval(() => {
        const remaining = gameAutoEndTime - Date.now();
        if (remaining > 0) {
          setGameTimeRemaining(remaining);
        } else {
          setGameTimeRemaining(0);
          clearInterval(interval);
        }
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [gameAutoEndTime, gameRunning]);

  // 스피드 퀴즈 타이머
  useEffect(() => {
    if (speedQuizMode && quizStartTime && roundTimeLeft > 0) {
      const interval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - quizStartTime) / 1000);
        const timeLeft = Math.max(0, 15 - elapsed);
        setRoundTimeLeft(timeLeft);
        
        if (timeLeft === 0) {
          clearInterval(interval);
          // 시간 초과 시 자동으로 다음 라운드로 진행 (진행자만)
          if (isQuizOwner) {
            setTimeout(() => {
              nextRound();
            }, 1000);
          }
        }
      }, 1000);
      
      setTimerInterval(interval);
      
      return () => {
        clearInterval(interval);
      };
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speedQuizMode, quizStartTime, roundTimeLeft, isQuizOwner]);

  // 컴포넌트 언마운트 시 타이머 정리
  useEffect(() => {
    return () => {
      if (timerInterval) {
        clearInterval(timerInterval);
      }
    };
  }, [timerInterval]);

  // Socket.io 연결 설정
  useEffect(() => {
    if (meetingId) {
      const socketUrl = window.location.hostname === 'localhost' 
        ? 'http://localhost:5000'
        : 'https://wherewemeets-production.up.railway.app';
      const newSocket = io(socketUrl);
      setSocket(newSocket);

      // 연결 상태 이벤트
      newSocket.on('connect', () => {
        console.log('Socket.io 연결됨');
        // setSocketConnected(true);
      });

      newSocket.on('disconnect', () => {
        console.log('Socket.io 연결 해제됨');
        // setSocketConnected(false);
      });

      // 미팅 룸에 참가
      newSocket.emit('join-meeting', meetingId);

      // 실시간 데이터 업데이트 감지
      newSocket.on('data-updated', (data) => {
        console.log('실시간 데이터 업데이트:', data);
        
        // 선정 결과 업데이트인 경우 즉시 반영
        if (data.type === 'selection' && data.participantId) {
          console.log('🎯 실시간 선정 결과 감지:', data);
          // 데이터를 다시 로드하여 최신 선정 결과 확인
          setTimeout(() => {
            if (!isDataLoading) {
              loadCandidatePlacesData(true, false); // 강제 업데이트, 로딩 스피너 없음
            }
          }, 500); // 서버 저장 완료 후 로드
        } else {
          // 일반 데이터 업데이트
          if (!isDataLoading) {
            loadCandidatePlacesData(true, false); // 강제 업데이트, 로딩 스피너 없음
          }
        }
      });

      // 룰렛 완료 이벤트 감지 (다른 사용자의 룰렛 결과)
      newSocket.on('roulette-finished', (data) => {
        console.log('다른 사용자의 룰렛 완료:', data);
        // 다른 사용자의 룰렛 결과를 즉시 반영
        if (data.winner && data.winner.id) {
          const resultData = {
            selectedPlace: data.winner,
            message: `${data.winner.name}이(가) 선정되었습니다!`,
            fairnessInfo: getFairnessInfo(data.winner, candidatePlaces),
            isRestoredResult: true,
            timestamp: data.timestamp ? new Date(data.timestamp).toISOString() : new Date().toISOString()
          };
          
          setResult(resultData);
          setResultAnimating(false);
          
          // localStorage에도 동기화
          try {
            localStorage.setItem(`roulette_result_${meetingId}`, JSON.stringify(resultData));
            console.log('🔄 실시간 룰렛 결과 동기화 완료');
          } catch (error) {
            console.error('실시간 룰렛 결과 저장 실패:', error);
          }
        }
        
        // 데이터도 다시 로드하여 선정 카운트 업데이트
        setTimeout(() => {
          if (!isDataLoading) {
            loadCandidatePlacesData(true, false);
          }
        }, 1000);
      });

      // 게임 시작 이벤트 감지
      newSocket.on('game-start', (data) => {
        console.log(`다른 사용자가 ${data.gameType} 게임 시작:`, data);
        
        // 기존 결과 초기화
        setResult(null);
        setResultAnimating(false);
        
        if (data.gameType === 'dice') {
          setDiceRolling(true);
          setDiceResult(null);
          setShouldRoll3D(true);
        } else if (data.gameType === 'quiz' && data.quiz) {
          setQuizMode(true);
          setCurrentQuiz(data.quiz);
          setQuizAnswer('');
          setIsQuizOwner(false); // 다른 사용자의 퀴즈이므로 답안 제출 불가
        }
      });

      // 게임 결과 이벤트 감지 (주사위, 퀴즈 등)
      newSocket.on('game-result', (data) => {
        console.log(`다른 사용자의 ${data.gameType} 게임 완료:`, data);
        
        if (data.result) {
          const resultData = {
            ...data.result,
            fairnessInfo: getFairnessInfo(data.result.selectedPlace, candidatePlaces),
            isRestoredResult: true
          };
          
          setResult(resultData);
          setResultAnimating(false);
          
          // 게임별 상태 초기화
          if (data.gameType === 'dice') {
            setDiceRolling(false);
            setDiceResult(data.diceValue);
          } else if (data.gameType === 'quiz') {
            setQuizMode(false);
            setCurrentQuiz(null);
            setQuizAnswer('');
            setIsQuizOwner(false);
          }
          
          // localStorage에도 동기화
          try {
            localStorage.setItem(`roulette_result_${meetingId}`, JSON.stringify(resultData));
            console.log(`🔄 실시간 ${data.gameType} 결과 동기화 완료`);
          } catch (error) {
            console.error(`실시간 ${data.gameType} 결과 저장 실패:`, error);
          }
        }
        
        // 데이터도 다시 로드하여 선정 카운트 업데이트
        setTimeout(() => {
          if (!isDataLoading) {
            loadCandidatePlacesData(true, false);
          }
        }, 1000);
      });

      // 스피드 퀴즈 이벤트들
      newSocket.on('speed-quiz-start', (data) => {
        console.log('스피드 퀴즈 시작:', data);
        setResult(null);
        setResultAnimating(false);
        setQuizRounds(data.rounds);
        setCurrentRound(data.currentRound);
        setSpeedQuizMode(true);
        setQuizMode(true);
        setCurrentQuiz(data.rounds[data.currentRound]);
        setQuizAnswer('');
        setParticipants(new Map());
        setRoundAnswers(new Map());
        setRoundTimeLeft(data.timeLimit);
        setQuizStartTime(Date.now());
        setIsQuizOwner(false); // 다른 사람이 시작한 퀴즈이므로 진행자 아님
      });

      newSocket.on('speed-quiz-answer', (data) => {
        console.log('스피드 퀴즈 답안:', data);
        // 다른 참가자의 답안 정보 업데이트
        const newParticipants = new Map(participants);
        const currentScore = newParticipants.get(data.userId) || 0;
        newParticipants.set(data.userId, currentScore + data.score);
        setParticipants(newParticipants);
      });

      newSocket.on('speed-quiz-next-round', (data) => {
        console.log('스피드 퀴즈 다음 라운드:', data);
        setCurrentRound(data.currentRound);
        setCurrentQuiz(quizRounds[data.currentRound]);
        setQuizAnswer('');
        setRoundAnswers(new Map());
        setRoundTimeLeft(15);
        setQuizStartTime(Date.now());
      });

      newSocket.on('speed-quiz-finish', (data) => {
        console.log('스피드 퀴즈 완료:', data);
        setResult(data.result);
        setResultAnimating(true);
        setSpeedQuizMode(false);
        setQuizMode(false);
        setCurrentQuiz(null);
        setQuizAnswer('');
        setParticipants(new Map(data.participants));
        
        // localStorage에 저장
        try {
          localStorage.setItem(`roulette_result_${meetingId}`, JSON.stringify(data.result));
        } catch (error) {
          console.error('스피드 퀴즈 결과 저장 실패:', error);
        }
        
        setTimeout(() => setResultAnimating(false), 3000);
      });

      // 멀티플레이어 타이밍 게임 이벤트들
      newSocket.on('timing-game-started', (data) => {
        console.log('🎮 멀티플레이어 타이밍 게임 시작:', data);
        setGameId(data.gameId);
        setTargetTime(data.targetTime);
        setMultiplayerMode(true);
        setTimingGameMode(true);
        setCurrentTime(0);
        setGamePhase('running');
        setGameRunning(true);
        setGamePlayers([]);
        setGameResults([]);
        setGameWinner(null);
        setGameAutoEndTime(data.autoEndTime);
        
        // 타이머 시작
        const interval = setInterval(() => {
          setCurrentTime(prev => prev + 10);
        }, 10);
        setGameInterval(interval);
      });

      newSocket.on('timing-game-players-updated', (data) => {
        console.log('🎮 타이밍 게임 플레이어 업데이트:', data);
        setGamePlayers(data.players);
      });

      newSocket.on('timing-game-player-result', (data) => {
        console.log('🎮 플레이어 결과 수신:', data);
        setGamePlayers(data.players);
        
        // 새로운 결과 추가 (중복 방지)
        setGameResults(prev => {
          const existingResult = prev.find(r => r.playerId === data.playerId);
          if (existingResult) return prev;
          
          return [...prev, {
            playerId: data.playerId,
            playerName: data.playerName,
            stoppedTime: data.stoppedTime,
            difference: data.difference
          }];
        });
      });

      newSocket.on('timing-game-finished', (data) => {
        console.log('🎮 타이밍 게임 최종 결과:', data);
        setGameWinner(data.winner);
        setGameResults(data.results);
        setGamePhase('finished');
        setGameRunning(false);
        
        // 게임 인터벌 정리
        if (gameInterval) {
          clearInterval(gameInterval);
          setGameInterval(null);
        }
        
        // 우승자의 장소를 최종 선정
        if (data.winner && candidatePlaces.length > 0) {
          const winnerPlace = candidatePlaces[Math.floor(Math.random() * candidatePlaces.length)];
          recordSelectionOnServer(winnerPlace);
          
          const resultData = {
            selectedPlace: winnerPlace,
            message: `🏆 ${data.winner.name}님이 승리하여 "${winnerPlace.name}"이(가) 선정되었습니다!\n목표: ${data.targetTime.toFixed(2)}초, 기록: ${(data.winner.stoppedTime/1000).toFixed(2)}초 (차이: ${data.winner.difference}ms)`,
            fairnessInfo: getFairnessInfo(winnerPlace),
            isRestoredResult: false,
            timestamp: new Date().toISOString(),
            selectionMethod: 'multiplayer-timing'
          };
          
          setResult(resultData);
          setResultAnimating(true);
          
          setTimeout(() => setResultAnimating(false), 3000);
          
          if (onLocationSelected) {
            onLocationSelected(winnerPlace);
          }
        }
      });

      newSocket.on('timing-game-reset', (data) => {
        console.log('🎮 타이밍 게임 리셋:', data);
        resetMultiplayerTimingGame();
      });

      newSocket.on('timing-game-cancelled', (data) => {
        console.log('🎮 타이밍 게임 취소:', data);
        setGamePhase('cancelled');
        setGameRunning(false);
        
        // 게임 인터벌 정리
        if (gameInterval) {
          clearInterval(gameInterval);
          setGameInterval(null);
        }
        
        // 취소 메시지 표시
        alert(data.reason || '게임이 취소되었습니다.');
        
        // 3초 후 자동 리셋
        setTimeout(() => {
          resetMultiplayerTimingGame();
        }, 3000);
      });

      return () => {
        newSocket.close();
      };
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meetingId]);

  // 실시간 데이터 업데이트를 위한 폴링 (Socket.io 백업용)
  useEffect(() => {
    if (!meetingId) return;

    const interval = setInterval(() => {
      if (!isDataLoading) {
        loadCandidatePlacesData(false, false); // 백그라운드 업데이트, 로딩 스피너 없음
      }
    }, 5000); // 5초마다 백업 업데이트 (더 빠른 동기화)

    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meetingId]);

  // 실제 후보 장소 데이터 로드
  useEffect(() => {
    if (meetingId) {
      loadCandidatePlacesData(false, true); // 초기 로딩시 로딩 스피너 표시
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meetingId]);

  const loadCandidatePlacesData = async (force = false, showLoading = false) => {
    if (isDataLoading && !force) {
      console.log('이미 데이터 로딩 중이므로 스킵');
      return;
    }
    
    try {
      setIsDataLoading(true);
      // 초기 로딩이나 명시적 요청시에만 로딩 스피너 표시
      if (showLoading) {
      setLoading(true);
      }
      
      console.log(`API 호출 시작: /votes/${meetingId}`);
      const response = await api.get(`/votes/${meetingId}`);
      
      const data = response.data.data || {};
      const { candidatePlaces: votesCandidatePlaces, selectionHistory: serverHistory, selectionCounts, votes: votesData } = data;
      
      console.log('📊 RandomSelector API 응답 데이터:', {
        candidatePlacesCount: votesCandidatePlaces?.length || 0,
        votesDataKeys: Object.keys(votesData || {}),
        votesData: votesData
      });
      
      if (votesCandidatePlaces && votesCandidatePlaces.length > 0) {
        const formattedPlaces = votesCandidatePlaces.map((place, index) => {
          const count = selectionCounts[place.id] || 0;
          // votes 데이터에서 실제 투표자 수 계산
          const voters = votesData?.[place.id] || [];
          const actualVotes = Array.isArray(voters) ? voters.length : 0;
          
          console.log(`🗳️ 장소 "${place.name}" 투표 계산:`, {
            placeId: place.id,
            votersArray: voters,
            votersLength: voters.length,
            actualVotes: actualVotes,
            originalPlaceVotes: place.votes
          });
          
          return {
            id: place.id,
            name: place.name,
            category: place.category || '기타',
            location: place.address || '주소 정보 없음',
            avatar: getPlaceAvatar(place.category, index),
            selectedCount: count,
            votes: actualVotes, // 실제 투표자 수 사용
            voters: voters, // 투표자 정보도 저장
          };
        });
        
        // 데이터가 실제로 변경된 경우만 상태 업데이트
        const hasPlacesChanged = !arePlacesEqual(candidatePlaces, formattedPlaces);
        const hasHistoryChanged = !areArraysEqual(selectionHistory, serverHistory || []);
        
        if (hasPlacesChanged) {
          console.log('후보 장소 데이터 변경 감지, 업데이트 진행');
          setCandidatePlaces(formattedPlaces);
        }
        
        if (hasHistoryChanged) {
          console.log('선정 이력 변경 감지, 업데이트 진행');
          setSelectionHistory(serverHistory || []);
        }

        // 가장 최근 선정 결과 복원 처리 (서버 우선)
        if (serverHistory && serverHistory.length > 0) {
          const latestSelection = serverHistory[0];
          const selectedPlace = formattedPlaces.find(p => p.id === latestSelection.selectedParticipantId);
          
          if (selectedPlace) {
            // 현재 결과가 없거나, 서버 결과와 다른 경우 서버 결과로 업데이트
            if (!result || result.selectedPlace.id !== selectedPlace.id) {
              console.log('📋 서버에서 최근 선정 결과 복원:', selectedPlace);
              const serverResultData = {
                selectedPlace,
                message: `${selectedPlace.name}이(가) 선정되었습니다!`,
                fairnessInfo: getFairnessInfo(selectedPlace, formattedPlaces),
                isRestoredResult: true,
                timestamp: latestSelection.timestamp || new Date().toISOString()
              };
              
              setResult(serverResultData);
              setResultAnimating(false);
              
              // 서버 결과를 localStorage에도 동기화
              try {
                localStorage.setItem(`roulette_result_${meetingId}`, JSON.stringify(serverResultData));
                console.log('🔄 서버 결과로 localStorage 동기화 완료');
              } catch (error) {
                console.error('서버 결과 localStorage 저장 실패:', error);
              }
            }
          }
        }
      } else {
        // 후보 장소가 없는 경우만 상태 업데이트
        if (candidatePlaces.length > 0) {
          console.log('후보 장소 없음, 상태 초기화');
          setCandidatePlaces([]);
          setSelectionHistory([]);
        }
      }
    } catch (error) {
      console.error('후보 장소 데이터 로드 실패:', error);
      // 에러 시에만 초기화
      if (candidatePlaces.length > 0) {
        setCandidatePlaces([]);
      }
    } finally {
      if (showLoading) {
      setLoading(false);
      }
      setIsDataLoading(false);
      // setLastUpdated(new Date());
    }
  };

  // 후보 장소 배열 비교 함수
  const arePlacesEqual = (arr1, arr2) => {
    if (arr1.length !== arr2.length) return false;
    return arr1.every((p1, index) => {
      const p2 = arr2[index];
      return p1.id === p2.id && 
             p1.name === p2.name && 
             p1.selectedCount === p2.selectedCount &&
             p1.votes === p2.votes; // 투표 수 변경도 감지
    });
  };

  // 배열 비교 함수 (선정 이력용)
  const areArraysEqual = (arr1, arr2) => {
    if (arr1.length !== arr2.length) return false;
    return JSON.stringify(arr1) === JSON.stringify(arr2);
  };

  // 수동 새로고침 함수 (로딩 스피너 표시)
  // const handleManualRefresh = () => {
  //   console.log('수동 새로고침 실행');
  //   loadCandidatePlacesData(true, true);
  // };

  // 장소 카테고리 기반 아바타 생성
  const getPlaceAvatar = (category, index) => {
    const avatarsByCategory = {
      'restaurant': ['🍽️', '🍲', '🥘', '🍜'],
      'cafe': ['☕', '🧋', '🥤', '🍰'],
      'entertainment': ['🎮', '🎬', '🎪', '🎨'],
      'korean': ['🍲', '🥢', '🌶️', '🍜'],
      'western': ['🍕', '🍔', '🥗', '🍝'],
      'japanese': ['🍣', '🍱', '🍙', '🍜'],
      'chinese': ['🥟', '🍜', '🥠', '🍲'],
      'default': ['📍', '🏢', '🌟', '✨']
    };
    
    const avatars = avatarsByCategory[category] || avatarsByCategory['default'];
    return avatars[index % avatars.length];
  };

  const fairnessModes = [
    {
      id: 'random',
      name: '완전 랜덤',
      icon: '🎯',
      description: '모든 후보 장소가 동일한 확률로 선정'
    },
    {
      id: 'dice',
      name: '운명의 주사위',
      icon: '🎲',
      description: '각 장소에 주사위 번호를 배정하고 주사위로 결정'
    },
    {
      id: 'quiz',
      name: '스피드 퀴즈',
      icon: '🧠',
      description: '장소별 퀴즈를 풀어서 최종 선택권 획득'
    }
  ];

  const startRandomSelection = () => {
    if (candidatePlaces.length === 0) {
      alert('후보 장소가 없습니다.');
      return;
    }

    if (spinning || diceRolling || quizMode || speedQuizMode || timingGameMode) {
      return;
    }

    // 새로운 선정을 위해 이전 결과 지우기
    setResult(null);
    setResultAnimating(false);

    // 선정 방식에 따라 다른 동작
    switch (fairnessMode) {
      case 'dice':
        rollDice();
        break;
      case 'quiz':
        startQuiz();
        break;
      default:
        const randomPlace = getRandomSelection();
        setWinningSegment(randomPlace);
        setSpinning(true);
        setIsRouletteOwner(true);
    }
  };

  // 완전 랜덤 선정
  const getRandomSelection = () => {
    const randomIndex = Math.floor(Math.random() * candidatePlaces.length);
    return candidatePlaces[randomIndex];
  };

  // 균형 선정 (적게 선정된 사람 우선)
  // const getBalancedSelection = () => {
  //   const minCount = Math.min(...candidatePlaces.map(p => p.selectedCount));
  //   const leastSelected = candidatePlaces.filter(p => p.selectedCount === minCount);
  //   const randomIndex = Math.floor(Math.random() * leastSelected.length);
  //   return leastSelected[randomIndex];
  // };

  // 3D 주사위 굴리기 함수
  const rollDice = () => {
    if (candidatePlaces.length === 0) {
      alert('후보 장소가 없습니다.');
      return;
    }

    setDiceRolling(true);
    setResult(null);
    setResultAnimating(false);
    setDiceResult(null);
    
    // 웹소켓으로 주사위 시작 알림
    if (socket && meetingId) {
      socket.emit('game-start', {
        meetingId,
        gameType: 'dice'
      });
    }
    
    // 3D 주사위 굴리기 시작
    setShouldRoll3D(true);
  };

  // 3D 주사위 결과 처리
  const handle3DDiceResult = (result) => {
    const selectedIndex = (result - 1) % candidatePlaces.length;
    const selectedPlace = candidatePlaces[selectedIndex];
    
    setDiceResult(result);
    setDiceRolling(false);
    
    // 서버에 결과 저장
    recordSelectionOnServer(selectedPlace);
    
    const diceSymbols = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
    const resultData = {
      selectedPlace,
      message: `🎲 3D 주사위가 ${diceSymbols[result - 1]} (${result}번)을 가리켰습니다! ${selectedPlace.name}이(가) 선정되었습니다!`,
      fairnessInfo: getFairnessInfo(selectedPlace),
      isRestoredResult: false,
      timestamp: new Date().toISOString(),
      selectionMethod: 'dice'
    };
    
    setResult(resultData);
    setResultAnimating(true);
    
    // 웹소켓으로 주사위 결과 전송
    if (socket && meetingId) {
      socket.emit('game-result', {
        meetingId,
        gameType: 'dice',
        result: resultData,
        diceValue: result
      });
    }
    
    // localStorage에 저장
    if (meetingId) {
      try {
        localStorage.setItem(`roulette_result_${meetingId}`, JSON.stringify(resultData));
      } catch (error) {
        console.error('주사위 결과 저장 실패:', error);
      }
    }
    
    setTimeout(() => setResultAnimating(false), 3000);
    
    if (onLocationSelected) {
      onLocationSelected(selectedPlace);
    }
  };

  // 3D 주사위 리셋 함수
  const reset3DDice = () => {
    setShouldRoll3D(false);
  };

  // 퀴즈 생성 함수
  const generateQuiz = (place) => {
    const quizTemplates = [
      {
        type: 'category',
        question: `"${place.name}"은(는) 어떤 종류의 장소인가요?`,
        answers: [place.category, '카페', '레스토랑', '엔터테인먼트'],
        correct: place.category
      },
      {
        type: 'location',
        question: `"${place.name}"의 주소에 포함된 키워드는?`,
        answers: place.address ? [
          place.address.split(' ')[1] || '강남구',
          '종로구', '마포구', '송파구'
        ] : ['강남구', '종로구', '마포구', '송파구'],
        correct: place.address ? place.address.split(' ')[1] || '강남구' : '강남구'
      },
      {
        type: 'emoji',
        question: `"${place.name}" 장소를 가장 잘 표현하는 이모지는?`,
        answers: [place.avatar, '🍕', '☕', '🎮'],
        correct: place.avatar
      }
    ];
    
    const template = quizTemplates[Math.floor(Math.random() * quizTemplates.length)];
    
    // 답안 섞기
    const shuffledAnswers = [...template.answers].sort(() => Math.random() - 0.5);
    
    return {
      place,
      question: template.question,
      answers: shuffledAnswers,
      correct: template.correct
    };
  };

  // 스피드 퀴즈 라운드 생성
  const generateSpeedQuizRounds = () => {
    return candidatePlaces.map(place => generateQuiz(place));
  };

  // 스피드 퀴즈 시작
  const startSpeedQuiz = () => {
    if (candidatePlaces.length === 0) {
      alert('후보 장소가 없습니다.');
      return;
    }

    setResult(null);
    setResultAnimating(false);
    
    // 모든 후보 장소에 대한 퀴즈 라운드 생성
    const rounds = generateSpeedQuizRounds();
    setQuizRounds(rounds);
    setCurrentRound(0);
    setSpeedQuizMode(true);
    setQuizMode(true);
    setQuizAnswer('');
    setParticipants(new Map());
    setRoundAnswers(new Map());
    setRoundTimeLeft(15);
    setIsQuizOwner(true);
    
    // 첫 번째 라운드 시작
    if (rounds.length > 0) {
      setCurrentQuiz(rounds[0]);
      setQuizStartTime(Date.now());
      
      // 웹소켓으로 스피드 퀴즈 시작 알림
      if (socket && meetingId) {
        socket.emit('speed-quiz-start', {
          meetingId,
          rounds: rounds.map(round => ({
            place: round.place,
            question: round.question,
            answers: round.answers
          })),
          currentRound: 0,
          timeLimit: 15
        });
      }
    }
  };

  // 기존 퀴즈 시작 (단일 퀴즈용)
  const startQuiz = () => {
    startSpeedQuiz(); // 스피드 퀴즈로 변경
  };

  // 스피드 퀴즈 답안 제출
  const submitSpeedQuizAnswer = () => {
    if (!quizAnswer) {
      alert('답안을 선택해주세요!');
      return;
    }

    const submitTime = Date.now();
    const responseTime = submitTime - quizStartTime;
    const isCorrect = quizAnswer === currentQuiz.correct;
    
    // 점수 계산 (정답: 100점, 속도 보너스: 최대 50점)
    let score = 0;
    if (isCorrect) {
      score = 100;
      // 5초 이내 답변 시 속도 보너스 (1초당 10점 감소)
      const speedBonus = Math.max(0, 50 - Math.floor(responseTime / 1000) * 10);
      score += speedBonus;
    }
    
    // 참가자 점수 업데이트
    const newParticipants = new Map(participants);
    const currentScore = newParticipants.get(userId) || 0;
    newParticipants.set(userId, currentScore + score);
    setParticipants(newParticipants);
    
    // 현재 라운드 답안 기록
    const newRoundAnswers = new Map(roundAnswers);
    newRoundAnswers.set(userId, {
      answer: quizAnswer,
      isCorrect,
      score,
      responseTime
    });
    setRoundAnswers(newRoundAnswers);
    
    // 웹소켓으로 답안 전송
    if (socket && meetingId) {
      socket.emit('speed-quiz-answer', {
        meetingId,
        userId,
        username: userData?.name || '익명',
        round: currentRound,
        answer: quizAnswer,
        isCorrect,
        score,
        responseTime
      });
    }
    
    setQuizAnswer('');
    
    // 피드백 표시
    if (isCorrect) {
      alert(`🎉 정답! +${score}점 (${Math.floor(responseTime/1000)}초 소요)`);
    } else {
      alert(`❌ 틀렸습니다. 정답: "${currentQuiz.correct}"`);
    }
  };

  // 다음 라운드로 진행
  const nextRound = () => {
    const nextRoundIndex = currentRound + 1;
    
    if (nextRoundIndex < quizRounds.length) {
      setCurrentRound(nextRoundIndex);
      setCurrentQuiz(quizRounds[nextRoundIndex]);
      setQuizAnswer('');
      setRoundAnswers(new Map());
      setRoundTimeLeft(15);
      setQuizStartTime(Date.now());
      
      if (socket && meetingId) {
        socket.emit('speed-quiz-next-round', {
          meetingId,
          currentRound: nextRoundIndex
        });
      }
    } else {
      // 모든 라운드 완료 - 결과 계산
      finishSpeedQuiz();
    }
  };

  // 스피드 퀴즈 종료 및 결과 계산
  const finishSpeedQuiz = () => {
    const result = calculateSpeedQuizResult();
    
    setResult(result);
    setResultAnimating(true);
    setSpeedQuizMode(false);
    setQuizMode(false);
    setCurrentQuiz(null);
    setQuizAnswer('');
    
    // 웹소켓으로 최종 결과 전송
    if (socket && meetingId) {
      socket.emit('speed-quiz-finish', {
        meetingId,
        result,
        participants: Array.from(participants.entries())
      });
    }
    
    // localStorage에 저장
    if (meetingId) {
      try {
        localStorage.setItem(`roulette_result_${meetingId}`, JSON.stringify(result));
      } catch (error) {
        console.error('스피드 퀴즈 결과 저장 실패:', error);
      }
    }
    
    setTimeout(() => setResultAnimating(false), 3000);
    
    if (onLocationSelected) {
      onLocationSelected(result.selectedPlace);
    }
  };

  // 점수 기반 가중치로 최종 장소 선정
  const calculateSpeedQuizResult = () => {
    // 각 장소별 점수 합계 계산
    const placeScores = new Map();
    
    quizRounds.forEach((round, roundIndex) => {
      const placeId = round.place.id;
      let totalScore = 0;
      
      // 이 라운드에서 정답을 맞춘 사람들의 점수 합계
      participants.forEach((score, userId) => {
        // 각 라운드별 점수를 추적해야 하지만, 일단 간단히 전체 점수를 장소 수로 나누어 계산
        totalScore += score / quizRounds.length;
      });
      
      placeScores.set(placeId, totalScore);
    });
    
    // 가중치 기반 장소 선정
    let totalWeight = 0;
    const weights = [];
    
    candidatePlaces.forEach(place => {
      const score = placeScores.get(place.id) || 1; // 최소 가중치 1
      weights.push({ place, weight: score });
      totalWeight += score;
    });
    
    // 가중치 기반 랜덤 선택
    const random = Math.random() * totalWeight;
    let accumulator = 0;
    let selectedPlace = weights[0].place;
    
    for (const item of weights) {
      accumulator += item.weight;
      if (random <= accumulator) {
        selectedPlace = item.place;
        break;
      }
    }
    
    // 결과 기록
    recordSelectionOnServer(selectedPlace);
    
    return {
      selectedPlace,
      message: `🧠 스피드 퀴즈 완료! "${selectedPlace.name}"이(가) 선정되었습니다!`,
      fairnessInfo: getFairnessInfo(selectedPlace),
      isRestoredResult: false,
      timestamp: new Date().toISOString(),
      selectionMethod: 'quiz',
      participants: Array.from(participants.entries()),
      totalRounds: quizRounds.length
    };
  };

  // 퀴즈 답안 제출 (스피드 퀴즈로 변경)
  const submitQuizAnswer = () => {
    if (speedQuizMode) {
      submitSpeedQuizAnswer();
    } else {
      // 기존 단일 퀴즈 로직 (사용하지 않음)
      alert('퀴즈 모드가 올바르지 않습니다.');
    }
  };

  // 멀티플레이어 타이밍 게임 시작
  const startMultiplayerTimingGame = () => {
    if (candidatePlaces.length === 0) {
      alert('후보 장소가 없습니다.');
      return;
    }

    const participant = getCurrentParticipant();
    if (!participant) {
      alert('먼저 미팅에 참가해주세요.');
      return;
    }

    setResult(null);
    setResultAnimating(false);
    
    // 1.00~7.00 초 사이의 랜덤 목표 시간 생성 (0.5초 단위)
    const possibleTimes = [1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0, 5.5, 6.0, 6.5, 7.0];
    const randomTarget = possibleTimes[Math.floor(Math.random() * possibleTimes.length)];
    const newGameId = `timing_${meetingId}_${Date.now()}`;
    
    // 게임 생성자로 설정
    setIsGameOwner(true);
    setCurrentPlayer(participant);
    
    // 소켓을 통해 게임 시작 알림
    if (socket) {
      socket.emit('timing-game-start', {
        meetingId,
        targetTime: randomTarget,
        gameId: newGameId,
        startedBy: participant.name
      });
      
      // 자신도 게임에 참가
      socket.emit('timing-game-join', {
        meetingId,
        player: participant
      });
    }
  };

  // 기존 싱글플레이어 타이밍 게임 시작 (참고용으로 유지)
  const startTimingGame = () => {
    // 멀티플레이어 모드로 대체
    startMultiplayerTimingGame();
  };

  // 멀티플레이어 게임 참가
  const joinMultiplayerTimingGame = () => {
    const participant = getCurrentParticipant();
    if (!participant) {
      alert('먼저 미팅에 참가해주세요.');
      return;
    }
    
    if (socket && gameId) {
      setCurrentPlayer(participant);
      socket.emit('timing-game-join', {
        meetingId,
        player: participant
      });
    }
  };

  // 멀티플레이어 타이밍 게임 스톱
  const stopMultiplayerTimingGame = () => {
    if (!gameRunning || !currentPlayer || !multiplayerMode) return;
    
    const finalTime = currentTime;
    setStoppedTime(finalTime);
    setGameRunning(false);
    setGamePhase('stopped');
    
    // 인터벌 중지 (개인)
    if (gameInterval) {
      clearInterval(gameInterval);
      setGameInterval(null);
    }
    
    // 소켓을 통해 결과 전송
    if (socket) {
      socket.emit('timing-game-stop', {
        meetingId,
        playerId: currentPlayer.id,
        stoppedTime: finalTime
      });
    }
  };

  // Stop 버튼 클릭 (멀티플레이어/싱글플레이어 구분)
  const stopTimingGame = () => {
    if (multiplayerMode) {
      stopMultiplayerTimingGame();
      return;
    }
    
    // 기존 싱글플레이어 로직 (참고용으로 유지하지만 현재는 사용하지 않음)
    if (!gameRunning) return;
    
    const finalTime = currentTime;
    setStoppedTime(finalTime);
    setGameRunning(false);
    setGamePhase('stopped');
    
    // 인터벌 중지
    if (gameInterval) {
      clearInterval(gameInterval);
      setGameInterval(null);
    }
    
    // 결과 계산 (밀리초 단위로 계산)
    const targetMs = targetTime * 1000;
    const difference = Math.abs(targetMs - finalTime);
    
    let resultMessage = '';
    let isWin = false;
    
    // 정확도에 따른 승부 결정 (100ms 이하면 완벽, 500ms 이하면 성공)
    if (difference <= 100) {
      resultMessage = `🎯 완벽합니다! 목표: ${targetTime.toFixed(2)}초, 기록: ${(finalTime/1000).toFixed(2)}초 (차이: ${difference}ms)`;
      isWin = true;
    } else if (difference <= 300) {
      resultMessage = `🎉 훌륭합니다! 목표: ${targetTime.toFixed(2)}초, 기록: ${(finalTime/1000).toFixed(2)}초 (차이: ${difference}ms)`;
      isWin = true;
    } else if (difference <= 500) {
      resultMessage = `😊 좋습니다! 목표: ${targetTime.toFixed(2)}초, 기록: ${(finalTime/1000).toFixed(2)}초 (차이: ${difference}ms)`;
      isWin = true;
    } else {
      resultMessage = `😅 아쉽네요! 목표: ${targetTime.toFixed(2)}초, 기록: ${(finalTime/1000).toFixed(2)}초 (차이: ${difference}ms)`;
      isWin = false;
    }
    
    setTimeout(() => {
      if (isWin) {
        // 승리 시 랜덤 장소 선정
        const randomPlace = candidatePlaces[Math.floor(Math.random() * candidatePlaces.length)];
        recordSelectionOnServer(randomPlace);
        
        const resultData = {
          selectedPlace: randomPlace,
          message: `⏱️ ${resultMessage} "${randomPlace.name}"이(가) 선정되었습니다!`,
          fairnessInfo: getFairnessInfo(randomPlace),
          isRestoredResult: false,
          timestamp: new Date().toISOString(),
          selectionMethod: 'timing'
        };
        
        setResult(resultData);
        setResultAnimating(true);
        
        // localStorage에 저장
        if (meetingId) {
          try {
            localStorage.setItem(`roulette_result_${meetingId}`, JSON.stringify(resultData));
          } catch (error) {
            console.error('타이밍 게임 결과 저장 실패:', error);
          }
        }
        
        setTimeout(() => setResultAnimating(false), 3000);
        
        if (onLocationSelected) {
          onLocationSelected(randomPlace);
        }

        setGamePhase('finished');
      } else {
        alert(`${resultMessage}\n\n다시 시도해보세요!`);
        resetTimingGame();
      }
    }, 1500);
  };

  // 타이밍 게임 초기화
  const resetTimingGame = () => {
    if (gameInterval) {
      clearInterval(gameInterval);
      setGameInterval(null);
    }
    setTimingGameMode(false);
    setTargetTime(null);
    setCurrentTime(0);
    setStoppedTime(null);
    setGameRunning(false);
    setGamePhase('waiting');
    
    // 멀티플레이어 모드도 초기화
    if (multiplayerMode) {
      resetMultiplayerTimingGame();
    }
  };

  // 멀티플레이어 타이밍 게임 초기화
  const resetMultiplayerTimingGame = () => {
    setMultiplayerMode(false);
    setGameId(null);
    setGamePlayers([]);
    setCurrentPlayer(null);
    setGameResults([]);
    setGameWinner(null);
    setIsGameOwner(false);
    setTimingGameMode(false);
    setTargetTime(null);
    setCurrentTime(0);
    setStoppedTime(null);
    setGameRunning(false);
    setGamePhase('waiting');
    setGameAutoEndTime(null);
    setGameTimeRemaining(null);
    
    if (gameInterval) {
      clearInterval(gameInterval);
      setGameInterval(null);
    }
  };

  // 현재 참가자 정보 가져오기
  const getCurrentParticipant = () => {
    const participantKey = `meeting_${meetingId}_participant`;
    const participantData = localStorage.getItem(participantKey);
    try {
      return participantData ? JSON.parse(participantData) : null;
    } catch (error) {
      console.warn('참가자 데이터 파싱 실패:', error);
      return null;
    }
  };

  // 시간을 MM:SS:MS 형식으로 포맷
  const formatTime = (milliseconds) => {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const ms = Math.floor((milliseconds % 1000) / 10);
    
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}:${ms.toString().padStart(2, '0')}`;
  };

  const getFairnessInfo = (selectedPlace, placesList = candidatePlaces) => {
    const mode = fairnessModes.find(m => m.id === fairnessMode);
    
    // placesList가 비어있거나 유효하지 않은 경우 기본값 반환
    if (!placesList || placesList.length === 0) {
      return {
        mode: mode?.name || '완전 랜덤',
        description: mode?.description || '모든 후보 장소가 동일한 확률로 선정',
        placeSelections: selectedPlace.selectedCount || 0,
        avgSelections: '0.0',
        fairnessScore: 100
      };
    }
    
    const totalSelections = placesList.reduce((sum, p) => sum + (p.selectedCount || 0), 0);
    const avgSelections = totalSelections / placesList.length;
    const placeSelections = selectedPlace.selectedCount || 0;
    
    // NaN 체크 및 안전한 계산
    const safeAvgSelections = isNaN(avgSelections) ? 0 : avgSelections;
    const safeFairnessScore = isNaN(avgSelections) || avgSelections === 0 
      ? 100 
      : Math.max(0, Math.min(100, 100 - (Math.abs(placeSelections - avgSelections) / avgSelections * 100)));
    
    return {
      mode: mode?.name || '완전 랜덤',
      description: mode?.description || '모든 후보 장소가 동일한 확률로 선정',
      placeSelections,
      avgSelections: safeAvgSelections.toFixed(1),
      fairnessScore: Math.round(safeFairnessScore)
    };
  };

  const recordSelectionOnServer = async (selectedPlace) => {
    try {
      console.log('서버에 선정 결과 저장 시작:', selectedPlace);
      const response = await api.post(`/votes/${meetingId}/selections`, {
        participantId: selectedPlace.id
      });
      console.log('서버 저장 성공:', response.data);
      
      // 서버 저장 성공 후 잠시 대기 후 데이터 다시 로드
      setTimeout(() => {
        if (!isDataLoading) {
          loadCandidatePlacesData();
        }
      }, 1500); // 1.5초 후 데이터 다시 로드
      
    } catch (error) {
      console.error('선정 기록 저장 실패:', error);
      console.error('오류 응답:', error.response?.data);
      // 에러 발생 시 수동으로 데이터 다시 로드
      if (!isDataLoading) {
        loadCandidatePlacesData();
      }
    }
  };

  const onWheelFinished = (winner) => {
    // 실제 rulette owner만 서버에 저장
    if (isRouletteOwner) {
      recordSelectionOnServer(winner);
    }
    
    setSpinning(false);
    
    const fairnessInfo = getFairnessInfo(winner);
    const resultData = {
      selectedPlace: winner,
      message: `${winner.name}이(가) 선정되었습니다!`,
      fairnessInfo,
      isRestoredResult: false,
      timestamp: new Date().toISOString()
    };
    
    setResult(resultData);
    
    // localStorage에 결과 저장
    if (meetingId) {
      try {
        localStorage.setItem(`roulette_result_${meetingId}`, JSON.stringify(resultData));
        console.log('🎲 룰렛 결과 localStorage에 저장:', resultData);
      } catch (error) {
        console.error('룰렛 결과 저장 실패:', error);
      }
    }
    
    // 결과 애니메이션 시작
    setResultAnimating(true);
    
    // 3초 후 애니메이션 정지
    setTimeout(() => {
      setResultAnimating(false);
    }, 3000);
    
    setIsRouletteOwner(false); // 소유권 해제
    
    if (onLocationSelected) {
      onLocationSelected(winner);
    }
  };

  const getParticipantColor = (index) => {
    const colors = [
      'bg-red-100 border-red-300 text-red-700',
      'bg-blue-100 border-blue-300 text-blue-700',
      'bg-green-100 border-green-300 text-green-700',
      'bg-yellow-100 border-yellow-300 text-yellow-700',
      'bg-purple-100 border-purple-300 text-purple-700',
      'bg-pink-100 border-pink-300 text-pink-700'
    ];
    return colors[index % colors.length];
  };

  const getFairnessLevel = (count) => {
    const avg = candidatePlaces.reduce((sum, p) => sum + p.selectedCount, 0) / candidatePlaces.length;
    if (count === 0) return { level: '미선정', color: 'text-gray-500' };
    if (count < avg * 0.7) return { level: '적음', color: 'text-green-600' };
    if (count > avg * 1.3) return { level: '많음', color: 'text-red-600' };
    return { level: '보통', color: 'text-blue-600' };
  };

  // 결과 초기화 및 재시작 함수
  const clearResult = () => {
    const gameType = result?.selectionMethod === 'dice' ? '주사위' : '룰렛';
    
    // 결과 초기화
    setResult(null);
    setResultAnimating(false);
    
    // localStorage에서도 제거
    if (meetingId) {
      try {
        localStorage.removeItem(`roulette_result_${meetingId}`);
        console.log(`🗑️ ${gameType} 결과 초기화 완료`);
      } catch (error) {
        console.error(`${gameType} 결과 초기화 실패:`, error);
      }
    }
    
    // 바로 새 게임 시작
    setTimeout(() => {
      startRandomSelection();
    }, 100); // 상태 업데이트 후 게임 시작
  };

  // 결과 확정 함수
  const handleConfirmResult = async () => {
    if (!result || !result.selectedPlace) {
      alert('선정 결과가 없습니다.');
      return;
    }

    try {
      const selectedPlace = result.selectedPlace;
      
      // 미팅 정보 업데이트
      const updatedMeeting = {
        ...meeting,
        selectedPlace: {
          id: selectedPlace.id,
          name: selectedPlace.name,
          category: selectedPlace.category,
          address: selectedPlace.address || selectedPlace.location,
          rating: selectedPlace.rating,
          coordinates: selectedPlace.coordinates
        },
        selectionMethod: result.selectionMethod || 'random',
        meetingStatus: 'completed',
        participants: meeting?.participants || []
      };

      // 상위 컴포넌트에 업데이트 알림
      if (onMeetingUpdate) {
        onMeetingUpdate(updatedMeeting);
      }

      // 히스토리에 저장 (로그인 사용자만)
      if (user && !user.isGuest) {
        try {
          await saveMeetingHistory(user, updatedMeeting);
          alert(`🎉 ${selectedPlace.name}이(가) 최종 장소로 확정되었습니다!\n\n✅ 미팅 히스토리에 저장되었습니다.`);
        } catch (historyError) {
          alert(`🎉 ${selectedPlace.name}이(가) 최종 장소로 확정되었습니다!\n\n⚠️ 히스토리 저장에 실패했습니다. 대시보드에서 확인해주세요.`);
        }
      } else {
        alert(`🎉 ${selectedPlace.name}이(가) 최종 장소로 확정되었습니다!`);
      }
      
    } catch (error) {
      console.error('결과 확정 중 오류:', error);
      alert(`🎉 ${result.selectedPlace.name}이(가) 최종 장소로 확정되었습니다!`);
    }
  };

  // 로딩 중일 때
  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-600">후보 장소 정보를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  // 후보 장소가 없는 경우
  if (candidatePlaces.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="text-center py-12">
          <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-gray-100 mb-4">
            <UserIcon className="h-8 w-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">후보 장소가 없습니다</h3>
          <p className="text-gray-600 mb-4">
            먼저 "그룹 투표" 탭에서 장소를 추가하고 투표에 참여해주세요.
          </p>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
            <p className="font-medium mb-1">💡 사용 방법:</p>
            <p>1. "그룹 투표" 탭으로 이동</p>
            <p>2. 후보 장소를 추가하고 투표 참여</p>
            <p>3. "최종 결정" 탭에서 공정한 장소 선정 진행</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 공정성 모드 선택 */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <ScaleIcon className="h-6 w-6 mr-2 text-primary-600" />
          공정성 모드 선택
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {fairnessModes.map(mode => (
            <button
              key={mode.id}
              onClick={() => {
                // 모든 게임 상태 초기화
                setSpinning(false);
                setDiceRolling(false);
                setQuizMode(false);
                setTimingGameMode(false);
                setGameRunning(false);
                setGamePhase('waiting');
                if (gameInterval) {
                  clearInterval(gameInterval);
                  setGameInterval(null);
                }
                setCurrentQuiz(null);
                setQuizAnswer('');
                setTargetTime(null);
                setCurrentTime(0);
                setStoppedTime(null);
                setDiceResult(null);
                setShouldRoll3D(false);
                
                // 모드 변경
                setFairnessMode(mode.id);
              }}
              className={`p-4 text-sm rounded-lg border-4 transition-all duration-300 hover:transform hover:scale-105 ${
                fairnessMode === mode.id
                  ? 'border-primary-500 bg-primary-50 text-primary-700 transform scale-105 shadow-lg'
                  : 'border-gray-300 text-gray-600 hover:bg-gray-50 hover:border-gray-400'
              }`}
            >
              <div className="text-3xl mb-2">{mode.icon}</div>
              <div className="font-bold text-sm">{mode.name}</div>
              <div className="text-xs opacity-75 mt-1 leading-tight">{mode.description}</div>
            </button>
          ))}
        </div>
      </div>

      {/* 선정 방식별 UI - Compact Layout */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 게임 영역 */}
          <div className="lg:col-span-2">
            {/* 룰렛 모드 */}
            {fairnessMode === 'random' && (
              <div className="flex flex-col items-center space-y-3">
                <h4 className="text-lg font-bold text-gray-900">🎯 룰렛 게임</h4>
                <p className="text-sm text-gray-600 text-center">
                  {result ? '중앙의 파란 원을 클릭하여 다시 도전하세요!' : '중앙의 파란 원을 클릭하여 룰렛을 시작하세요!'}
                </p>
                <div className="scale-75 origin-center">
                  <WheelComponent 
                    segments={candidatePlaces}
                    onFinished={onWheelFinished}
                    isSpinning={spinning}
                    winningSegment={winningSegment}
                    socket={socket}
                    meetingId={meetingId}
                    onCenterClick={() => {
                      if (!spinning && candidatePlaces.length > 0) {
                        startRandomSelection();
                      }
                    }}
                  />
                </div>
              </div>
            )}

            {/* 주사위 모드 */}
            {fairnessMode === 'dice' && (
              <div className="space-y-3">
                <h4 className="text-lg font-bold text-gray-900 text-center">🎲 3D 주사위</h4>
                <p className="text-sm text-gray-600 text-center">
                  {result ? '주사위를 클릭하여 다시 시작하세요!' : '주사위를 클릭하여 게임을 시작하세요!'}
                </p>
                
                {/* 3D 주사위 캔버스 - 더 작게 */}
                <div className="w-full max-w-xs mx-auto">
                  <Dice3D 
                    onResult={handle3DDiceResult}
                    shouldRoll={shouldRoll3D}
                    resetRoll={reset3DDice}
                    onDiceClick={() => {
                      if (!diceRolling && candidatePlaces.length > 0) {
                        if (result) {
                          // 결과가 있을 때는 다시 버튼과 동일하게 동작
                          clearResult();
                        } else {
                          // 결과가 없을 때는 게임 시작
                          startRandomSelection();
                        }
                      }
                    }}
                    isClickable={!diceRolling && candidatePlaces.length > 0}
                    hasResult={!!result}
                  />
                </div>
              </div>
            )}

            {/* 스피드 퀴즈 모드 */}
            {fairnessMode === 'quiz' && (
              <div className="space-y-3">
                <h4 className="text-lg font-bold text-gray-900 text-center">🧠 스피드 퀴즈</h4>
                
                {!speedQuizMode ? (
                  <div className="text-center space-y-3">
                    <div className="bg-blue-50 rounded-lg p-3">
                      <p className="text-blue-800 font-medium mb-1 text-sm">💡 게임 방법</p>
                      <p className="text-xs text-blue-700">
                        모든 후보 장소에 대한 퀴즈가 출제됩니다.<br/>
                        정답률과 속도에 따라 점수를 획득하고,<br/>
                        최종 점수 가중치로 장소가 결정됩니다!
                      </p>
                    </div>
                    
                    {!result && (
                      <button
                        onClick={startRandomSelection}
                        disabled={candidatePlaces.length === 0}
                        className="px-6 py-3 rounded-lg font-bold text-sm transition-all duration-300 w-full max-w-xs mx-auto bg-gradient-to-r from-green-500 to-teal-600 text-white hover:from-green-600 hover:to-teal-700 hover:transform hover:scale-105 shadow-lg"
                      >
                        🚀 스피드 퀴즈 시작!
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {/* 라운드 정보 및 타이머 */}
                    <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-3 border-2 border-blue-200">
                      <div className="flex justify-between items-center text-sm">
                        <span className="font-bold text-blue-800">
                          📍 라운드 {currentRound + 1} / {quizRounds.length}
                        </span>
                        <span className="font-bold text-purple-800">
                          ⏱️ {roundTimeLeft}초
                        </span>
                      </div>
                      <div className="text-xs text-gray-600 mt-1">
                        {currentQuiz?.place?.name} 관련 문제
                      </div>
                    </div>

                    {/* 실시간 점수판 */}
                    {participants.size > 0 && (
                      <div className="bg-yellow-50 rounded-lg p-2 border border-yellow-200">
                        <p className="text-xs font-bold text-yellow-800 mb-1">🏆 실시간 점수</p>
                        <div className="text-xs space-y-1 max-h-16 overflow-y-auto">
                          {Array.from(participants.entries())
                            .sort(([,a], [,b]) => b - a)
                            .map(([userId, score], index) => (
                              <div key={userId} className="flex justify-between">
                                <span className={index === 0 ? 'font-bold text-yellow-700' : 'text-gray-600'}>
                                  {index === 0 ? '👑 ' : `${index + 1}. `}
                                  {userId === user?.id ? '나' : '참가자'}
                                </span>
                                <span className={index === 0 ? 'font-bold text-yellow-700' : 'text-gray-600'}>
                                  {score}점
                                </span>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}

                    {/* 퀴즈 문제 */}
                    <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg p-3 border-2 border-purple-200">
                      <h5 className="text-sm font-bold text-purple-900 mb-2">❓ {currentQuiz?.question}</h5>
                      
                      <div className="grid grid-cols-1 gap-2">
                        {currentQuiz?.answers?.map((answer, index) => (
                          <button
                            key={index}
                            onClick={() => setQuizAnswer(answer)}
                            className={`p-2 rounded-lg border-2 transition-all text-left text-sm ${
                              quizAnswer === answer
                                ? 'border-purple-500 bg-purple-100 text-purple-800 font-bold'
                                : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                            }`}
                          >
                            <span className="font-bold text-purple-600 mr-2">{String.fromCharCode(65 + index)}.</span>
                            {answer}
                          </button>
                        ))}
                      </div>
                    </div>
                    
                    {/* 답안 제출 버튼 */}
                    <div className="flex justify-center space-x-2">
                      <button
                        onClick={submitQuizAnswer}
                        disabled={!quizAnswer || roundAnswers.has(userId)}
                        className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed font-bold text-sm"
                      >
                        {roundAnswers.has(userId) ? '✅ 제출완료' : '🚀 정답 제출'}
                      </button>
                      
                      {/* 진행자만 다음 라운드 버튼 표시 */}
                      {isQuizOwner && (
                        <button
                          onClick={nextRound}
                          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 font-bold text-sm"
                        >
                          {currentRound + 1 < quizRounds.length ? '➡️ 다음 라운드' : '🏁 퀴즈 완료'}
                        </button>
                      )}
                    </div>

                    {/* 현재 라운드 답안 현황 */}
                    {roundAnswers.size > 0 && (
                      <div className="bg-gray-50 rounded-lg p-2 border border-gray-200">
                        <p className="text-xs font-bold text-gray-700 mb-1">
                          📝 답안 제출 현황 ({roundAnswers.size}명)
                        </p>
                        <div className="text-xs text-gray-600">
                          {Array.from(roundAnswers.entries()).map(([userId, answer]) => (
                            <div key={userId} className="flex justify-between">
                              <span>{userId === user?.id ? '나' : '참가자'}</span>
                              <span className={answer.isCorrect ? 'text-green-600 font-bold' : 'text-red-600'}>
                                {answer.isCorrect ? `✅ +${answer.score}점` : '❌ 0점'}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 컨트롤 및 결과 영역 */}
                    <div className="space-y-4">
                         {/* 참가자 목록 - 간소화 */}
             {candidatePlaces.length > 0 && (
               <div className="space-y-2">
                 <h5 className="text-sm font-bold text-gray-900">👥 후보 장소 ({candidatePlaces.length}개)</h5>
                 <div className={`space-y-1 ${candidatePlaces.length > 7 ? 'max-h-56 overflow-y-auto' : ''}`}>
                   {candidatePlaces.map((place, index) => {
                     const isSelected = result && result.selectedPlace && result.selectedPlace.id === place.id;
                     return (
                       <div key={place.id} className={`flex items-center justify-between p-2 rounded-lg text-xs ${
                         isSelected ? 'bg-green-50 border-2 border-green-300' : getParticipantColor(index)
                       }`}>
                         <div className="flex items-center space-x-2 min-w-0 flex-1">
                           <span className="text-sm">{place.avatar}</span>
                           <span className={`font-medium truncate ${isSelected ? 'text-green-800 font-bold' : ''}`}>
                             {place.name}
                           </span>
                           {isSelected && (
                             <span className="text-green-600 font-bold ml-1">✅</span>
                           )}
                         </div>
                         <div className="flex items-center space-x-1 text-xs">
                           <span>🗳️ {place.votes}</span>
                           {place.selectedCount > 0 && (
                             <span className="bg-yellow-100 text-yellow-800 px-1 py-0.5 rounded">
                               선정 {place.selectedCount}회
                             </span>
                           )}
                           {isSelected && (
                             <span className="bg-green-100 text-green-800 px-2 py-0.5 rounded font-bold">
                               🏆 최종 선정
                             </span>
                           )}
                         </div>
                       </div>
                     );
                   })}
                 </div>
                 {candidatePlaces.length > 7 && (
                   <div className="text-center">
                     <p className="text-xs text-gray-500 italic">
                       📜 스크롤하여 더 많은 장소를 확인하세요
                     </p>
                   </div>
                 )}
               </div>
             )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default RandomSelector; 