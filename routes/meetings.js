const express = require('express');
const Meeting = require('../models/Meeting');
const User = require('../models/User');
const { auth } = require('../middleware/auth');
const locationService = require('../services/locationService');

const router = express.Router();

// 새 미팅 생성
router.post('/', auth, async (req, res) => {
  try {
    const { title, description, scheduledDate, participants } = req.body;

    const meeting = new Meeting({
      title,
      description,
      organizer: req.userId,
      scheduledDate: new Date(scheduledDate),
      participants: participants.map(p => ({
        ...p,
        status: 'pending'
      }))
    });

    await meeting.save();
    
    // 참가자들에게 알림 발송 (이메일 등)
    // TODO: 이메일 서비스 구현
    
    res.status(201).json(meeting);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

// 사용자의 미팅 목록 조회
router.get('/', auth, async (req, res) => {
  try {
    const meetings = await Meeting.find({
      $or: [
        { organizer: req.userId },
        { 'participants.user': req.userId }
      ]
    })
    .populate('organizer', 'name email')
    .populate('participants.user', 'name email')
    .sort({ scheduledDate: 1 });

    res.json(meetings);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

// 특정 미팅 조회
router.get('/:id', auth, async (req, res) => {
  try {
    const meeting = await Meeting.findById(req.params.id)
      .populate('organizer', 'name email')
      .populate('participants.user', 'name email');

    if (!meeting) {
      return res.status(404).json({ message: '미팅을 찾을 수 없습니다.' });
    }

    // 권한 확인
    const isParticipant = meeting.participants.some(p => 
      p.user._id.toString() === req.userId
    );
    
    if (meeting.organizer._id.toString() !== req.userId && !isParticipant) {
      return res.status(403).json({ message: '접근 권한이 없습니다.' });
    }

    res.json(meeting);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

// 장소 추천 생성
router.post('/:id/suggest-locations', auth, async (req, res) => {
  try {
    const meeting = await Meeting.findById(req.params.id);
    
    if (!meeting) {
      return res.status(404).json({ message: '미팅을 찾을 수 없습니다.' });
    }

    // 권한 확인
    if (meeting.organizer.toString() !== req.userId) {
      return res.status(403).json({ message: '주최자만 장소를 추천할 수 있습니다.' });
    }

    // 모든 참가자의 위치가 설정되었는지 확인
    const confirmedParticipants = meeting.participants.filter(p => 
      p.status === 'confirmed' && p.location && p.location.coordinates
    );

    if (confirmedParticipants.length < 2) {
      return res.status(400).json({ 
        message: '최소 2명의 참가자 위치가 필요합니다.' 
      });
    }

    // 장소 추천 서비스 호출
    const suggestedLocations = await locationService.findOptimalLocations(
      confirmedParticipants
    );

    meeting.suggestedLocations = suggestedLocations;
    await meeting.save();

    res.json({ suggestedLocations });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

// 참가자 응답 (위치 설정 및 확인)
router.put('/:id/respond', auth, async (req, res) => {
  try {
    const { location, preferences, status } = req.body;
    const meeting = await Meeting.findById(req.params.id);

    if (!meeting) {
      return res.status(404).json({ message: '미팅을 찾을 수 없습니다.' });
    }

    // 참가자 찾기
    const participantIndex = meeting.participants.findIndex(p => 
      p.user.toString() === req.userId
    );

    if (participantIndex === -1) {
      return res.status(403).json({ message: '미팅 참가자가 아닙니다.' });
    }

    // 참가자 정보 업데이트
    meeting.participants[participantIndex] = {
      ...meeting.participants[participantIndex],
      location,
      preferences,
      status
    };

    await meeting.save();

    res.json({ message: '응답이 저장되었습니다.', meeting });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

// 최종 장소 선택
router.put('/:id/select-location', auth, async (req, res) => {
  try {
    const { selectedLocation } = req.body;
    const meeting = await Meeting.findById(req.params.id);

    if (!meeting) {
      return res.status(404).json({ message: '미팅을 찾을 수 없습니다.' });
    }

    // 권한 확인
    if (meeting.organizer.toString() !== req.userId) {
      return res.status(403).json({ message: '주최자만 장소를 선택할 수 있습니다.' });
    }

    meeting.selectedLocation = selectedLocation;
    meeting.status = 'confirmed';
    await meeting.save();

    res.json({ message: '장소가 선택되었습니다.', meeting });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

module.exports = router; 