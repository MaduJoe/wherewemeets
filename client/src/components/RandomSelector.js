import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import io from 'socket.io-client';
import { 
  UserIcon,
  TrophyIcon,
  ScaleIcon
} from '@heroicons/react/24/outline';
import Dice3D from './Dice3D';

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
const WheelComponent = ({ segments, onFinished, isSpinning, winningSegment, socket, meetingId }) => {
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
              stroke={isAnimating ? '#fbbf24' : '#d1d5db'}
              strokeWidth="4"
              className="transition-all duration-300"
            />
            
            {/* 중앙 그라데이션 정의 */}
            <defs>
              <linearGradient id="gradientCenter" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#fef3c7"/>
                <stop offset="100%" stopColor="#f59e0b"/>
              </linearGradient>
            </defs>
            
            {/* 중앙 아이콘 */}
            <g transform="translate(200, 200)">
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

const RandomSelector = ({ meetingId, onLocationSelected }) => {
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
  // const [quizParticipants, setQuizParticipants] = useState([]);
  
  // 타이밍 게임 상태
  const [timingGameMode, setTimingGameMode] = useState(false);
  const [targetTime, setTargetTime] = useState(null); // 목표 시간 (초)
  const [currentTime, setCurrentTime] = useState(0); // 현재 타이머 시간 (밀리초)
  const [gameRunning, setGameRunning] = useState(false);
  const [gamePhase, setGamePhase] = useState('waiting'); // 'waiting', 'running', 'stopped', 'finished'
  const [gameInterval, setGameInterval] = useState(null);
  const [stoppedTime, setStoppedTime] = useState(null);

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
      id: 'balanced',
      name: '타이밍 스톱',
      icon: '⏱️',
      description: '목표 시간에 가장 근접하게 멈춘 사람이 승리'
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

    if (spinning || diceRolling || quizMode || timingGameMode) {
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
      case 'balanced':
        startTimingGame();
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

  // 퀴즈 시작
  const startQuiz = () => {
    if (candidatePlaces.length === 0) {
      alert('후보 장소가 없습니다.');
      return;
    }

    setResult(null);
    setResultAnimating(false);
    
    // 랜덤으로 장소 선택해서 퀴즈 생성
    const randomPlace = candidatePlaces[Math.floor(Math.random() * candidatePlaces.length)];
    const quiz = generateQuiz(randomPlace);
    
    setCurrentQuiz(quiz);
    setQuizMode(true);
    setQuizAnswer('');
  };

  // 퀴즈 답안 제출
  const submitQuizAnswer = () => {
    if (!quizAnswer) {
      alert('답안을 선택해주세요!');
      return;
    }

    const isCorrect = quizAnswer === currentQuiz.correct;
    
    if (isCorrect) {
      // 정답 - 해당 장소 선정
      const selectedPlace = currentQuiz.place;
      recordSelectionOnServer(selectedPlace);
      
      const resultData = {
        selectedPlace,
        message: `🧠 정답입니다! "${selectedPlace.name}"이(가) 선정되었습니다!`,
        fairnessInfo: getFairnessInfo(selectedPlace),
        isRestoredResult: false,
        timestamp: new Date().toISOString(),
        selectionMethod: 'quiz'
      };
      
      setResult(resultData);
      setResultAnimating(true);
      
      // localStorage에 저장
      if (meetingId) {
        try {
          localStorage.setItem(`roulette_result_${meetingId}`, JSON.stringify(resultData));
        } catch (error) {
          console.error('퀴즈 결과 저장 실패:', error);
        }
      }
      
      setTimeout(() => setResultAnimating(false), 3000);
      
      if (onLocationSelected) {
        onLocationSelected(selectedPlace);
      }
    } else {
      alert(`🤔 아쉽게도 틀렸습니다! 정답은 "${currentQuiz.correct}"입니다. 다시 시도해보세요!`);
    }
    
    setQuizMode(false);
    setCurrentQuiz(null);
    setQuizAnswer('');
  };

  // 타이밍 게임 시작
  const startTimingGame = () => {
    if (candidatePlaces.length === 0) {
      alert('후보 장소가 없습니다.');
      return;
    }

    setResult(null);
    setResultAnimating(false);
    
    // 1.00~7.00 초 사이의 랜덤 목표 시간 생성 (0.5초 단위)
    const possibleTimes = [1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0, 5.5, 6.0, 6.5, 7.0];
    const randomTarget = possibleTimes[Math.floor(Math.random() * possibleTimes.length)];
    
    setTargetTime(randomTarget);
    setTimingGameMode(true);
    setCurrentTime(0);
    setStoppedTime(null);
    setGamePhase('running');
    setGameRunning(true);
    
    // 타이머 시작 (10ms마다 업데이트)
    const interval = setInterval(() => {
      setCurrentTime(prev => prev + 10);
    }, 10);
    
    setGameInterval(interval);
  };

  // Stop 버튼 클릭
  const stopTimingGame = () => {
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

  // 결과 초기화 함수
  const clearResult = () => {
    if (window.confirm('룰렛 결과를 초기화하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다.')) {
      setResult(null);
      setResultAnimating(false);
      
      // localStorage에서도 제거
      if (meetingId) {
        try {
          localStorage.removeItem(`roulette_result_${meetingId}`);
          console.log('🗑️ 룰렛 결과 초기화 완료');
        } catch (error) {
          console.error('룰렛 결과 초기화 실패:', error);
        }
      }
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
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
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
              className={`p-4 text-sm rounded-lg border-2 transition-all duration-300 hover:transform hover:scale-105 ${
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

      {/* 선정 방식별 UI */}
      <div className="bg-white rounded-lg shadow p-6">
        {/* 룰렛 모드 */}
        {fairnessMode === 'random' && (
          <div className="flex flex-col items-center">
            <div className="mb-4">
              <div className="scale-75">
                <WheelComponent 
                  segments={candidatePlaces}
                  onFinished={onWheelFinished}
                  isSpinning={spinning}
                  winningSegment={winningSegment}
                  socket={socket}
                  meetingId={meetingId}
                />
              </div>
            </div>

            <button
              onClick={startRandomSelection}
              disabled={spinning || candidatePlaces.length === 0}
              className={`px-8 py-4 rounded-lg font-bold text-lg transition-all duration-300 w-full max-w-md ${
                spinning 
                  ? 'bg-yellow-500 text-white cursor-not-allowed animate-pulse' 
                  : 'bg-gradient-to-r from-blue-500 to-purple-600 text-white hover:from-blue-600 hover:to-purple-700 hover:transform hover:scale-105 shadow-lg'
              }`}
            >
              {spinning ? (
                <span>🎲 룰렛 돌리는 중...</span>
              ) : (
                <span>
                  🎯 {fairnessModes.find(m => m.id === fairnessMode)?.name}으로 선정하기
                </span>
              )}
            </button>
          </div>
        )}

        {/* 타이밍 게임 모드 */}
        {fairnessMode === 'balanced' && (
          <div className="flex flex-col items-center space-y-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4">⏱️ 타이밍 스톱 게임</h3>
            
            {!timingGameMode ? (
              <div className="text-center space-y-4">
                <div className="bg-purple-50 rounded-lg p-6 max-w-lg">
                  <p className="text-purple-800 font-medium mb-2">🎯 게임 방법</p>
                  <p className="text-sm text-purple-700">
                    목표 시간이 공개됩니다.<br/>
                    타이머가 0.00초부터 카운트업 하는 동안<br/>
                    목표 시간에 가장 근접한 순간에 <strong>STOP</strong>을 누르세요!<br/>
                    차이가 0.5초 이하면 성공입니다.
                  </p>
                </div>
                
                <button
                  onClick={startRandomSelection}
                  disabled={candidatePlaces.length === 0}
                  className="px-8 py-4 rounded-lg font-bold text-lg transition-all duration-300 w-full max-w-md bg-gradient-to-r from-purple-500 to-indigo-600 text-white hover:from-purple-600 hover:to-indigo-700 hover:transform hover:scale-105 shadow-lg"
                >
                  ⏱️ 타이밍 게임 시작!
                </button>
              </div>
            ) : (
              <div className="w-full max-w-lg space-y-6">
                {gamePhase === 'running' && (
                  <div className="text-center space-y-6">
                    {/* 목표 시간 표시 */}
                    <div className="bg-gradient-to-r from-yellow-50 to-orange-50 rounded-lg p-4 border-2 border-yellow-300">
                      <h4 className="text-xl font-bold text-orange-900 mb-2">
                        🎯 목표: {targetTime.toFixed(2)}초에 STOP을 누르세요!
                      </h4>
                    </div>
                    
                    <div className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-lg p-8 border-2 border-purple-200">
                      {/* 현재 타이머 */}
                      <div className="mb-6">
                        <p className="text-sm text-gray-600 mb-2">현재 시간</p>
                        <div className={`w-full bg-black text-green-400 rounded-lg p-6 font-mono text-4xl font-bold border-4 border-gray-800 ${
                          gameRunning ? 'animate-pulse shadow-2xl' : 'shadow-lg'
                        }`}>
                          {formatTime(currentTime)}
                        </div>
                      </div>
                      
                      <button
                        onClick={stopTimingGame}
                        disabled={!gameRunning}
                        className={`px-16 py-6 rounded-lg font-bold text-2xl transition-all duration-300 ${
                          gameRunning 
                            ? 'bg-gradient-to-r from-red-500 to-pink-600 text-white hover:from-red-600 hover:to-pink-700 hover:transform hover:scale-110 shadow-lg'
                            : 'bg-gray-400 text-gray-200 cursor-not-allowed'
                        }`}
                      >
                        🛑 STOP!
                      </button>
                    </div>
                    
                    <button
                      onClick={resetTimingGame}
                      className="px-6 py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600 font-bold"
                    >
                      ❌ 게임 중단
                    </button>
                  </div>
                )}
                
                {gamePhase === 'stopped' && (
                  <div className="text-center space-y-4">
                    <div className="bg-gradient-to-r from-yellow-50 to-orange-50 rounded-lg p-6 border-2 border-yellow-300">
                      <h4 className="text-lg font-bold text-orange-900 mb-4">
                        🔍 결과 확인 중...
                      </h4>
                      
                      <div className="flex justify-center items-center space-x-8">
                        <div className="text-center">
                          <p className="text-sm text-gray-600">목표 시간</p>
                          <div className="bg-yellow-200 rounded-lg p-4 font-mono text-xl font-bold animate-pulse">
                            {targetTime.toFixed(2)}초
                          </div>
                        </div>
                        
                        <div className="text-4xl">VS</div>
                        
                        <div className="text-center">
                          <p className="text-sm text-gray-600">멈춘 시간</p>
                          <div className="bg-purple-200 rounded-lg p-4 font-mono text-xl font-bold">
                            {(stoppedTime/1000).toFixed(2)}초
                          </div>
                        </div>
                      </div>
                      
                      <p className="text-sm text-gray-600 mt-4">
                        차이: {Math.abs(targetTime * 1000 - stoppedTime)}ms
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* 주사위 모드 */}
        {fairnessMode === 'dice' && (
          <div className="flex flex-col items-center space-y-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4">🎲 운명의 3D 주사위</h3>
            
            {/* 3D 주사위 캔버스 */}
            <div className="w-full max-w-4xl">
              <Dice3D 
                onResult={handle3DDiceResult}
                shouldRoll={shouldRoll3D}
                resetRoll={reset3DDice}
              />
            </div>

            {/* 장소별 주사위 번호 매핑 표시 */}
            {!diceRolling && (
              <div className="w-full max-w-4xl">
                <div className="bg-blue-50 rounded-lg p-4 mb-4">
                  <h4 className="text-lg font-bold text-blue-900 mb-2">🎯 주사위 번호 매핑</h4>
                  <p className="text-sm text-blue-700">각 숫자가 나오면 해당하는 장소가 선정됩니다!</p>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {candidatePlaces.slice(0, 6).map((place, index) => {
                    const diceNum = (index % 6) + 1;
                    const diceSymbols = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
                    return (
                      <div key={place.id} className={`rounded-lg p-4 flex items-center space-x-3 transition-all ${
                        diceResult === diceNum 
                          ? 'bg-yellow-200 border-2 border-yellow-500 shadow-lg transform scale-105' 
                          : 'bg-gray-50 border border-gray-200'
                      }`}>
                        <div className="text-3xl">
                          {diceSymbols[diceNum - 1]}
                        </div>
                        <div className="flex items-center space-x-2 min-w-0 flex-1">
                          <span className="text-lg">{place.avatar}</span>
                          <span className="font-medium text-sm truncate">{place.name}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <button
              onClick={startRandomSelection}
              disabled={diceRolling || candidatePlaces.length === 0}
              className={`px-8 py-4 rounded-lg font-bold text-lg transition-all duration-300 w-full max-w-md ${
                diceRolling 
                  ? 'bg-yellow-500 text-white cursor-not-allowed animate-pulse'
                  : 'bg-gradient-to-r from-red-500 to-pink-600 text-white hover:from-red-600 hover:to-pink-700 hover:transform hover:scale-105 shadow-lg'
              }`}
            >
              {diceRolling ? (
                <span>🎲 3D 주사위 굴리는 중...</span>
              ) : (
                <span>🎲 운명의 3D 주사위 굴리기!</span>
              )}
            </button>
          </div>
        )}

        {/* 퀴즈 모드 */}
        {fairnessMode === 'quiz' && (
          <div className="flex flex-col items-center space-y-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4">🧠 스피드 퀴즈 대결</h3>
            
            {!quizMode ? (
              <div className="text-center space-y-4">
                <div className="bg-blue-50 rounded-lg p-6 max-w-md">
                  <p className="text-blue-800 font-medium mb-2">💡 게임 방법</p>
                  <p className="text-sm text-blue-700">
                    후보 장소 중 하나에 대한 퀴즈가 출제됩니다.<br/>
                    정답을 맞히면 해당 장소가 최종 선정됩니다!
                  </p>
                </div>
                
                <button
                  onClick={startRandomSelection}
                  disabled={candidatePlaces.length === 0}
                  className="px-8 py-4 rounded-lg font-bold text-lg transition-all duration-300 w-full max-w-md bg-gradient-to-r from-green-500 to-teal-600 text-white hover:from-green-600 hover:to-teal-700 hover:transform hover:scale-105 shadow-lg"
                >
                  🧠 퀴즈 시작하기!
                </button>
              </div>
            ) : (
              <div className="w-full max-w-2xl space-y-6">
                <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg p-6 border-2 border-purple-200">
                  <h4 className="text-lg font-bold text-purple-900 mb-4">❓ {currentQuiz.question}</h4>
                  
                  <div className="grid grid-cols-2 gap-3">
                    {currentQuiz.answers.map((answer, index) => (
                      <button
                        key={index}
                        onClick={() => setQuizAnswer(answer)}
                        className={`p-4 rounded-lg border-2 transition-all text-left ${
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
                
                <div className="flex justify-center space-x-4">
                  <button
                    onClick={submitQuizAnswer}
                    disabled={!quizAnswer}
                    className="px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed font-bold"
                  >
                    ✅ 정답 제출
                  </button>
                  <button
                    onClick={() => {
                      setQuizMode(false);
                      setCurrentQuiz(null);
                      setQuizAnswer('');
                    }}
                    className="px-6 py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600 font-bold"
                  >
                    ❌ 취소
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 결과 표시 영역 */}
      {result && !spinning && !diceRolling && !quizMode && !timingGameMode && (
        <div className={`bg-gradient-to-r from-yellow-50 to-orange-50 border-2 border-yellow-300 rounded-lg p-6 shadow-2xl ${
          resultAnimating ? 'animate-pulse' : ''
        }`}>
          <div className="text-center space-y-6">
            {/* 복원된 결과인지 표시 */}
            {result.isRestoredResult && (
              <div className="mb-2">
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                  📋 최근 선정 결과
                </span>
              </div>
            )}
            
            {/* 축하 메시지 */}
            <div className="relative">
              {resultAnimating && (
                <div className="absolute -inset-8 flex items-center justify-center pointer-events-none">
                  <div className="text-6xl animate-bounce">🎉</div>
                  <div className="text-6xl animate-bounce animation-delay-150">✨</div>
                  <div className="text-6xl animate-bounce animation-delay-300">🎊</div>
                </div>
              )}
              
              <div className="flex items-center justify-center mb-4">
                <TrophyIcon className={`h-12 w-12 text-yellow-500 mr-4 ${resultAnimating ? 'animate-spin' : ''}`} />
                <div>
                  <h4 className="text-2xl font-bold text-gray-900 mb-1">
                    🎉 축하합니다! 🎉
                  </h4>
                  <p className="text-lg text-gray-700">
                    오늘의 운명은 <span className="text-2xl font-bold text-primary-600">{result.selectedPlace.name}</span>입니다!
                  </p>
                </div>
              </div>
            </div>

            {/* AI 소개 카드 */}
            <div className="bg-white/80 backdrop-blur-sm rounded-xl p-6 border border-yellow-200 shadow-lg">
              <div className="flex items-start space-x-4">
                <div className="text-4xl">{result.selectedPlace.avatar}</div>
                <div className="flex-1 text-left">
                  <h5 className="font-bold text-lg text-gray-900 mb-2">{result.selectedPlace.name}</h5>
                  <div className="space-y-2 text-sm text-gray-600">
                    <div className="flex items-center space-x-2">
                      <span className="font-medium">📍 위치:</span>
                      <span>{result.selectedPlace.address || '주소 정보 없음'}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="font-medium">🏷️ 카테고리:</span>
                      <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs">
                        {result.selectedPlace.category}
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="font-medium">⭐ 평점:</span>
                      <span>{result.selectedPlace.rating ? `${result.selectedPlace.rating}점` : '평점 정보 없음'}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="font-medium">🗳️ 투표수:</span>
                      <span>{result.selectedPlace.votes}표</span>
                    </div>
                  </div>
                  
                  {/* 선정 방식별 메시지 */}
                  <div className="mt-4 p-3 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border border-blue-200">
                    <p className="text-sm font-medium text-blue-800">
                      {result.selectionMethod === 'dice' && '🎲 주사위의 선택'}
                      {result.selectionMethod === 'quiz' && '🧠 퀴즈 정답 보상'}
                      {result.selectionMethod === 'timing' && '⏱️ 타이밍 게임 승리'}
                      {!result.selectionMethod && '🎯 룰렛의 선택'}
                    </p>
                    <p className="text-xs text-blue-600 mt-1">
                      {result.message}
                    </p>
                  </div>
                </div>
              </div>
            </div>
            
            {/* 액션 버튼들 */}
            <div className="flex justify-center space-x-4">
                              <button
                  onClick={startRandomSelection}
                  disabled={spinning || diceRolling || quizMode || candidatePlaces.length === 0}
                  className="px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg hover:from-blue-600 hover:to-blue-700 transition-all duration-200 font-bold flex items-center gap-2 shadow-lg hover:shadow-xl transform hover:scale-105"
                >
                  🎯 다시 도전하기
                </button>
              <button
                onClick={clearResult}
                className="px-6 py-3 bg-gradient-to-r from-gray-500 to-gray-600 text-white rounded-lg hover:from-gray-600 hover:to-gray-700 transition-all duration-200 font-bold flex items-center gap-2 shadow-lg hover:shadow-xl transform hover:scale-105"
              >
                🗑️ 결과 초기화
              </button>
            </div>

            {/* 공유 버튼 (추가 기능) */}
            <div className="pt-4 border-t border-yellow-200">
              <button
                onClick={() => {
                  const shareText = `🎉 "${result.selectedPlace.name}"이(가) 선정되었습니다!\n\n📍 ${result.selectedPlace.address}\n⭐ ${result.selectedPlace.rating}점\n\n#wherewemeets #장소선정`;
                  if (navigator.share) {
                    navigator.share({
                      title: '장소 선정 결과',
                      text: shareText
                    });
                  } else {
                    navigator.clipboard.writeText(shareText);
                    alert('결과가 클립보드에 복사되었습니다!');
                  }
                }}
                className="text-sm text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1 mx-auto"
              >
                📱 결과 공유하기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RandomSelector; 