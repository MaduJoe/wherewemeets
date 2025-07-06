const express = require('express');
const router = express.Router();
const Vote = require('../models/Vote');
const CandidatePlace = require('../models/CandidatePlace');
const SelectionEvent = require('../models/SelectionEvent');
const mongoose = require('mongoose');

// 특정 미팅의 투표 데이터 조회
router.get('/:meetingId', async (req, res) => {
  try {
    const { meetingId } = req.params;
    console.log(`투표 데이터 조회 요청: meetingId=${meetingId}`);
    
    // MongoDB 연결 상태 확인
    if (mongoose.connection.readyState !== 1) {
      console.error('MongoDB 연결 상태:', mongoose.connection.readyState);
      return res.status(503).json({
        success: false,
        message: '데이터베이스 연결이 불안정합니다. 잠시 후 다시 시도해주세요.'
      });
    }
    
    // DB에서 투표 데이터, 후보 장소, 선정 이력 조회
    const [votes, candidatePlaces, selectionHistory, selectionCounts] = await Promise.all([
      Vote.getVotesByMeeting(meetingId),
      CandidatePlace.getByMeeting(meetingId),
      SelectionEvent.getByMeeting(meetingId),
      SelectionEvent.getSelectionCounts(meetingId)
    ]);
    
    console.log('조회된 votes:', Object.keys(votes).length, '개 장소');
    console.log('조회된 candidatePlaces:', candidatePlaces.length, '개');
    console.log('조회된 selectionHistory:', selectionHistory.length, '개');
    console.log('조회된 selectionCounts:', selectionCounts);
    
    // 참가자 목록 생성 (투표한 사람들의 고유 목록)
    const participantSet = new Set();
    Object.values(votes).forEach(voters => {
      voters.forEach(voter => {
        participantSet.add(JSON.stringify({
          id: voter.id,
          name: voter.name,
          email: voter.email
        }));
      });
    });
    
    let participants = Array.from(participantSet).map(p => JSON.parse(p));
    console.log('생성된 participants:', participants.length, '명');
    console.log('participants 목록:', participants);

    // 만약 참가자가 없고 투표 데이터도 없다면, 더미 데이터 제공 (개발/테스트용)
    if (participants.length === 0 && Object.keys(votes).length === 0) {
      console.log('실제 데이터가 없어 더미 데이터 제공');
      participants = [
        { id: 'dummy1', name: '테스트 사용자 1', email: 'test1@test.com' },
        { id: 'dummy2', name: '테스트 사용자 2', email: 'test2@test.com' }
      ];
    }

    // 선정 이력을 클라이언트 형식으로 변환
    const formattedSelectionHistory = selectionHistory.map(event => ({
      id: event._id,
      date: event.selectedAt,
      selectedParticipantId: event.participantId,
      selected: event.participantName,
    }));

    const responseData = {
      votes,
      participants,
      candidatePlaces: candidatePlaces.map(place => ({
        id: place.placeId,
        name: place.name,
        category: place.category,
        address: place.address,
        coordinates: place.coordinates,
        rating: place.rating,
        photos: place.photos,
        additionalInfo: place.additionalInfo,
        addedBy: place.addedBy,
        addedAt: place.addedAt
      })),
      selectionHistory: formattedSelectionHistory,
      selectionCounts
    };

    console.log('최종 응답 데이터:', {
      votesCount: Object.keys(responseData.votes).length,
      participantsCount: responseData.participants.length,
      candidatePlacesCount: responseData.candidatePlaces.length,
      selectionHistoryCount: responseData.selectionHistory.length
    });

    res.json({
      success: true,
      data: responseData
    });
  } catch (error) {
    console.error('투표 데이터 조회 실패:', error);
    console.error('투표 데이터 조회 실패 상세:', {
      name: error.name,
      message: error.message,
      stack: error.stack,
      code: error.code
    });
    
    if (error.name === 'MongoNetworkError' || error.name === 'MongooseServerSelectionError') {
      return res.status(503).json({
        success: false,
        message: '데이터베이스 연결에 실패했습니다. 잠시 후 다시 시도해주세요.'
      });
    }
    
    res.status(500).json({
      success: false,
      message: '투표 데이터 조회 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.'
    });
  }
});

// 투표하기
router.post('/:meetingId/vote', async (req, res) => {
  try {
    const { meetingId } = req.params;
    const { placeId, participant } = req.body;
    
    console.log('투표 요청 받음:', { meetingId, placeId, participant });
    
    // MongoDB 연결 상태 확인
    if (mongoose.connection.readyState !== 1) {
      console.error('MongoDB 연결 상태:', mongoose.connection.readyState);
      return res.status(500).json({
        success: false,
        message: '데이터베이스 연결이 불안정합니다. 잠시 후 다시 시도해주세요.'
      });
    }
    
    if (!placeId || !participant || !participant.id) {
      return res.status(400).json({
        success: false,
        message: '장소 ID와 참가자 정보가 필요합니다.'
      });
    }

    // 후보 장소가 존재하는지 확인
    console.log(`후보 장소 조회 중: meetingId=${meetingId}, placeId=${placeId}`);
    const candidatePlace = await CandidatePlace.findOne({ meetingId, placeId });
    console.log('후보 장소 조회 결과:', candidatePlace);
    
    if (!candidatePlace) {
      console.log(`후보 장소를 찾을 수 없음: meetingId=${meetingId}, placeId=${placeId}`);
      
      // 해당 미팅의 모든 후보 장소 조회하여 디버깅
      const allCandidates = await CandidatePlace.find({ meetingId });
      console.log(`미팅 ${meetingId}의 모든 후보 장소:`, allCandidates.map(c => ({ placeId: c.placeId, name: c.name })));
      
      return res.status(404).json({
        success: false,
        message: '해당 장소를 찾을 수 없습니다. 먼저 후보 장소로 추가해주세요.'
      });
    }
    
    // 기존 투표 확인
    const existingVote = await Vote.getUserVote(meetingId, participant.id);
    let message = '';
    
    try {
      if (existingVote) {
        if (existingVote.placeId === placeId) {
          // 같은 장소 재투표 - 투표 취소
          await Vote.findByIdAndDelete(existingVote._id);
          message = '투표가 취소되었습니다.';
          console.log('투표 취소 완료:', { meetingId, placeId, participantId: participant.id });
        } else {
          // 다른 장소로 투표 변경
          existingVote.placeId = placeId;
          existingVote.placeName = candidatePlace.name;
          existingVote.votedAt = new Date();
          await existingVote.save();
          message = '투표가 변경되었습니다.';
          console.log('투표 변경 완료:', { meetingId, fromPlaceId: existingVote.placeId, toPlaceId: placeId });
        }
      } else {
        // 새로운 투표
        const newVote = new Vote({
          meetingId,
          placeId,
          placeName: candidatePlace.name,
          voter: participant
        });
        await newVote.save();
        message = '투표가 완료되었습니다.';
        console.log('새 투표 완료:', { meetingId, placeId, participantId: participant.id });
      }
    } catch (voteError) {
      console.error('투표 처리 중 데이터베이스 오류:', voteError);
      
      if (voteError.code === 11000) {
        // 중복 투표 방지 (동시성 문제)
        return res.status(409).json({
          success: false,
          message: '이미 투표가 처리되었습니다. 페이지를 새로고침해주세요.'
        });
      }
      
      throw voteError;
    }
    
    // 최신 투표 데이터 반환
    const votes = await Vote.getVotesByMeeting(meetingId);
    
    res.json({
      success: true,
      data: {
        votes,
        message
      }
    });
  } catch (error) {
    console.error('투표 처리 실패:', error);
    console.error('투표 처리 실패 상세:', {
      name: error.name,
      message: error.message,
      stack: error.stack,
      code: error.code
    });
    
    if (error.name === 'MongoNetworkError' || error.name === 'MongooseServerSelectionError') {
      return res.status(503).json({
        success: false,
        message: '데이터베이스 연결에 실패했습니다. 잠시 후 다시 시도해주세요.'
      });
    }
    
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: '입력 데이터가 올바르지 않습니다.'
      });
    }
    
    res.status(500).json({
      success: false,
      message: '투표 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.'
    });
  }
});

// 참가자 등록
router.post('/:meetingId/participants', async (req, res) => {
  try {
    const { meetingId } = req.params;
    const { participant } = req.body;
    
    console.log('참가자 등록 요청:', { meetingId, participant });
    
    if (!participant) {
      console.log('참가자 정보 누락');
      return res.status(400).json({
        success: false,
        message: '참가자 정보가 필요합니다.'
      });
    }
    
    if (!participant.id || !participant.name) {
      console.log('참가자 필수 정보 누락:', { id: participant.id, name: participant.name });
      return res.status(400).json({
        success: false,
        message: '참가자 ID와 이름이 필요합니다.'
      });
    }
    
    let participants = [];
    
    try {
      // 현재 투표에서 참가자 목록 생성 (투표한 사람들의 고유 목록)
      console.log('투표 데이터 조회 시작');
      const votes = await Vote.getVotesByMeeting(meetingId);
      console.log('투표 데이터 조회 완료:', Object.keys(votes).length, '개 장소');
      
      const uniqueParticipants = new Set();
      
      Object.values(votes).forEach(voters => {
        voters.forEach(voter => {
          if (!uniqueParticipants.has(voter.id)) {
            uniqueParticipants.add(voter.id);
            participants.push({
              id: voter.id,
              name: voter.name,
              joinedAt: voter.votedAt || new Date().toISOString()
            });
          }
        });
      });
      
      console.log('기존 참가자:', participants.length, '명');
      
      // 새로 등록하는 참가자가 아직 목록에 없으면 추가
      if (!uniqueParticipants.has(participant.id)) {
        participants.push({
          id: participant.id,
          name: participant.name,
          joinedAt: participant.joinedAt || new Date().toISOString()
        });
        console.log('새 참가자 추가:', participant.name);
      } else {
        console.log('기존 참가자 업데이트:', participant.name);
        // 기존 참가자의 정보 업데이트
        const existingIndex = participants.findIndex(p => p.id === participant.id);
        if (existingIndex !== -1) {
          participants[existingIndex].name = participant.name;
        }
      }
      
      console.log('최종 참가자:', participants.length, '명');
    } catch (voteError) {
      console.error('투표 데이터 조회 실패:', voteError);
      // 투표 데이터 조회 실패 시에도 참가자는 등록
      participants = [{
        id: participant.id,
        name: participant.name,
        joinedAt: participant.joinedAt || new Date().toISOString()
      }];
    }
    
    res.json({
      success: true,
      data: {
        participants,
        message: `${participant.name}님이 참가자로 등록되었습니다.`
      }
    });
  } catch (error) {
    console.error('참가자 등록 실패:', error);
    res.status(500).json({
      success: false,
      message: '참가자 등록 중 오류가 발생했습니다.'
    });
  }
});

// 후보 장소 추가
router.post('/:meetingId/candidates', async (req, res) => {
  try {
    const { meetingId } = req.params;
    const { place } = req.body;
    
    console.log('후보 장소 추가 요청:', { meetingId, place });
    
    // MongoDB 연결 상태 확인
    if (mongoose.connection.readyState !== 1) {
      console.error('MongoDB 연결 상태:', mongoose.connection.readyState);
      return res.status(500).json({
        success: false,
        message: '데이터베이스가 연결되지 않았습니다.'
      });
    }
    
    if (!meetingId) {
      return res.status(400).json({
        success: false,
        message: '미팅 ID가 필요합니다.'
      });
    }
    
    if (!place || !place.id || !place.name) {
      console.log('잘못된 장소 데이터:', place);
      return res.status(400).json({
        success: false,
        message: '장소 정보가 올바르지 않습니다. (ID와 이름이 필요합니다)'
      });
    }
    
    if (!place.addedBy || !place.addedBy.id) {
      console.log('사용자 정보 누락:', place.addedBy);
      return res.status(400).json({
        success: false,
        message: '사용자 정보가 필요합니다.'
      });
    }
    
    try {
      console.log('DB에 후보 장소 추가 시작');
      
      // DB에 후보 장소 추가 (중복 체크 포함)
      const newCandidate = await CandidatePlace.addCandidate(meetingId, place);
      console.log('후보 장소 추가 성공:', newCandidate);
      
      // 최신 후보 장소 목록 반환
      const candidatePlaces = await CandidatePlace.getByMeeting(meetingId);
      console.log('후보 장소 목록 조회 완료:', candidatePlaces.length, '개');
      
      res.json({
        success: true,
        data: {
          candidatePlaces: candidatePlaces.map(candidate => ({
            id: candidate.placeId,
            name: candidate.name,
            category: candidate.category,
            address: candidate.address,
            coordinates: candidate.coordinates,
            rating: candidate.rating,
            photos: candidate.photos,
            additionalInfo: candidate.additionalInfo,
            addedBy: candidate.addedBy,
            addedAt: candidate.addedAt
          })),
          message: `'${place.name}'이(가) 후보 장소에 추가되었습니다.`
        }
      });
    } catch (error) {
      console.log('후보 장소 추가 중 에러:', error.message);
      console.log('에러 스택:', error.stack);
      
      if (error.message === '이미 추가된 장소입니다.') {
        const candidatePlaces = await CandidatePlace.getByMeeting(meetingId);
        return res.json({
          success: false,
          message: error.message,
          data: {
            candidatePlaces: candidatePlaces.map(candidate => ({
              id: candidate.placeId,
              name: candidate.name,
              category: candidate.category,
              address: candidate.address,
              coordinates: candidate.coordinates,
              rating: candidate.rating,
              photos: candidate.photos,
              additionalInfo: candidate.additionalInfo,
              addedBy: candidate.addedBy,
              addedAt: candidate.addedAt
            }))
          }
        });
      }
      throw error;
    }
  } catch (error) {
    console.error('후보 장소 추가 실패:', error);
    console.error('에러 상세:', {
      message: error.message,
      stack: error.stack,
      meetingId: req.params.meetingId,
      place: req.body.place
    });
    
    res.status(500).json({
      success: false,
      message: `후보 장소 추가 중 오류가 발생했습니다: ${error.message}`
    });
  }
});

// 후보 장소 삭제
router.delete('/:meetingId/candidates/:placeId', async (req, res) => {
  try {
    const { meetingId, placeId } = req.params;
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: '사용자 정보가 필요합니다.'
      });
    }
    
    // 삭제할 후보 장소 찾기
    const candidate = await CandidatePlace.findOne({ meetingId, placeId });
    
    if (!candidate) {
      return res.status(404).json({
        success: false,
        message: '해당 장소를 찾을 수 없습니다.'
      });
    }
    
    // 권한 확인: 주최자만 삭제 가능 (클라이언트에서 1차 검증 완료)
    // userId가 'host'이거나 실제 추가한 사용자인 경우 허용
    const isHostUser = userId === 'host';
    const isOriginalAdder = candidate.addedBy?.id === userId;
    
    if (!isHostUser && !isOriginalAdder) {
      return res.status(403).json({
        success: false,
        message: '주최자만 장소를 삭제할 수 있습니다.'
      });
    }
    
    // 후보 장소 삭제
    await CandidatePlace.findByIdAndDelete(candidate._id);
    
    // 해당 장소의 모든 투표도 삭제
    await Vote.deleteMany({ meetingId, placeId });
    
    // 최신 데이터 반환
    const [votes, candidatePlaces] = await Promise.all([
      Vote.getVotesByMeeting(meetingId),
      CandidatePlace.getByMeeting(meetingId)
    ]);
    
    res.json({
      success: true,
      data: {
        candidatePlaces: candidatePlaces.map(place => ({
          id: place.placeId,
          name: place.name,
          category: place.category,
          address: place.address,
          coordinates: place.coordinates,
          rating: place.rating,
          photos: place.photos,
          additionalInfo: place.additionalInfo,
          addedBy: place.addedBy,
          addedAt: place.addedAt
        })),
        votes,
        message: `'${candidate.name}'이(가) 삭제되었습니다.`
      }
    });
  } catch (error) {
    console.error('후보 장소 삭제 실패:', error);
    res.status(500).json({
      success: false,
      message: '후보 장소 삭제 중 오류가 발생했습니다.'
    });
  }
});

// 투표 데이터 초기화 (개발/테스트용)
router.delete('/:meetingId/reset', async (req, res) => {
  try {
    const { meetingId } = req.params;
    
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({
        success: false,
        message: '프로덕션 환경에서는 데이터를 초기화할 수 없습니다.'
      });
    }
    
    // 해당 미팅의 모든 투표와 후보 장소 삭제
    await Promise.all([
      Vote.deleteMany({ meetingId }),
      CandidatePlace.deleteMany({ meetingId })
    ]);
    
    res.json({
      success: true,
      data: {
        votes: {},
        candidatePlaces: [],
        message: '투표 데이터가 초기화되었습니다.'
      }
    });
  } catch (error) {
    console.error('투표 데이터 초기화 실패:', error);
    res.status(500).json({
      success: false,
      message: '투표 데이터 초기화 중 오류가 발생했습니다.'
    });
  }
});

// 참가자 정보 업데이트 (이름 변경)
router.put('/:meetingId/participant/:participantId', async (req, res) => {
  try {
    const { meetingId, participantId } = req.params;
    const { name } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ message: '이름을 입력해주세요.' });
    }

    // MongoDB 연결 확인
    const dbState = mongoose.connection.readyState;
    if (dbState !== 1) {
      console.error('MongoDB 연결 상태:', dbState);
      return res.status(500).json({ message: 'DB 연결이 불안정합니다.' });
    }

    // 기존 투표 데이터의 사용자 이름 업데이트
    const updateResult = await Vote.updateMany(
      { 
        meetingId: meetingId,
        'voter.id': participantId
      },
      { 
        $set: { 'voter.name': name.trim() } 
      }
    );

    console.log(`투표 데이터 이름 업데이트 결과:`, updateResult);

    // 현재 투표 상황 다시 조회
    const votes = await Vote.getVotesByMeeting(meetingId);
    
    // 참가자 목록 생성 (투표한 사람들의 고유 목록)
    const allVoters = Object.values(votes).flat();
    const uniqueParticipants = Array.from(
      new Map(allVoters.map(voter => [voter.id, voter])).values()
    );

    res.json({
      message: '이름이 변경되었습니다.',
      votes,
      participants: uniqueParticipants,
      updatedCount: updateResult.modifiedCount
    });

  } catch (error) {
    console.error('참가자 이름 변경 에러:', error);
    res.status(500).json({ 
      message: '이름 변경 중 오류가 발생했습니다.',
      error: error.message 
    });
  }
});

// 선정 이벤트 기록
router.post('/:meetingId/selections', async (req, res) => {
  try {
    const { meetingId } = req.params;
    const { participantId } = req.body;
    
    console.log(`선정 이벤트 기록 요청: meetingId=${meetingId}, participantId=${participantId}`);
    
    if (!participantId) {
      console.log('참가자 ID 누락');
      return res.status(400).json({
        success: false,
        message: '참가자 ID가 필요합니다.'
      });
    }

    // 참가자 이름 조회 (투표 데이터에서)
    console.log('참가자 이름 조회 중...');
    const votes = await Vote.getVotesByMeeting(meetingId);
    let participantName = '';
    
    for (const voters of Object.values(votes)) {
      const participant = voters.find(voter => voter.id === participantId);
      if (participant) {
        participantName = participant.name;
        break;
      }
    }

    console.log(`조회된 참가자 이름: ${participantName}`);

    if (!participantName) {
      console.log('참가자를 찾을 수 없음');
      return res.status(404).json({
        success: false,
        message: '참가자를 찾을 수 없습니다.'
      });
    }

    // 선정 이벤트 저장
    console.log('선정 이벤트 저장 중...');
    const selectionEvent = new SelectionEvent({
      meetingId,
      participantId,
      participantName
    });

    await selectionEvent.save();
    console.log('선정 이벤트 저장 완료:', selectionEvent);

    // 저장 후 현재 선정 횟수 확인
    const currentCounts = await SelectionEvent.getSelectionCounts(meetingId);
    console.log('현재 선정 횟수:', currentCounts);

    // Socket.io를 통해 실시간 업데이트 전송
    const io = req.app.get('io');
    if (io) {
      console.log('Socket.io로 업데이트 전송 중...');
      // 잠시 후에 이벤트 전송 (중복 방지)
      setTimeout(() => {
        io.to(meetingId).emit('data-updated', {
          type: 'selection',
          meetingId,
          participantId,
          participantName,
          timestamp: Date.now()
        });
      }, 500); // 0.5초 후 전송
    } else {
      console.log('Socket.io 인스턴스를 찾을 수 없음');
    }

    res.status(201).json({
      success: true,
      data: selectionEvent,
      currentCounts
    });
  } catch (error) {
    console.error('선정 기록 저장 실패:', error);
    res.status(500).json({
      success: false,
      message: '선정 기록 저장에 실패했습니다.',
      error: error.message
    });
  }
});

module.exports = router; 