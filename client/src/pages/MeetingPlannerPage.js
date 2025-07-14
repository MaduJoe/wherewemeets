import React, { useState, useEffect, useLayoutEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { useAuth } from '../contexts/AuthContext';
import { 
  generateRoomTokens, 
  saveHostToken, 
  isHost, 
  getTokenFromURL,
  generateShareLink 
} from '../utils/tokenUtils';
import SmartRecommendation from '../components/SmartRecommendation';
import GroupVoting from '../components/GroupVoting';
import RandomSelector from '../components/RandomSelector';
import RuleBasedPlaces from '../components/RuleBasedPlaces';
import AIAssistant from '../components/AIAssistant';
import { 
  SparklesIcon,
  HandThumbUpIcon,
  CheckCircleIcon,
  ChatBubbleLeftRightIcon
} from '@heroicons/react/24/outline';
import PlaceExplorer from '../components/PlaceExplorer';

// 미팅 히스토리 저장 함수
const saveMeetingHistory = async (user, meetingData) => {
  if (!user?.id || user.isGuest) return; // 게스트는 히스토리 저장 안함
  
  try {
    const historyData = {
      meetingId: meetingData.id,
      title: meetingData.title || '미팅',
      description: meetingData.description || '',
      role: 'host', // 나중에 동적으로 결정
      participantCount: meetingData.participants?.length || 1,
      selectedPlace: meetingData.selectedPlace,
      candidatePlaces: meetingData.candidatePlaces?.map(place => ({
        id: place.id,
        name: place.name,
        category: place.category,
        address: place.address,
        rating: place.rating,
        votes: place.votes || 0
      })) || [],
      totalVotes: meetingData.candidatePlaces?.reduce((sum, place) => sum + (place.votes || 0), 0) || 0,
      selectionMethod: meetingData.selectionMethod || 'voting',
      meetingStatus: 'planning'
    };
    
    await api.post(`/users/${user.id}/history`, historyData);
    console.log('미팅 히스토리 저장 완료');
  } catch (error) {
    console.error('미팅 히스토리 저장 실패:', error);
  }
};

const MeetingPlannerPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  // 초기 탭 설정 - sessionStorage에서 복원, 없으면 기본값 'recommendation'
  const getInitialTab = () => {
    if (typeof window !== 'undefined') {
      const savedTab = sessionStorage.getItem(`meetingTab_${id}`);
      return savedTab || 'recommendation';
    }
    return 'recommendation';
  };
  
  const [activeTab, setActiveTabState] = useState(getInitialTab);
  const [meeting, setMeeting] = useState(null);
  const [loading, setLoading] = useState(true);
  const [voteParticipants, setVoteParticipants] = useState([]);

  // sessionStorage에 탭 상태를 저장하는 setActiveTab 함수
  const setActiveTab = useCallback((tabId) => {
    setActiveTabState(tabId);
    if (typeof window !== 'undefined' && id) {
      sessionStorage.setItem(`meetingTab_${id}`, tabId);
    }
  }, [id]);

  // ID가 변경될 때 저장된 탭 상태 복원
  useEffect(() => {
    if (id && typeof window !== 'undefined') {
      const savedTab = sessionStorage.getItem(`meetingTab_${id}`);
      if (savedTab) {
        setActiveTabState(savedTab);
      } else {
        // 저장된 탭이 없으면 기본값 설정
        setActiveTabState('recommendation');
      }
    }
  }, [id]);

  // 페이지 로드 시 즉시 스크롤 최상단으로 이동
  useLayoutEffect(() => {
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, []);

  // 사용자별 미팅 ID 생성 함수
  const getUserMeetingId = useCallback(() => {
    if (user && !user.isGuest) {
      // 로그인한 사용자: user-{userId}
      return `user-${user.id}`;
    } else {
      // 게스트 사용자: 기존 localStorage 기반 ID 또는 새로 생성
      const guestId = localStorage.getItem('guestMeetingId');
      if (guestId) {
        return guestId;
      } else {
        const newGuestId = `guest-${Date.now()}`;
        localStorage.setItem('guestMeetingId', newGuestId);
        return newGuestId;
      }
    }
  }, [user]);

  // ID가 없으면 새로운 방 생성
  useEffect(() => {
    if (!id) {
      // 새로운 방 토큰 생성
      const { roomId, hostToken } = generateRoomTokens();
      
      console.log('새로운 방 생성:', { roomId, hostToken: `${hostToken.substring(0, 8)}...` });
      
      // 주최자 토큰 저장
      saveHostToken(roomId, hostToken);
      
      // 저장 확인
      const savedToken = localStorage.getItem(`host_token_${roomId}`);
      console.log('토큰 저장 확인:', { saved: !!savedToken, matches: savedToken === hostToken });
      
      // 주최자 링크로 리다이렉트 (토큰 포함)
      navigate(`/meeting-planner/${roomId}?token=${hostToken}`, { replace: true });
      return;
    }
  }, [id, navigate]);

  

  useEffect(() => {
    // 로딩이 완료된 후 스크롤을 최상단으로 이동
    if (!loading) {
      window.scrollTo(0, 0);
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    }
  }, [loading]); // loading 상태가 변경될 때마다 실행



  const loadMeeting = useCallback(async () => {
    if (!id) {
      return; // ID가 없으면 리다이렉트가 처리하므로 로딩하지 않음
    }

    setLoading(true);
    try {
      // DB에서 미팅 데이터 조회
      const response = await api.get(`/meetings/${id}`);
      
      if (response.data.success) {
        const meetingData = response.data.data.meeting;
        
        // 투표 시스템을 위한 후보 장소 데이터도 함께 로드
        const voteResponse = await api.get(`/votes/${id}`);
        if (voteResponse.data.success) {
          meetingData.candidatePlaces = voteResponse.data.data.candidatePlaces;
        }
        
        setMeeting(meetingData);
      } else {
        // 미팅을 찾을 수 없으면 기본 구조만 생성
        console.log('미팅을 찾을 수 없음, 기본 구조 생성');
        
        const isSharedMeeting = id.startsWith('shared-');
        const meetingTitle = isSharedMeeting ? '공유된 미팅' : 
                            (user && !user.isGuest) ? `${user.name}님의 미팅` : '새 미팅';
        
        const newMeeting = {
          id: id,
          title: meetingTitle,
          description: isSharedMeeting ? '공유 링크를 통해 참여한 미팅입니다' : '장소를 선택하고 친구들과 투표해보세요',
          category: 'all', // 기본값을 'all'로 변경
          participants: [],
          candidatePlaces: [],
          status: 'planning'
        };
        
        setMeeting(newMeeting);
      }
    } catch (error) {
      // 401 에러는 인증 문제이므로 로그만 남기고 더미 데이터 사용
      if (error.response?.status === 401) {
        console.log('인증이 필요한 미팅입니다. 게스트 모드로 진행합니다.');
      } else {
        console.error('미팅 로드 실패:', error);
      }
      
      // API 호출 실패 시 빈 미팅 구조 생성
      const fallbackMeeting = {
        id: id || `meeting-${Date.now()}`,
        title: (user && !user.isGuest) ? `${user.name}님의 미팅` : '새 미팅',
        description: '장소를 선택하고 친구들과 투표해보세요',
        category: 'all', // 기본값을 'all'로 변경
        participants: [],
        candidatePlaces: [],
        status: 'planning'
      };
      
      setMeeting(fallbackMeeting);
    } finally {
      setLoading(false);
    }
  }, [id]);

  // 미팅과 투표 데이터 로드
  useEffect(() => {
    const fetchData = async () => {
      await loadMeeting();
      if (id) {
        await fetchVoteParticipants(id);
      }
    };
    fetchData();
  }, [id, loadMeeting]);

  // 투표 참가자 데이터 로드 함수 추가
  const fetchVoteParticipants = async (meetingId) => {
    try {
      const response = await api.get(`/votes/${meetingId}`);
      if (response.data.success) {
        const { participants } = response.data.data;
        setVoteParticipants(participants || []);
        console.log('투표 참가자 수:', participants?.length || 0);
      }
    } catch (error) {
      // 401 에러는 인증 문제이므로 로그만 남기고 빈 배열 사용
      if (error.response?.status === 401) {
        console.log('인증이 필요한 투표 데이터입니다. 게스트 모드로 진행합니다.');
      } else {
        console.error('투표 참가자 데이터 로드 실패:', error);
      }
      setVoteParticipants([]);
    }
  };

  // 실시간 후보 장소 업데이트 (폴링)
  useEffect(() => {
    if (!id) return;

    const interval = setInterval(async () => {
          try {
      const response = await api.get(`/votes/${id}`);
        if (response.data.success && response.data.data.candidatePlaces) {
          const candidatePlaces = response.data.data.candidatePlaces;
          const votes = response.data.data.votes;
          
          // 투표 정보를 포함하여 후보 장소 업데이트
          const updatedCandidates = candidatePlaces.map(candidate => {
            const voters = votes[candidate.id] || [];
            return {
              ...candidate,
              votes: voters.length,
              voters: voters
            };
          });

          setMeeting(prev => {
            if (!prev) return prev;
            const dynamicCategory = getMeetingCategory(updatedCandidates);
            return {
              ...prev,
              candidatePlaces: updatedCandidates,
              category: dynamicCategory // 동적으로 카테고리 업데이트
            };
          });
        }
      } catch (error) {
        console.error('실시간 업데이트 실패:', error);
      }
    }, 3000); // 3초마다 업데이트

    return () => clearInterval(interval);
  }, [id]);

  const handlePlaceSelected = async (place) => {
    try {
      const placeId = place.id;
      if (!placeId) {
        console.error('장소 ID가 없습니다:', place);
        alert('장소 정보가 올바르지 않아 후보에 추가할 수 없습니다.');
        return;
      }

      // meeting이 로딩 중이거나 없는 경우 대기
      if (!meeting) {
        alert('미팅 정보를 불러오는 중입니다. 잠시 후 다시 시도해 주세요.');
        return;
      }

      // 중복 체크
      const existingPlace = meeting.candidatePlaces?.find(candidate => candidate.id === placeId);
      if (existingPlace) {
        alert(`'${place.name}'은(는) 이미 후보 장소에 추가되어 있습니다.`);
        return;
      }

      console.log(`후보 추가 시도: meetingId=${meeting.id}, placeId=${placeId}, placeName=${place.name}`);

      // 현재 사용자 정보 가져오기
      const userData = localStorage.getItem('user');
      let authUser = null;
      try {
        authUser = userData ? JSON.parse(userData) : null;
      } catch (error) {
        console.warn('사용자 데이터 파싱 실패:', error);
        authUser = null;
      }
      
      // 현재 참가자 정보 가져오기
      const participantKey = `meeting_${meeting.id}_participant`;
      const participantData = localStorage.getItem(participantKey);
      let currentParticipant = null;
      try {
        currentParticipant = participantData ? JSON.parse(participantData) : null;
      } catch (error) {
        console.warn('참가자 데이터 파싱 실패:', error);
        currentParticipant = null;
      }
      
      // 사용자 정보가 없으면 참가자 정보로 대체, 그것도 없으면 기본값 생성
      const userInfo = {
        id: (authUser?.id || currentParticipant?.id || `guest_${Date.now()}`).toString(),
        name: (authUser?.name || currentParticipant?.name || '게스트 사용자').toString(),
        email: (authUser?.email || currentParticipant?.email || null)
      };

      console.log('사용자 정보:', userInfo);
      console.log('장소 정보:', place);
      console.log('authUser 원본:', authUser);
      console.log('currentParticipant 원본:', currentParticipant);

      // 카테고리 매핑 (한국어 -> 영어/표준화)
      const categoryMapping = {
        '한식': '한식',
        '중식': '중식', 
        '일식': '일식',
        '양식': '양식',
        '카페': 'cafe',
        '술집': '술집',
        '기타': 'other',
        'restaurant': 'restaurant',
        'cafe': 'cafe',
        'entertainment': 'entertainment',
        'park': 'park',
        'shopping': 'shopping',
        'culture': 'culture',
        'other': 'other'
      };

      // 장소 데이터 구조 보완
      const placeData = {
        id: place.id || `place_${Date.now()}`,
        name: place.name || '이름 없는 장소',
        category: categoryMapping[place.category] || place.category || 'other',
        address: place.address || '주소 정보 없음',
        coordinates: place.coordinates || { lat: 0, lng: 0 },
        rating: place.rating || 0,
        photos: place.photos || [],
        additionalInfo: place.additionalInfo || '',
        addedBy: {
          id: userInfo.id,
          name: userInfo.name,
          email: userInfo.email
        }
      };

      console.log('전송할 장소 데이터:', placeData);
      console.log('API 설정 확인:', {
        baseURL: api.defaults.baseURL,
        requestURL: `/votes/${meeting.id}/candidates`,
        fullURL: `${api.defaults.baseURL}/votes/${meeting.id}/candidates`,
        meetingId: meeting.id
      });

      // 먼저 서버 상태 확인
      try {
        const healthCheck = await api.get('/health');
        console.log('서버 상태 확인:', healthCheck.data);
      } catch (healthError) {
        console.error('서버 상태 확인 실패:', healthError);
        throw new Error('서버에 연결할 수 없습니다. 서버가 실행 중인지 확인해주세요.');
      }

      // 투표 API를 사용하여 후보 장소 추가
      const response = await api.post(`/votes/${meeting.id}/candidates`, {
        place: placeData
      });
      
      console.log('서버 응답:', response);
      console.log('응답 데이터:', response.data);
      console.log('응답 타입:', typeof response.data);
      
      // HTML 응답인지 확인
      if (typeof response.data === 'string' && response.data.includes('<html>')) {
        console.error('서버에서 HTML 응답을 받았습니다. API 엔드포인트가 잘못되었거나 서버 설정에 문제가 있습니다.');
        throw new Error('서버 설정 오류: HTML 응답을 받았습니다.');
      }
      
      if (response.data.success) {
        alert(response.data.data.message);
        // 미팅 상태 즉시 업데이트
        setMeeting(prevMeeting => {
          const updatedCandidates = response.data.data.candidatePlaces;
          const dynamicCategory = getMeetingCategory(updatedCandidates);
          return {
            ...prevMeeting,
            candidatePlaces: updatedCandidates,
            category: dynamicCategory // 동적으로 카테고리 업데이트
          };
        });
      } else {
        alert(response.data.message);
      }

    } catch (error) {
      console.error('장소 추가 실패 API 에러:', error);
      console.error('에러 응답 데이터:', error.response?.data);
      console.error('에러 상태:', error.response?.status);
      console.error('에러 헤더:', error.response?.headers);
      
      if (error.response && error.response.data) {
        console.error('서버 에러 메시지:', error.response.data.message);
        alert(error.response.data.message || '장소 추가 중 오류가 발생했습니다.');
      } else {
        alert('장소 추가 요청 중 오류가 발생했습니다.');
      }
    }
  };

  const handleLocationSelected = async (location) => {
    try {
      // 최종 장소로 선정된 정보를 미팅에 저장
      const updatedMeeting = {
        ...meeting,
        selectedPlace: {
          id: location.id,
          name: location.name,
          category: location.category,
          address: location.address,
          rating: location.rating,
          coordinates: location.coordinates
        },
        selectionMethod: 'voting', // 투표로 선정됨
        meetingStatus: 'completed'
      };
      
      setMeeting(updatedMeeting);
      
      // 히스토리에 저장 (로그인 사용자만)
      if (user && !user.isGuest) {
        await saveMeetingHistory(user, updatedMeeting);
      }
      
      alert(`${location.name}이(가) 최종 장소로 선정되었습니다!`);
      
    } catch (error) {
      console.error('최종 장소 선정 처리 실패:', error);
      alert(`${location.name}이(가) 최종 장소로 선정되었습니다!`);
    }
  };

  // 토큰 기반 주최자 여부 확인
  const isOwner = useMemo(() => {
    if (!id) return false;
    
    const hostResult = isHost(id);
    
    console.log('토큰 기반 주최자 확인:', {
      roomId: id,
      urlToken: getTokenFromURL(),
      isHost: hostResult
    });
    
    return hostResult;
  }, [id]);

  // 탭 구성
  const allTabs = [
    {
      id: 'recommendation',
      name: '검색 기반 장소',
      icon: SparklesIcon,
      description: '내가 직접 장소 정하기'
    },
    {
      id: 'ai-assistant',
      name: 'AI 기반 장소',
      icon: ChatBubbleLeftRightIcon,
      description: 'AI와 대화하며 맞춤 장소 추천받기 ✨Premium'
    },
    {
      id: 'voting',
      name: '그룹 투표',
      icon: HandThumbUpIcon,
      description: '후보 장소에 대해 투표하고 의견을 나눠요'
    },
    {
      id: 'random',
      name: '최종 결정',
      icon: CheckCircleIcon,
      description: '투표 결과 또는 랜덤으로 장소를 확정해요'
    }
  ];

  // 주최자가 아니면 검색 기반 장소, 투표, 최종결정 탭 표시
  const tabs = !isOwner 
    ? allTabs.filter(tab => tab.id === 'recommendation' || tab.id === 'voting' || tab.id === 'random')
    : allTabs;

  // 역할에 따른 기본 탭 설정 (sessionStorage에 저장된 것이 없을 때만)
  useEffect(() => {
    // id가 있고 토큰 확인이 완료된 후에만 탭 설정
    if (!id) return;
    
    // sessionStorage에 저장된 탭이 있는지 확인
    const savedTab = sessionStorage.getItem(`meetingTab_${id}`);
    if (savedTab) {
      // 저장된 탭이 있으면 그것을 사용 (복원 완료)
      console.log('저장된 탭 복원:', savedTab);
      return;
    }
    
    console.log('탭 설정 useEffect:', { isOwner, activeTab, id });
    
    // 약간의 지연을 두어 토큰 저장이 완료되도록 함
    setTimeout(() => {
      // 저장된 탭이 없으면 기본 탭 설정
      if (!savedTab) {
        console.log('기본 탭 설정: recommendation');
        setActiveTab('recommendation');
      }
    }, 100);
  }, [isOwner, id, setActiveTab]);

  // 후보 장소들을 기반으로 미팅 카테고리 결정하는 함수
  const getMeetingCategory = (candidatePlaces) => {
    if (!candidatePlaces || candidatePlaces.length === 0) {
      return 'all';
    }

    // 카테고리별 개수 계산
    const categoryCount = {};
    candidatePlaces.forEach(place => {
      const category = place.category || 'other';
      categoryCount[category] = (categoryCount[category] || 0) + 1;
    });

    // 가장 많은 카테고리 찾기
    const entries = Object.entries(categoryCount);
    if (entries.length === 0) return 'all';
    
    // 동일한 개수의 카테고리가 여러 개면 'mixed' 반환
    entries.sort(([,a], [,b]) => b - a);
    if (entries.length > 1 && entries[0][1] === entries[1][1]) {
      return 'mixed';
    }
    
    return entries[0][0];
  };

  // 카테고리를 한국어로 변환하는 함수
  const getCategoryLabel = (category) => {
    const categoryLabels = {
      'all': '전체',
      'mixed': '다양한 카테고리',
      'restaurant': '음식점',
      'cafe': '카페',
      'park': '공원',
      'entertainment': '오락시설',
      'shopping': '쇼핑',
      'culture': '문화시설',
      'other': '기타'
    };
    return categoryLabels[category] || category;
  };

  // 실제 투표한 사용자 수 계산 함수
  const getActualVotersCount = () => {
    if (!meeting?.candidatePlaces || meeting.candidatePlaces.length === 0) {
      return 0;
    }
    
    const allVoters = new Set();
    meeting.candidatePlaces.forEach(candidate => {
      const voters = candidate.voters || [];
      voters.forEach(voter => {
        if (voter?.id) {
          allVoters.add(voter.id);
        }
      });
    });
    
    return allVoters.size;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-600">미팅 정보를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          {/* 참여자 안내 메시지 */}
          {!isOwner && (
            <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg p-3">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <HandThumbUpIcon className="h-5 w-5 text-blue-400" />
                </div>
                <div className="ml-3">
                  <p className="text-sm text-blue-800">
                    <span className="font-medium">투표 참여자로 접속하였습니다.</span>
                    {' '}장소를 검색하고 투표에 참여해서 의견을 나눠보세요!
                  </p>
                </div>
              </div>
            </div>
          )}
          
          {/* 주최자 안내 메시지 */}
          {isOwner && (
            <div className="mb-4 bg-green-50 border border-green-200 rounded-lg p-3">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <SparklesIcon className="h-5 w-5 text-green-400" />
                </div>
                <div className="ml-3">
                  <p className="text-sm text-green-800">
                    <span className="font-medium">미팅 주최자입니다.</span>
                    {' '}장소를 추천받고 친구들과 투표를 진행해보세요!
                  </p>
                </div>
              </div>
            </div>
          )}
          
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{meeting?.title || '미팅 플래너'}</h1>
              <p className="text-gray-600 mt-1">{meeting?.description}</p>
            </div>
            <div className="flex items-center space-x-3">
              <span className="bg-green-100 text-green-800 text-sm font-medium px-3 py-1 rounded-full">
                {meeting?.status === 'planning' ? '계획 중' : '완료'}
              </span>
              {user?.isGuest ? (
                <button
                  onClick={() => navigate('/')}
                  className="text-gray-600 hover:text-gray-900"
                >
                  홈으로 돌아가기
                </button>
              ) : (
                <button
                  onClick={() => navigate('/dashboard')}
                  className="text-gray-600 hover:text-gray-900"
                >
                  대시보드로 돌아가기
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* 사이드바 - 탭 네비게이션 */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow p-6 sticky top-8">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">기능 선택</h3>
                {!isOwner && (
                  <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2 py-1 rounded-full">
                    참여자
                  </span>
                )}
                {isOwner && (
                  <span className="bg-green-100 text-green-800 text-xs font-medium px-2 py-1 rounded-full">
                    주최자
                  </span>
                )}
              </div>
              <nav className="space-y-2">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`w-full text-left p-3 rounded-lg transition-colors ${
                        activeTab === tab.id
                          ? 'bg-primary-50 text-primary-700 border border-primary-200'
                          : 'text-gray-600 hover:bg-gray-50 border border-transparent'
                      }`}
                    >
                      <div className="flex items-center">
                        <Icon className={`h-5 w-5 mr-3 ${
                          activeTab === tab.id ? 'text-primary-600' : 'text-gray-400'
                        }`} />
                        <div>
                          <div className="font-medium">{tab.name}</div>
                          <div className="text-xs text-gray-500">{tab.description}</div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </nav>

              {/* 미팅 정보 요약 */}
              <div className="mt-6 pt-6 border-t">
                <h4 className="font-medium text-gray-900 mb-3">미팅 정보</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">투표 참가자</span>
                    <span className="font-medium">{getActualVotersCount()}명</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">후보 장소</span>
                    <span className="font-medium">{meeting?.candidatePlaces?.length || 0}개</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">카테고리</span>
                    <span className="font-medium">
                      {getCategoryLabel(meeting?.category)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 메인 컨텐츠 */}
          <div className="lg:col-span-3">
            {activeTab === 'recommendation' && (
              <>
                <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg text-blue-800 text-sm">
                  지도에서 원하는 장소를 검색해 직접 후보에 추가하세요!
                </div>
                <PlaceExplorer onPlaceSelected={handlePlaceSelected} />
              </>
            )}

            {activeTab === 'ai-assistant' && (
              <AIAssistant
                meetingData={meeting}
                onPlaceRecommendation={handlePlaceSelected}
              />
            )}

            {activeTab === 'voting' && (
              <GroupVoting
                meetingId={meeting?.id}
                currentUserId={1}
                candidatePlaces={meeting?.candidatePlaces}
                onTabChange={setActiveTab}
              />
            )}

            {activeTab === 'random' && (
              <RandomSelector
                meetingId={meeting?.id}
                onLocationSelected={handleLocationSelected}
                user={user}
                meeting={meeting}
                isOwner={isOwner}
                onMeetingUpdate={setMeeting}
              />
            )}
          </div>
        </div>
      </div>

      {/* 플로팅 액션 버튼 - 주최자만 표시 */}
      {isOwner && (
        <div className="fixed bottom-6 right-6">
          <button
            onClick={() => setActiveTab('voting')}
            className="bg-primary-600 text-white p-4 rounded-full shadow-lg hover:bg-primary-700 transition duration-200"
            title="투표 현황 확인"
          >
            <CheckCircleIcon className="h-6 w-6" />
          </button>
        </div>
      )}
    </div>
  );
};

export default MeetingPlannerPage; 