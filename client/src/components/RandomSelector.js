import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import io from 'socket.io-client';
import { 
  UserIcon,
  TrophyIcon,
  ScaleIcon,
  ChartBarIcon
} from '@heroicons/react/24/outline';

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
  }, [isSpinning]);

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
  const [showFairnessStats, setShowFairnessStats] = useState(false);
  const [winningSegment, setWinningSegment] = useState(null);
  const [socket, setSocket] = useState(null);
  const [isDataLoading, setIsDataLoading] = useState(false);
  const [isRouletteOwner, setIsRouletteOwner] = useState(false);
  const [resultAnimating, setResultAnimating] = useState(false);
  const [socketConnected, setSocketConnected] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);

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
        setSocketConnected(true);
      });

      newSocket.on('disconnect', () => {
        console.log('Socket.io 연결 해제됨');
        setSocketConnected(false);
      });

      // 미팅 룸에 참가
      newSocket.emit('join-meeting', meetingId);

      // 실시간 데이터 업데이트 감지
      newSocket.on('data-updated', (data) => {
        console.log('실시간 데이터 업데이트:', data);
        // 데이터 로딩 중이 아닐 때만 로드 (백그라운드 업데이트)
        if (!isDataLoading) {
          loadCandidatePlacesData(true, false); // 강제 업데이트, 로딩 스피너 없음
        }
      });

      // 룰렛 완료 이벤트 감지 (다른 사용자의 룰렛 결과)
      newSocket.on('roulette-finished', (data) => {
        console.log('다른 사용자의 룰렛 완료:', data);
        // 다른 사용자의 룰렛 결과도 화면에 표시할 수 있음
      });

      return () => {
        newSocket.close();
      };
    }
  }, [meetingId, isDataLoading]);

  // 실시간 데이터 업데이트를 위한 폴링 (Socket.io 백업용)
  useEffect(() => {
    if (!meetingId) return;

    const interval = setInterval(() => {
      if (!isDataLoading) {
        loadCandidatePlacesData(false, false); // 백그라운드 업데이트, 로딩 스피너 없음
      }
    }, 10000); // 10초마다 백업 업데이트 (Socket.io가 실패할 경우 대비)

    return () => clearInterval(interval);
  }, [meetingId, isDataLoading]);

  // 실제 후보 장소 데이터 로드
  useEffect(() => {
    if (meetingId) {
      loadCandidatePlacesData(false, true); // 초기 로딩시 로딩 스피너 표시
    }
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
      const { candidatePlaces: votesCandidatePlaces, selectionHistory: serverHistory, selectionCounts } = data;
      
      if (votesCandidatePlaces && votesCandidatePlaces.length > 0) {
        const formattedPlaces = votesCandidatePlaces.map((place, index) => {
          const count = selectionCounts[place.id] || 0;
          
          return {
            id: place.id,
            name: place.name,
            category: place.category || '기타',
            location: place.address || '주소 정보 없음',
            avatar: getPlaceAvatar(place.category, index),
            selectedCount: count,
            votes: place.votes || 0,
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

        // 가장 최근 선정 결과가 있고, 현재 결과가 없거나 복원이 필요한 경우만 표시
        if (serverHistory && serverHistory.length > 0 && (!result || showLoading)) {
          const latestSelection = serverHistory[0];
          const selectedPlace = formattedPlaces.find(p => p.id === latestSelection.selectedParticipantId);
          
          if (selectedPlace && (!result || result.selectedPlace.id !== selectedPlace.id)) {
            console.log('최근 선정 결과 복원:', selectedPlace);
            setResult({
              selectedPlace,
              message: `${selectedPlace.name}이(가) 선정되었습니다!`,
              fairnessInfo: getFairnessInfo(selectedPlace, formattedPlaces),
              isRestoredResult: true
            });
            setResultAnimating(false);
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
      setLastUpdated(new Date());
    }
  };

  // 후보 장소 배열 비교 함수
  const arePlacesEqual = (arr1, arr2) => {
    if (arr1.length !== arr2.length) return false;
    return arr1.every((p1, index) => {
      const p2 = arr2[index];
      return p1.id === p2.id && 
             p1.name === p2.name && 
             p1.selectedCount === p2.selectedCount;
    });
  };

  // 배열 비교 함수 (선정 이력용)
  const areArraysEqual = (arr1, arr2) => {
    if (arr1.length !== arr2.length) return false;
    return JSON.stringify(arr1) === JSON.stringify(arr2);
  };

  // 수동 새로고침 함수 (로딩 스피너 표시)
  const handleManualRefresh = () => {
    console.log('수동 새로고침 실행');
    loadCandidatePlacesData(true, true);
  };

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
      icon: '🎲',
      description: '모든 후보 장소가 동일한 확률로 선정'
    },
    {
      id: 'balanced',
      name: '균형 선정',
      icon: '⚖️',
      description: '적게 선정된 장소 우선으로 공정하게 선정'
    }
  ];

  const startRandomSelection = () => {
    if (candidatePlaces.length === 0) {
      alert('후보 장소가 없습니다.');
      return;
    }

    if (spinning) {
      return;
    }

    // 새로운 선정을 위해 이전 결과 지우기
    setResult(null);
    setResultAnimating(false);

    // 선정 알고리즘 적용
    let selectedPlace;
    switch (fairnessMode) {
      case 'balanced':
        selectedPlace = getBalancedSelection();
        break;
      default:
        selectedPlace = getRandomSelection();
    }

    setWinningSegment(selectedPlace);
    setSpinning(true);
    setIsRouletteOwner(true); // 이 사용자가 룰렛을 시작했음을 표시
  };

  // 완전 랜덤 선정
  const getRandomSelection = () => {
    const randomIndex = Math.floor(Math.random() * candidatePlaces.length);
    return candidatePlaces[randomIndex];
  };

  // 균형 선정 (적게 선정된 사람 우선)
  const getBalancedSelection = () => {
    const minCount = Math.min(...candidatePlaces.map(p => p.selectedCount));
    const leastSelected = candidatePlaces.filter(p => p.selectedCount === minCount);
    const randomIndex = Math.floor(Math.random() * leastSelected.length);
    return leastSelected[randomIndex];
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
    setResult({
      selectedPlace: winner,
      message: `${winner.name}이(가) 선정되었습니다!`,
      fairnessInfo,
      isRestoredResult: false
    });
    
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
        <div className="grid grid-cols-2 gap-3">
          {fairnessModes.map(mode => (
            <button
              key={mode.id}
              onClick={() => setFairnessMode(mode.id)}
              className={`p-4 text-sm rounded-lg border-2 transition-all ${
                fairnessMode === mode.id
                  ? 'border-primary-500 bg-primary-50 text-primary-700 transform scale-105'
                  : 'border-gray-300 text-gray-600 hover:bg-gray-50'
              }`}
            >
              <div className="text-2xl mb-2">{mode.icon}</div>
              <div className="font-medium">{mode.name}</div>
              <div className="text-xs opacity-75 mt-1">{mode.description}</div>
            </button>
          ))}
        </div>
      </div>

      {/* 공정성 통계 */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex justify-between items-center mb-4">
          <h4 className="font-medium text-gray-900 flex items-center">
            <TrophyIcon className="h-5 w-5 mr-2" />
            장소별 선정 현황
          </h4>
          <div className="flex items-center space-x-2">
            {/* 연결 상태 표시 */}
            <div className="flex items-center">
              <div className={`w-2 h-2 rounded-full mr-1 ${socketConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
              <span className="text-xs text-gray-500">
                {socketConnected ? '실시간 연결' : '연결 끊김'}
              </span>
            </div>
            
            {/* 새로고침 버튼 */}
            <button
              onClick={handleManualRefresh}
              disabled={loading}
              className="text-sm text-blue-600 hover:text-blue-800 flex items-center disabled:opacity-50"
              title="데이터 새로고침"
            >
              <svg className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              새로고침
            </button>
            
          <button
            onClick={() => setShowFairnessStats(!showFairnessStats)}
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            {showFairnessStats ? '숨기기' : '상세보기'}
          </button>
        </div>
        </div>

        {/* 마지막 업데이트 시간 */}
        {lastUpdated && (
          <div className="mb-3 text-xs text-gray-500">
            마지막 업데이트: {lastUpdated.toLocaleTimeString()}
          </div>
        )}
        
        <div className="grid grid-cols-2 gap-2">
          {candidatePlaces.map((place, index) => {
            const fairness = getFairnessLevel(place.selectedCount);
            return (
              <div
                key={place.id}
                className={`p-3 rounded-lg border-2 ${getParticipantColor(index)}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <span className="text-2xl mr-2">{place.avatar}</span>
                    <div>
                      <p className="font-medium">{place.name}</p>
                      <p className="text-xs opacity-75">{place.category} • 투표 {place.votes}표</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold">{place.selectedCount}</div>
                    <div className={`text-xs font-medium ${fairness.color}`}>
                      {fairness.level}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* 상세 통계 */}
        {showFairnessStats && (
          <div className="mt-4 bg-gray-50 rounded-lg p-3">
            <h5 className="font-medium text-gray-900 mb-2">선정 이력</h5>
            <div className="space-y-2 max-h-32 overflow-y-auto">
              {selectionHistory.slice(-5).reverse().map((history, index) => (
                <div key={index} className="flex justify-between text-sm">
                  <span className="text-gray-600">{history.date}</span>
                  <span className="font-medium">{history.selected}</span>
                  <span className="text-gray-500">{history.location}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* SVG 기반 룰렛 */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="text-center">
          {/* <h2 className="text-lg font-semibold text-gray-900 mb-6 flex items-center justify-center">
            🎡 룰렛 선정
          </h2> */}
          
          <div className="flex justify-center mb-6">
            <WheelComponent 
              segments={candidatePlaces}
              onFinished={onWheelFinished}
              isSpinning={spinning}
              winningSegment={winningSegment}
              socket={socket}
              meetingId={meetingId}
            />
          </div>

          {/* 스핀 버튼 */}
          <button
            onClick={startRandomSelection}
            disabled={spinning || candidatePlaces.length === 0}
            className={`px-8 py-4 rounded-lg font-bold text-lg transition-all duration-300 ${
              spinning 
                ? 'bg-yellow-500 text-white cursor-not-allowed animate-pulse' 
                : 'bg-gradient-to-r from-blue-500 to-purple-600 text-white hover:from-blue-600 hover:to-purple-700 hover:transform hover:scale-105 shadow-lg'
            }`}
          >
            {spinning ? (
              <span>🎲 룰렛 돌리는 중...</span>
            ) : (
              <span>
                🎯 {selectionHistory && selectionHistory.length > 0 
                  ? '다시 돌리기' 
                  : `${fairnessModes.find(m => m.id === fairnessMode)?.name}으로 선정하기`
                }
              </span>
            )}
          </button>
        </div>
      </div>

      {/* 결과 표시 */}
      {result && !spinning && (
        <div className={`bg-gradient-to-r from-yellow-50 to-orange-50 border-2 border-yellow-300 rounded-lg p-6 shadow-lg transition-all duration-300 ${
          resultAnimating ? 'animate-bounce' : ''
        }`}>
          <div className="text-center">
            {/* 복원된 결과인지 표시 */}
            {result.isRestoredResult && (
              <div className="mb-2">
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                  📋 최근 선정 결과
                </span>
              </div>
            )}
            
            <div className={`mb-4 transition-all duration-300 ${
              resultAnimating ? 'animate-bounce' : ''
            }`}>
              <TrophyIcon className="h-16 w-16 text-yellow-500 mx-auto" />
            </div>
            <h4 className="text-2xl font-bold text-gray-900 mb-2">
              {result.selectedPlace.avatar} {result.message} 🎉 
            </h4>
            
            {/* 공정성 정보 */}
            {result.fairnessInfo && (
              <div className="mt-4 bg-white rounded-lg p-4 border border-yellow-200">
                <h5 className="font-medium text-gray-900 mb-2">공정성 분석</h5>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">선정 방식:</span>
                    <span className="font-medium ml-1">{result.fairnessInfo.mode}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">공정성 점수:</span>
                    <span className="font-medium ml-1 text-green-600">{result.fairnessInfo.fairnessScore}%</span>
                  </div>
                  <div>
                    <span className="text-gray-600">해당 장소 선정:</span>
                    <span className="font-medium ml-1">{result.fairnessInfo.placeSelections}회</span>
                  </div>
                  <div>
                    <span className="text-gray-600">그룹 평균:</span>
                    <span className="font-medium ml-1">{result.fairnessInfo.avgSelections}회</span>
                  </div>
                </div>
              </div>
            )}

            {/* 선정된 참가자 정보 */}
            {/* <div className="mt-4 flex items-center justify-center">
              <span className="text-4xl mr-3">{result.selectedParticipant.avatar}</span>
              <div>
                <h5 className="text-xl font-bold text-gray-900">{result.selectedParticipant.name}</h5>
                <p className="text-gray-600">{result.selectedParticipant.location}</p>
              </div>
            </div> */}

            {/* 새로운 선정 버튼 (복원된 결과일 때만 표시) */}
            {/* {result.isRestoredResult && (
              <div className="mt-4">
                <button
                  onClick={startRandomSelection}
                  disabled={spinning || participants.length === 0}
                  className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                >
                  🎯 다시 돌리기
                </button>
            </div>
            )} */}
          </div>
        </div>
      )}

      {!result && !spinning && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start">
            <ScaleIcon className="h-5 w-5 text-blue-500 mr-2 mt-0.5" />
            <div>
              <h5 className="font-medium text-blue-900 mb-1">🎡 SVG 고품질 룰렛 시스템</h5>
              <p className="text-sm text-blue-700">
                SVG 기반의 선명하고 부드러운 룰렛 애니메이션으로 
                후보 장소 이름이 명확하게 보이는 고품질 경험을 제공합니다!
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RandomSelector; 