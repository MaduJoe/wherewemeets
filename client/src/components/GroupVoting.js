import React, { useState, useEffect, useMemo, useCallback } from 'react';
import PropTypes from 'prop-types';
import api from '../utils/api';
import { 
  HandThumbUpIcon,
  ChatBubbleLeftRightIcon,
  CheckIcon,
  UserPlusIcon,
  XMarkIcon,
  ShareIcon,
  TrashIcon,
  TrophyIcon
} from '@heroicons/react/24/outline';
import { useAuth } from '../contexts/AuthContext';
import { isHost } from '../utils/tokenUtils';

// 서버 API를 사용한 투표 서비스
class VoteService {
  // 투표 데이터 조회
  async getVoteData(meetingId) {
    try {
      const response = await api.get(`/votes/${meetingId}`);
      return response.data.data;
    } catch (error) {
      console.error('투표 데이터 조회 실패:', error);
      return { votes: {}, participants: [], candidatePlaces: [] };
    }
  }

  // 투표하기
  async vote(meetingId, placeId, participant) {
    try {
      const response = await api.post(`/votes/${meetingId}/vote`, {
        placeId,
        participant
      });
      
      return response.data.data;
    } catch (error) {
      // 에러 로그는 디버깅을 위해 유지
      console.error('투표 실패:', error);
      throw error;
    }
  }

  // 참가자 등록
  async addParticipant(meetingId, participant) {
    try {
      const response = await api.post(`/votes/${meetingId}/participants`, {
        participant
      });
      return response.data.data;
    } catch (error) {
      console.error('참가자 등록 실패:', error);
      throw error;
    }
  }

  // 후보 장소 추가
  async addCandidatePlace(meetingId, place) {
    try {
      const response = await api.post(`/votes/${meetingId}/candidates`, {
        place
      });
      return response.data;
    } catch (error) {
      console.error('후보 장소 추가 실패:', error);
      throw error;
    }
  }

  // 후보 장소 삭제
  async deleteCandidatePlace(meetingId, placeId, userId) {
    try {
      const response = await api.delete(`/votes/${meetingId}/candidates/${placeId}`, {
        data: { userId }
      });
      return response.data;
    } catch (error) {
      console.error('후보 장소 삭제 실패:', error);
      throw error;
    }
  }

  async updateParticipantName(meetingId, participantId, newName) {
    try {
      const response = await api.put(`/votes/${meetingId}/participant/${participantId}`, {
        name: newName
      });
      return response.data;
    } catch (error) {
      console.error('참가자 이름 변경 실패:', error);
      throw error;
    }
  }
}

const voteService = new VoteService();

// 미팅 히스토리 저장 함수
const saveMeetingHistory = async (user, meetingData) => {
  if (!user?.id || user.isGuest) {
    return;
  }
  
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
      selectionMethod: 'voting',
      meetingStatus: 'completed'
    };
    
    const response = await api.post(`/users/${user.id}/history`, historyData);
    return response.data;
  } catch (error) {
    console.error('미팅 히스토리 저장 실패:', error);
    throw error;
  }
};

const GroupVoting = ({ meetingId, candidatePlaces, onTabChange }) => {
  const { user } = useAuth();
  const [meeting, setMeeting] = useState(null);
  const [loading, setLoading] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  
  // 참가자 관리 상태
  const [currentParticipant, setCurrentParticipant] = useState(null);
  const [showNameModal, setShowNameModal] = useState(false);
  const [participantName, setParticipantName] = useState('');
  const [participants, setParticipants] = useState([]);

  // 전역 투표 데이터 상태
  const [globalVotes, setGlobalVotes] = useState({});

  // 주최자 여부 확인
  const isOwner = useMemo(() => {
    if (!meetingId) return false;
    return isHost(meetingId);
  }, [meetingId]);

  // 카테고리 정의 (PlaceExplorer와 동일)
  const categories = [
    { value: 'all', label: '전체', icon: '🌟' },
    { value: 'restaurant', label: '음식점', icon: '🍽️' },
    { value: 'cafe', label: '카페', icon: '☕' },
    { value: 'park', label: '공원', icon: '🌳' },
    { value: 'entertainment', label: '오락시설', icon: '🎮' },
    { value: 'shopping', label: '쇼핑', icon: '🛍️' }
  ];

  // 서버에서 투표 데이터 로드
  const loadVoteData = useCallback(async () => {
    if (!meetingId) return;
    
    try {
      const data = await voteService.getVoteData(meetingId);
      setGlobalVotes(data.votes || {});
      setParticipants(data.participants || []);
      
      // 서버에서 받은 후보 장소로 meeting 상태 업데이트
      if (data.candidatePlaces && data.candidatePlaces.length > 0) {
        setMeeting(prev => {
          // meeting 객체가 없으면 새로 생성
          const baseMeeting = prev || { id: meetingId, candidatePlaces: [] };
          
          // 투표 정보를 포함하여 후보 장소 업데이트
          const updatedCandidates = data.candidatePlaces.map(candidate => {
            const voters = data.votes[candidate.id] || [];
            return {
              ...candidate,
              votes: voters.length,
              voters: voters
            };
          });
          
          return {
            ...baseMeeting,
            candidatePlaces: updatedCandidates
          };
        });
      }
    } catch (error) {
      console.error('투표 데이터 로드 실패:', error);
      
      if (error.response?.status === 503) {
        alert('데이터베이스 연결이 불안정합니다. 잠시 후 다시 시도해주세요.');
      } else if (error.code === 'ECONNABORTED') {
        alert('네트워크 연결이 느려 데이터 로드가 실패했습니다. 페이지를 새로고침해주세요.');
      } else if (!error.response) {
        alert('네트워크 연결을 확인해주세요.');
      }
    }
  }, [meetingId]);

  // 서버에서 채팅 메시지 로드
  const loadChatMessages = useCallback(async () => {
    if (!meetingId) return;
    
    try {
      const response = await api.get(`/chat/${meetingId}`);
      if (response.data.success && response.data.data.messages) {
        // 메시지 데이터 검증 및 정리
        const validMessages = response.data.data.messages.filter(msg => {
          // 필수 필드 검증
          if (!msg.userName || !msg.message) {
            return false;
          }
          
          // 날짜 필드 정리 (timestamp 또는 createdAt)
          if (!msg.timestamp && msg.createdAt) {
            msg.timestamp = msg.createdAt;
          }
          
          return true;
        });
        
        setChatMessages(validMessages);
      }
    } catch (error) {
      console.error('채팅 메시지 로드 실패:', error);
      setChatMessages([]);
    }
  }, [meetingId]);

  const loadMeeting = useCallback(async () => {
    try {
      const response = await api.get(`/meetings/${meetingId}`);
      setMeeting(response.data);
      
      // 감정 반응 관련 코드 제거
    } catch (error) {
      console.error('미팅 정보 로드 실패:', error);
    }
  }, [meetingId]);

  // meetingId가 있지만 meeting 객체가 없을 때 기본 meeting 객체 생성
  useEffect(() => {
    if (meetingId && !meeting) {
      setMeeting({
        id: meetingId,
        candidatePlaces: candidatePlaces || []
      });
    }
  }, [meetingId, meeting, candidatePlaces]);

  // 참가자 및 투표 데이터 초기화
  useEffect(() => {
    if (!meetingId) return;

    // 현재 참가자 정보 확인
    const savedParticipant = localStorage.getItem(`meeting_${meetingId}_participant`);
    
    if (savedParticipant) {
      setCurrentParticipant(JSON.parse(savedParticipant));
    } else {
      setShowNameModal(true);
    }

    // 서버에서 투표 데이터 로드
    loadVoteData();
  }, [meetingId, loadVoteData]);

  // 로그인한 사용자의 이름 자동 설정 및 모달 상태 관리
  useEffect(() => {
    if (showNameModal && user && user.name && !user.isGuest && !currentParticipant) {
      setParticipantName(user.name);
    } else if (!showNameModal) {
      // 모달이 닫힐 때 이름 필드 초기화 (현재 참가자가 아닌 경우)
      if (!currentParticipant) {
        setParticipantName('');
      }
    }
  }, [showNameModal, user, currentParticipant]);

  // ESC 키 이벤트 리스너 추가
  useEffect(() => {
    const handleEscapeKey = (event) => {
      if (event.key === 'Escape' && showNameModal) {
        setShowNameModal(false);
      }
    };

    if (showNameModal) {
      document.addEventListener('keydown', handleEscapeKey);
    }

    return () => {
      document.removeEventListener('keydown', handleEscapeKey);
    };
  }, [showNameModal]);

  // 실시간 투표 데이터 업데이트 (폴링)
  useEffect(() => {
    if (!meetingId) return;

    const updateInterval = setInterval(() => {
      loadVoteData();
    }, 3000); // 3초마다 업데이트

    return () => {
      clearInterval(updateInterval);
    };
  }, [meetingId, loadVoteData]);

  // 실시간 채팅 메시지 업데이트 (폴링)
  useEffect(() => {
    if (!meetingId) return;

    const chatInterval = setInterval(() => {
      loadChatMessages();
    }, 2000); // 2초마다 채팅 메시지 업데이트

    return () => clearInterval(chatInterval);
  }, [meetingId, loadChatMessages]);

  // 투표 데이터와 meeting 상태를 동기화
  useEffect(() => {
    if (meeting?.candidatePlaces && Object.keys(globalVotes).length > 0) {
      const updatedCandidates = meeting.candidatePlaces.map(candidate => {
        const voters = globalVotes[candidate.id] || [];
        return {
          ...candidate,
          votes: voters.length,
          voters: voters
        };
      });

      setMeeting(prev => ({
        ...prev,
        candidatePlaces: updatedCandidates
      }));
    }
  }, [globalVotes, meeting?.candidatePlaces?.length]);

  // 참가자 이름 입력 완료
  const handleJoinMeeting = async () => {
    if (participantName.trim() && meetingId) {
      const isNameChange = currentParticipant && currentParticipant.name !== participantName.trim();
      
      if (isNameChange) {
        // 기존 참가자의 이름 변경
        try {
          const result = await voteService.updateParticipantName(
            meetingId, 
            currentParticipant.id, 
            participantName.trim()
          );
          
          // 성공 시에만 상태 업데이트
          const updatedParticipant = {
            ...currentParticipant,
            name: participantName.trim()
          };
          
          setCurrentParticipant(updatedParticipant);
          localStorage.setItem(`meeting_${meetingId}_participant`, JSON.stringify(updatedParticipant));
          setParticipants(result.participants);
          setGlobalVotes(result.votes);

          setShowNameModal(false);
          setParticipantName('');
        } catch (error) {
          console.error('이름 변경 실패:', error);
          const errorMessage = error.response?.data?.message || '이름 변경 중 오류가 발생했습니다.';
          alert(`${errorMessage} 다시 시도해주세요.`);
        }
      } else {
        // 새로운 참가자 등록
        const newParticipant = {
          id: currentParticipant?.id || Date.now(),
          name: participantName.trim(),
          joinedAt: currentParticipant?.joinedAt || new Date().toISOString()
        };

        try {
          const result = await voteService.addParticipant(meetingId, newParticipant);
          
          setCurrentParticipant(newParticipant);
          localStorage.setItem(`meeting_${meetingId}_participant`, JSON.stringify(newParticipant));
          setParticipants(result.participants);

          setShowNameModal(false);
          setParticipantName('');
        } catch (error) {
          console.error('참가자 등록 실패:', error);
          const errorMessage = error.response?.data?.message || '참가자 등록 중 오류가 발생했습니다.';
          alert(`${errorMessage} 다시 시도해주세요.`);
        }
      }
    }
  };

  // 참가자 이름 변경
  const handleChangeName = () => {
    setShowNameModal(true);
    setParticipantName(currentParticipant?.name || '');
  };

  // 링크 공유
  const handleShareLink = () => {
    // 토큰 없는 참여자 링크 생성
    const baseUrl = window.location.origin;
    const shareUrl = `${baseUrl}/meeting-planner/${meetingId}`;
    
    if (navigator.share) {
      navigator.share({
        title: '투표에 참여해주세요!',
        text: '장소 투표에 참여해서 의견을 나눠주세요.',
        url: shareUrl
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(shareUrl).then(() => {
        alert('공유 링크가 클립보드에 복사되었습니다!');
      }).catch(() => {
        alert(`링크를 복사해주세요: ${shareUrl}`);
      });
    }
  };

  // 채팅 메시지 초기화 및 자동 업데이트 (서버에서 로드)
  useEffect(() => {
    if (meetingId) {
      loadChatMessages();
      
      // 2초마다 채팅 메시지 업데이트 (실시간 느낌)
      const chatInterval = setInterval(() => {
        loadChatMessages();
      }, 2000);
      
      return () => {
        clearInterval(chatInterval);
      };
    }
  }, [meetingId, loadChatMessages]);

  // candidatePlaces prop이 변경될 때 meeting 상태를 업데이트
  useEffect(() => {
    if (candidatePlaces && candidatePlaces.length > 0) {
      // candidatePlaces prop이 있으면 이를 사용하여 meeting 상태 설정
      setMeeting(prevMeeting => ({
        ...(prevMeeting || {}),
        candidatePlaces: candidatePlaces.map(place => ({
          ...place,
          votes: place.votes || 0, // 투표 수 초기화
          voters: place.voters || [] // 투표자 목록 초기화
        }))
      }));

      // 감정 반응 관련 코드 제거
    }
  }, [candidatePlaces]);

  useEffect(() => {
    if (meetingId && (!candidatePlaces || candidatePlaces.length === 0)) {
      // candidatePlaces prop이 없거나 비어있을 때만 API에서 로드
      loadMeeting();
    }
  }, [meetingId, candidatePlaces, loadMeeting]);

  // 투표 처리 - 서버 API 사용
  const handleVote = async (placeId) => {
    if (!currentParticipant || !meetingId) {
      setShowNameModal(true);
      return;
    }

    // 후보 장소가 있는지 확인
    if (!meeting?.candidatePlaces || meeting.candidatePlaces.length === 0) {
      alert('투표할 후보 장소가 없습니다. 먼저 "장소 추천받기" 탭에서 장소를 선택해주세요.');
      return;
    }

    // 해당 placeId가 후보 장소 목록에 있는지 확인
    const targetPlace = meeting.candidatePlaces.find(place => place.id === placeId);
    if (!targetPlace) {
      alert('유효하지 않은 장소입니다. 페이지를 새로고침 후 다시 시도해주세요.');
      return;
    }

    // 중복 요청 방지
    if (loading) {
      return;
    }

    setLoading(true);
    
    try {
      // 서버에서 투표 처리
      const result = await voteService.vote(meetingId, placeId, currentParticipant);
      setGlobalVotes(result.votes);
      
      // meeting 상태 즉시 업데이트
      if (meeting?.candidatePlaces) {
        const updatedCandidates = meeting.candidatePlaces.map(candidate => {
          const voters = result.votes[candidate.id] || [];
          return {
            ...candidate,
            votes: voters.length,
            voters: voters
          };
        });
        
        setMeeting(prev => ({
          ...prev,
          candidatePlaces: updatedCandidates
        }));
      }
    } catch (error) {
      console.error('투표 처리 중 오류:', error);
      
      if (error.code === 'ECONNABORTED') {
        alert('네트워크 연결이 느려 투표 요청이 취소되었습니다. 다시 시도해주세요.');
      } else if (error.response?.status === 404) {
        alert('투표하려는 장소를 찾을 수 없습니다. 페이지를 새로고침 후 다시 시도해주세요.');
      } else if (error.response?.status === 409) {
        alert('이미 투표가 처리되었습니다. 페이지를 새로고침해주세요.');
        // 자동으로 투표 데이터 새로고침
        loadVoteData();
      } else if (error.response?.status === 503) {
        alert('데이터베이스 연결이 불안정합니다. 잠시 후 다시 시도해주세요.');
      } else if (error.response?.status === 500) {
        alert('서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
      } else if (error.response?.status === 400) {
        alert('잘못된 요청입니다. 페이지를 새로고침 후 다시 시도해주세요.');
      } else if (!error.response) {
        alert('네트워크 연결을 확인해주세요. 인터넷이 연결되어 있는지 확인 후 다시 시도해주세요.');
      } else {
        const errorMessage = error.response?.data?.message || '투표 처리 중 오류가 발생했습니다. 다시 시도해주세요.';
        alert(errorMessage);
      }
    } finally {
      // 로딩 상태를 항상 해제
      setLoading(false);
    }
  };

  // 후보 장소 삭제 (주최자만 가능)
  const handleDeletePlace = async (placeId, placeName) => {
    if (!isOwner) {
      alert('주최자만 장소를 삭제할 수 있습니다.');
      return;
    }

    if (!meetingId) {
      alert('미팅 ID가 없습니다.');
      return;
    }

    if (!window.confirm(`'${placeName}'을(를) 정말 삭제하시겠습니까?\n\n⚠️ 해당 장소에 투표한 모든 투표도 함께 삭제됩니다.`)) {
      return;
    }

    try {
      // 주최자는 항상 'host'로 전송
      const userId = isOwner ? 'host' : (currentParticipant?.id || 'host');
      const result = await voteService.deleteCandidatePlace(meetingId, placeId, userId);
      
      if (result.success) {
        alert(result.data.message);
        
        // 상태 즉시 업데이트
        setMeeting(prev => ({
          ...prev,
          candidatePlaces: result.data.candidatePlaces
        }));
        setGlobalVotes(result.data.votes);
      }
    } catch (error) {
      console.error('장소 삭제 실패:', error);
      if (error.response?.data?.message) {
        alert(error.response.data.message);
      } else {
        alert('장소 삭제 중 오류가 발생했습니다.');
      }
    }
  };

  // 채팅 메시지에 반응 추가
  const addMessageReaction = async (messageId, emoji) => {
    if (!meetingId || !currentParticipant) return;

    try {
      const response = await api.post(`/chat/${meetingId}/messages/${messageId}/reactions`, {
        emoji: emoji,
        userId: currentParticipant.id
      });
      
      if (response.data.success) {
        // 반응 추가/제거 성공 시 채팅 메시지 새로고침
        await loadChatMessages();
        console.log(`이모지 반응 ${response.data.action}: ${emoji}`);
      }
    } catch (error) {
      console.error('반응 추가 실패:', error);
    }
  };

  const addChatMessage = async () => {
    if (newMessage.trim() && currentParticipant && meetingId) {
      try {
        const response = await api.post(`/chat/${meetingId}/messages`, {
          userId: currentParticipant.id,
          userName: currentParticipant.name,
          message: newMessage.trim()
        });
        
        if (response.data.success) {
          // 메시지 전송 성공 시 즉시 채팅 메시지 새로고침
          await loadChatMessages();
          setNewMessage('');
        }
      } catch (error) {
        console.error('메시지 전송 실패:', error);
        alert('메시지 전송에 실패했습니다. 다시 시도해주세요.');
      }
    }
  };

  const getVotePercentage = (candidate) => {
    if (!meeting?.candidatePlaces || meeting.candidatePlaces.length === 0) return 0;
    
    const totalVotes = meeting.candidatePlaces.reduce((sum, cp) => sum + (cp.votes || 0), 0);
    return totalVotes > 0 ? (candidate.votes / totalVotes * 100) : 0;
  };

  // 특정 장소에 사용자가 투표했는지 확인하는 함수
  const hasUserVoted = (candidate) => {
    if (!currentParticipant || !candidate) return false;
    const voters = globalVotes[candidate.id] || [];
    return voters.some(voter => voter.id === currentParticipant.id);
  };

  // 참가자 중 투표한 사용자 수 계산 (중복 제거)
  const getUniqueVoters = () => {
    const allVoters = new Set();
    Object.values(globalVotes).forEach(voters => {
      voters.forEach(voter => allVoters.add(voter.id));
    });
    return allVoters;
  };

  // 최고 득표 장소 찾기
  const getWinningPlace = () => {
    if (!meeting?.candidatePlaces || meeting.candidatePlaces.length === 0) return null;
    
    let maxVotes = -1;
    let winningPlaces = [];
    
    meeting.candidatePlaces.forEach(place => {
      const votes = place.votes || 0;
      if (votes > maxVotes) {
        maxVotes = votes;
        winningPlaces = [place];
      } else if (votes === maxVotes && votes > 0) {
        winningPlaces.push(place);
      }
    });
    
    return winningPlaces.length > 0 ? { places: winningPlaces, votes: maxVotes } : null;
  };

  // 투표 결과 확정
  const handleConfirmResult = async () => {
    const winningResult = getWinningPlace();
    
    if (!winningResult || winningResult.places.length === 0) {
      alert('아직 투표가 진행되지 않았습니다.');
      return;
    }

    let selectedPlace = null;
    
    if (winningResult.places.length === 1) {
      // 1등이 명확한 경우 바로 확정
      selectedPlace = winningResult.places[0];
    } else {
      // 동점인 경우 최종결정 탭으로 이동
      const placeNames = winningResult.places.map(place => place.name).join(', ');
      
      const shouldMoveTo = window.confirm(
        `🏆 동점 장소가 ${winningResult.places.length}개 있습니다!\n\n` +
        `📍 동점 장소: ${placeNames}\n\n` +
        `"최종결정" 탭에서 룰렛을 돌려 최종 장소를 결정하시겠습니까?\n\n` +
        `확인: 최종결정 탭으로 이동\n` +
        `취소: 현재 화면에서 직접 선택`
      );
      
      if (shouldMoveTo) {
        // 최종결정 탭으로 이동
        if (onTabChange) {
          onTabChange('random');
          return;
        } else {
          alert('탭 변경 기능이 사용할 수 없습니다. 직접 "최종결정" 탭을 클릭해주세요.');
          return;
        }
      } else {
        // 기존 방식으로 직접 선택
        const placeNames = winningResult.places.map((place, index) => `${index + 1}. ${place.name}`).join('\n');
        const choice = window.prompt(
          `동점 장소가 ${winningResult.places.length}개 있습니다. 최종 장소를 선택해주세요:\n\n${placeNames}\n\n번호를 입력하세요 (1-${winningResult.places.length}):`
        );
        
        const choiceNum = parseInt(choice);
        if (choiceNum >= 1 && choiceNum <= winningResult.places.length) {
          selectedPlace = winningResult.places[choiceNum - 1];
        } 
        // else {
        //   alert('잘못된 선택입니다.');
        //   return;
        // }
      }
    }

    if (!selectedPlace) return;

    try {
      // 미팅 정보 업데이트
      const updatedMeeting = {
        ...meeting,
        selectedPlace: {
          id: selectedPlace.id,
          name: selectedPlace.name,
          category: selectedPlace.category,
          address: selectedPlace.address,
          rating: selectedPlace.rating,
          coordinates: selectedPlace.coordinates
        },
        selectionMethod: 'voting',
        meetingStatus: 'completed',
        participants: participants
      };

      setMeeting(updatedMeeting);

      // 히스토리에 저장 (로그인 사용자만)
      if (user && !user.isGuest) {
        try {
          await saveMeetingHistory(user, updatedMeeting);
          alert(`🎉 ${selectedPlace.name}이(가) 최종 장소로 선정되었습니다!\n\n✅ 미팅 히스토리에 저장되었습니다.`);
        } catch (historyError) {
          alert(`🎉 ${selectedPlace.name}이(가) 최종 장소로 선정되었습니다!\n\n⚠️ 히스토리 저장에 실패했습니다. 대시보드에서 확인해주세요.`);
        }
      } else {
        alert(`🎉 ${selectedPlace.name}이(가) 최종 장소로 선정되었습니다!`);
      }
      
    } catch (error) {
      alert(`🎉 ${selectedPlace.name}이(가) 최종 장소로 선정되었습니다!`);
    }
  };

  // 채팅 반응 이모지 정의
  const chatReactionEmojis = ['👍', '❤️', '😂', '🎉', '😮'];

  // 현재 사용자가 특정 이모지에 반응했는지 확인
  const hasUserReacted = (message, emoji) => {
    if (!currentParticipant || !message.userReactions) return false;
    const usersWhoReacted = message.userReactions[emoji] || [];
    return usersWhoReacted.includes(currentParticipant.id);
  };

  if (!meeting) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="h-20 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* 후보 장소 없음 안내 */}
      {!meeting?.candidatePlaces || meeting.candidatePlaces.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-center py-12">
            <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-gray-100 mb-4">
              <HandThumbUpIcon className="h-8 w-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">투표할 장소가 없습니다</h3>
            <p className="text-gray-600 mb-4">
              먼저 "장소 추천받기" 탭에서 장소를 선택하여 후보 목록에 추가해주세요.
            </p>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
              <p className="font-medium mb-1">💡 사용 방법:</p>
              <p>1. "장소 추천받기" 탭으로 이동</p>
              <p>2. 마음에 드는 장소에서 "후보에 추가" 버튼 클릭</p>
              <p>3. "그룹 투표" 탭에서 투표 진행</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* 현재 참가자 정보 */}
          {currentParticipant && (
            <div className="bg-gradient-to-r from-primary-50 to-secondary-50 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className="w-10 h-10 bg-primary-600 text-white rounded-full flex items-center justify-center font-semibold">
                    {currentParticipant.name.charAt(0)}
                  </div>
                  <div className="ml-3">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-gray-900">{currentParticipant.name}</p>
                      {isOwner && (
                        <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs font-medium rounded-full">
                          👑 주최자
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600">
                      {isOwner ? '미팅 주최자 • 장소 삭제 권한' : '투표 참가자'}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleShareLink}
                    className="text-secondary-600 hover:text-secondary-700 text-sm font-medium transition duration-200 flex items-center"
                    title="링크 공유"
                  >
                    <ShareIcon className="h-4 w-4 mr-1" />
                    공유
                  </button>
                  <button
                    onClick={handleChangeName}
                    className="text-primary-600 hover:text-primary-700 text-sm font-medium transition duration-200"
                  >
                    이름 변경
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 투표 섹션 */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center">
                <HandThumbUpIcon className="h-6 w-6 text-primary-600 mr-2" />
                <h3 className="text-lg font-semibold text-gray-900">장소 투표</h3>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-sm text-gray-600">
                  <span className="font-medium">{getUniqueVoters().size}명</span>이 투표했습니다
                </div>
                {isOwner && getUniqueVoters().size > 0 && (
                  <button
                    onClick={handleConfirmResult}
                    className="bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-2 shadow-md"
                  >
                    <TrophyIcon className="h-4 w-4" />
                    결과 확정
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-4">
              {meeting.candidatePlaces.map((candidate) => {
                const percentage = getVotePercentage(candidate);
                const userVoted = hasUserVoted(candidate);
                const voters = candidate.voters || [];
                
                return (
                  <div
                    key={candidate.id}
                    className={`border rounded-lg p-4 transition-all duration-200 ${
                      userVoted 
                        ? 'border-primary-500 bg-primary-50' 
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium text-gray-900">{candidate.name}</h4>
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                            {categories.find(c => c.value === candidate.category)?.icon} {categories.find(c => c.value === candidate.category)?.label || '기타'}
                          </span>
                          {userVoted && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-primary-100 text-primary-800">
                              <CheckIcon className="h-3 w-3 mr-1" />
                              투표함
                            </span>
                          )}
                        </div>
                        {candidate.address && (
                          <p className="text-sm text-gray-600 mb-1">{candidate.address}</p>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleVote(candidate.id)}
                          disabled={loading}
                          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200 ${
                            userVoted
                              ? 'bg-red-100 text-red-700 hover:bg-red-200'
                              : 'bg-primary-600 text-white hover:bg-primary-700'
                          } disabled:opacity-50 disabled:cursor-not-allowed`}
                        >
                          {loading ? (
                            <span className="inline-flex items-center">
                              <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                              처리중...
                            </span>
                          ) : userVoted ? '투표 취소' : '투표하기'
                          }
                        </button>
                        {isOwner && (
                          <button
                            onClick={() => handleDeletePlace(candidate.id, candidate.name)}
                            className="px-3 py-2 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg border border-red-200 hover:border-red-300 transition-all duration-200 flex items-center gap-1"
                            title="장소 삭제 (주최자 전용)"
                          >
                            <TrashIcon className="h-4 w-4" />
                            <span className="text-xs">삭제</span>
                          </button>
                        )}
                      </div>
                    </div>
                    
                    {/* 투표 진행바 */}
                    <div className="mt-3">
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="text-gray-600">
                          {candidate.votes || 0}표 ({percentage.toFixed(1)}%)
                        </span>
                        {voters.length > 0 && (
                          <span className="text-gray-500">
                            {voters.slice(0, 3).map(voter => voter.name).join(', ')}
                            {voters.length > 3 && ` 외 ${voters.length - 3}명`}
                          </span>
                        )}
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-primary-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${percentage}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          
          {/* 채팅 섹션 */}
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex items-center">
                <ChatBubbleLeftRightIcon className="h-6 w-6 text-primary-600 mr-2" />
                <h3 className="text-lg font-semibold text-gray-900">투표 토론</h3>
              </div>
            </div>
            
            <div className="p-6">
              <div className="space-y-4 mb-4 max-h-64 overflow-y-auto">
                {chatMessages && chatMessages.length > 0 ? (
                  chatMessages.map((message) => (
                    <div key={message.id} className="flex items-start space-x-3">
                      <div className="flex-shrink-0">
                        <div className="h-8 w-8 bg-primary-100 rounded-full flex items-center justify-center">
                          <span className="text-primary-600 text-sm font-medium">
                            {message.userName.charAt(0)}
                          </span>
                        </div>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <span className="text-sm font-medium text-gray-900">{message.userName}</span>
                          <span className="text-xs text-gray-500">
                            {new Date(message.timestamp || message.createdAt).toLocaleTimeString()}
                          </span>
                        </div>
                        <p className="text-sm text-gray-700 mt-1">{message.message}</p>
                        
                        {/* 메시지 반응 */}
                        <div className="flex items-center space-x-1 mt-2">
                          {chatReactionEmojis.map((emoji) => {
                            const reactionCount = message.reactions?.[emoji] || 0;
                            const userReacted = hasUserReacted(message, emoji);
                            
                            return (
                              <button
                                key={emoji}
                                onClick={() => addMessageReaction(message.id, emoji)}
                                className={`text-sm rounded px-2 py-1 transition-all duration-200 ${
                                  userReacted
                                    ? 'bg-blue-100 text-blue-700 border border-blue-300 shadow-sm'
                                    : 'hover:bg-gray-100 text-gray-700'
                                }`}
                                title={userReacted ? '반응 취소' : '반응하기'}
                              >
                                {emoji}
                                {reactionCount > 0 && (
                                  <span className={`ml-1 text-xs ${
                                    userReacted ? 'text-blue-600' : 'text-gray-600'
                                  }`}>
                                    {reactionCount}
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8">
                    <ChatBubbleLeftRightIcon className="mx-auto h-12 w-12 text-gray-400" />
                    <h3 className="mt-2 text-sm font-medium text-gray-900">아직 메시지가 없습니다</h3>
                    <p className="mt-1 text-sm text-gray-500">첫 번째 메시지를 남겨보세요!</p>
                  </div>
                )}
              </div>
              
              {/* 메시지 입력 */}
              {currentParticipant && (
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && addChatMessage()}
                    placeholder="메시지를 입력하세요..."
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                  <button
                    onClick={addChatMessage}
                    disabled={!newMessage.trim()}
                    className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors duration-200"
                  >
                    전송
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      
      {/* 이름 입력 모달 */}
      {showNameModal && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowNameModal(false);
            }
          }}
        >
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center">
                <UserPlusIcon className="h-6 w-6 text-primary-600 mr-2" />
                <h3 className="text-lg font-semibold text-gray-900">
                  {currentParticipant ? '이름 변경' : '투표 참여하기'}
                </h3>
              </div>
              <button
                onClick={() => setShowNameModal(false)}
                className="text-gray-400 hover:text-gray-500"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>
            <p className="text-gray-600 mb-4">
              {currentParticipant 
                ? '새로운 이름을 입력해주세요.'
                : '투표에 참여하려면 이름을 입력해주세요.'
              }
            </p>
            <input
              type="text"
              value={participantName}
              onChange={(e) => setParticipantName(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handleJoinMeeting();
                } else if (e.key === 'Escape') {
                  setShowNameModal(false);
                }
              }}
              placeholder="이름을 입력하세요"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 mb-4"
              autoFocus
            />
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setShowNameModal(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 transition duration-200"
              >
                취소
              </button>
              <button
                onClick={handleJoinMeeting}
                disabled={!participantName.trim()}
                className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition duration-200"
              >
                {currentParticipant ? '이름 변경' : '참여하기'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

GroupVoting.propTypes = {
  meetingId: PropTypes.string.isRequired,
  candidatePlaces: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    category: PropTypes.string,
    address: PropTypes.string,
    coordinates: PropTypes.shape({
      lat: PropTypes.number,
      lng: PropTypes.number
    }),
    rating: PropTypes.number,
    photos: PropTypes.arrayOf(PropTypes.string),
    votes: PropTypes.number,
    voters: PropTypes.array
  })),
  onTabChange: PropTypes.func
};

GroupVoting.defaultProps = {
  candidatePlaces: [],
  onTabChange: null
};

export default GroupVoting; 