const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const path = require('path');
const http = require('http');
const socketIo = require('socket.io');
require('dotenv').config();
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');

// 라우트 import
const authRoutes = require('./routes/auth');
const meetingRoutes = require('./routes/meetings');
const locationRoutes = require('./routes/locations');
const paymentRoutes = require('./routes/payments');
const voteRoutes = require('./routes/votes');
const placeRoutes = require('./routes/placeRoutes');
const subscriptionRoutes = require('./routes/subscription');
const aiAssistantRoutes = require('./routes/aiAssistant');
const userHistoryRoutes = require('./routes/userHistory');
const chatRoutes = require('./routes/chat');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: (origin, callback) => {
      // 개발 환경
      if (process.env.NODE_ENV !== 'production') {
        return callback(null, true);
      }
      
      // 프로덕션 환경 - 허용된 도메인 패턴
      const allowedOrigins = [
        'https://wherewemeets.com',
        'https://www.wherewemeets.com',
        'https://wherewemeets-production.up.railway.app',
        'https://wherewemeets-client.vercel.app'
      ];
      
      // Vercel 프리뷰 도메인 패턴 허용 (더 포괄적인 패턴)
      const vercelPattern = /^https:\/\/wherewemeets-client-[a-z0-9-]+-jkchos-projects\.vercel\.app$/;
      
      if (!origin || allowedOrigins.includes(origin) || vercelPattern.test(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: ["GET", "POST"],
    credentials: true
  }
});

const PORT = process.env.PORT || 5000;

// 타이밍 게임 세션 관리 (메모리 기반)
const timingGameSessions = new Map();

// Socket.io 연결 처리
io.on('connection', (socket) => {
  console.log('클라이언트 연결됨:', socket.id);

  // 특정 미팅 룸에 참가
  socket.on('join-meeting', (meetingId) => {
    socket.join(meetingId);
    console.log(`사용자 ${socket.id}가 미팅 ${meetingId}에 참가했습니다.`);
  });

  // 룰렛 시작 이벤트
  socket.on('roulette-start', (data) => {
    console.log('룰렛 시작:', data);
    // 같은 미팅의 모든 클라이언트에게 룰렛 시작 알림
    socket.to(data.meetingId).emit('roulette-started', {
      winningSegment: data.winningSegment,
      timestamp: Date.now()
    });
  });

  // 룰렛 완료 이벤트
  socket.on('roulette-finish', (data) => {
    console.log('룰렛 완료:', data);
    // 같은 미팅의 모든 클라이언트에게 룰렛 완료 알림
    socket.to(data.meetingId).emit('roulette-finished', {
      winner: data.winner,
      timestamp: Date.now()
    });
  });

  // 게임 시작 이벤트 (주사위, 퀴즈 등)
  socket.on('game-start', (data) => {
    console.log(`${data.gameType} 게임 시작:`, data);
    // 같은 미팅의 모든 클라이언트에게 게임 시작 알림
    socket.to(data.meetingId).emit('game-start', {
      gameType: data.gameType,
      quiz: data.quiz,
      timestamp: Date.now()
    });
  });

  // 게임 결과 이벤트 (주사위, 퀴즈 등)
  socket.on('game-result', (data) => {
    console.log(`${data.gameType} 게임 완료:`, data);
    // 같은 미팅의 모든 클라이언트에게 게임 결과 알림
    socket.to(data.meetingId).emit('game-result', {
      gameType: data.gameType,
      result: data.result,
      diceValue: data.diceValue,
      quiz: data.quiz,
      answer: data.answer,
      timestamp: Date.now()
    });
  });

  // 타이밍 게임 시작 이벤트
  socket.on('timing-game-start', (data) => {
    console.log('타이밍 게임 시작:', data);
    const { meetingId, targetTime, gameId, startedBy } = data;
    
    // 게임 세션 초기화
    const session = {
      gameId,
      targetTime,
      startedBy,
      startTime: Date.now(),
      players: new Map(),
      status: 'running',
      autoEndTimer: null
    };
    
    timingGameSessions.set(meetingId, session);
    
    // 자동 종료 타이머 설정 (목표 시간 + 15초 후 자동 종료)
    const autoEndDelay = (targetTime + 15) * 1000;
    session.autoEndTimer = setTimeout(() => {
      console.log(`⏰ 타이밍 게임 자동 종료 - 미팅: ${meetingId}`);
      endTimingGame(meetingId, 'timeout');
    }, autoEndDelay);
    
    // 같은 미팅의 모든 클라이언트에게 게임 시작 알림
    io.to(meetingId).emit('timing-game-started', {
      gameId,
      targetTime,
      startedBy,
      timestamp: Date.now(),
      autoEndTime: Date.now() + autoEndDelay
    });
  });

  // 타이밍 게임 플레이어 참가
  socket.on('timing-game-join', (data) => {
    console.log('타이밍 게임 참가:', data);
    const { meetingId, player } = data;
    
    const session = timingGameSessions.get(meetingId);
    if (session && session.status === 'running') {
      // 플레이어 참가 정보 저장
      session.players.set(player.id, {
        ...player,
        socketId: socket.id,
        joinTime: Date.now(),
        result: null
      });
      
      // 현재 참가자 목록 업데이트
      const playersList = Array.from(session.players.values()).map(p => ({
        id: p.id,
        name: p.name,
        hasResult: p.result !== null
      }));
      
      io.to(meetingId).emit('timing-game-players-updated', {
        gameId: session.gameId,
        players: playersList,
        totalPlayers: playersList.length
      });
    }
  });

  // 타이밍 게임 종료 함수
  const endTimingGame = (meetingId, reason = 'completed') => {
    const session = timingGameSessions.get(meetingId);
    if (!session || session.status !== 'running') return;
    
    // 자동 종료 타이머 정리
    if (session.autoEndTimer) {
      clearTimeout(session.autoEndTimer);
      session.autoEndTimer = null;
    }
    
    session.status = 'finished';
    
    // 결과가 있는 플레이어들만 순위 매기기
    const playersWithResults = Array.from(session.players.values()).filter(p => p.result !== null);
    
    if (playersWithResults.length === 0) {
      // 아무도 완료하지 않은 경우
      io.to(meetingId).emit('timing-game-cancelled', {
        gameId: session.gameId,
        reason: reason === 'timeout' ? '시간 초과로 게임이 취소되었습니다.' : '게임이 취소되었습니다.',
        timestamp: Date.now()
      });
    } else {
      // 최종 결과 계산
      const sortedPlayers = playersWithResults.sort((a, b) => 
        a.result.difference - b.result.difference
      );
      
      const winner = sortedPlayers[0];
      
      // 최종 결과 발송
      io.to(meetingId).emit('timing-game-finished', {
        gameId: session.gameId,
        winner: {
          id: winner.id,
          name: winner.name,
          stoppedTime: winner.result.stoppedTime,
          difference: winner.result.difference
        },
        results: sortedPlayers.map(p => ({
          id: p.id,
          name: p.name,
          stoppedTime: p.result.stoppedTime,
          difference: p.result.difference,
          rank: sortedPlayers.indexOf(p) + 1
        })),
        targetTime: session.targetTime,
        reason: reason === 'timeout' ? 'timeout' : 'completed',
        totalPlayers: session.players.size,
        finishedPlayers: playersWithResults.length
      });
    }
    
    // 게임 세션 정리 (5분 후)
    setTimeout(() => {
      timingGameSessions.delete(meetingId);
    }, 5 * 60 * 1000);
  };

  // 타이밍 게임 스톱 이벤트
  socket.on('timing-game-stop', (data) => {
    console.log('타이밍 게임 스톱:', data);
    const { meetingId, playerId, stoppedTime } = data;
    
    const session = timingGameSessions.get(meetingId);
    if (session && session.status === 'running') {
      const player = session.players.get(playerId);
      if (player && !player.result) {
        // 플레이어 결과 저장
        const targetMs = session.targetTime * 1000;
        const difference = Math.abs(targetMs - stoppedTime);
        
        player.result = {
          stoppedTime,
          difference,
          timestamp: Date.now()
        };
        
        console.log(`✅ 플레이어 ${player.name} 결과: ${(stoppedTime/1000).toFixed(2)}초 (차이: ${difference}ms)`);
        
        // 모든 플레이어에게 결과 업데이트
        const playersList = Array.from(session.players.values()).map(p => ({
          id: p.id,
          name: p.name,
          hasResult: p.result !== null,
          result: p.result
        }));
        
        io.to(meetingId).emit('timing-game-player-result', {
          gameId: session.gameId,
          playerId,
          playerName: player.name,
          stoppedTime,
          difference,
          players: playersList
        });
        
        // 모든 플레이어가 결과를 제출했는지 확인
        const allPlayersFinished = Array.from(session.players.values()).every(p => p.result !== null);
        
        console.log(`🎮 게임 진행 상황 - 완료: ${playersList.filter(p => p.hasResult).length}/${playersList.length}명`);
        
        if (allPlayersFinished) {
          console.log('🏁 모든 플레이어 완료, 게임 종료');
          endTimingGame(meetingId, 'completed');
        } else {
          console.log('⏳ 다른 플레이어들을 기다리는 중...');
        }
      }
    }
  });

  // 타이밍 게임 리셋 이벤트
  socket.on('timing-game-reset', (data) => {
    console.log('타이밍 게임 리셋:', data);
    const { meetingId } = data;
    
    const session = timingGameSessions.get(meetingId);
    if (session) {
      // 자동 종료 타이머 정리
      if (session.autoEndTimer) {
        clearTimeout(session.autoEndTimer);
        session.autoEndTimer = null;
      }
      
      // 게임 세션 삭제
      timingGameSessions.delete(meetingId);
      
      // 모든 클라이언트에게 리셋 알림
      io.to(meetingId).emit('timing-game-reset', {
        timestamp: Date.now()
      });
    }
  });

  // 선정 결과 업데이트 이벤트
  socket.on('selection-updated', (data) => {
    console.log('선정 결과 업데이트:', data);
    // 같은 미팅의 모든 클라이언트에게 업데이트 알림
    socket.to(data.meetingId).emit('data-updated', data);
  });

  // 연결 해제
  socket.on('disconnect', () => {
    console.log('클라이언트 연결 해제됨:', socket.id);
    
    // 연결 해제된 소켓이 참가한 타이밍 게임이 있는지 확인
    for (const [meetingId, session] of timingGameSessions.entries()) {
      for (const [playerId, player] of session.players.entries()) {
        if (player.socketId === socket.id) {
          session.players.delete(playerId);
          
          // 남은 플레이어들에게 업데이트 알림
          const playersList = Array.from(session.players.values()).map(p => ({
            id: p.id,
            name: p.name,
            hasResult: p.result !== null
          }));
          
          io.to(meetingId).emit('timing-game-players-updated', {
            gameId: session.gameId,
            players: playersList,
            totalPlayers: playersList.length
          });
          
          break;
        }
      }
      
      // 세션에 플레이어가 없으면 삭제
      if (session.players.size === 0) {
        timingGameSessions.delete(meetingId);
      }
    }
  });
});

// Socket.io 인스턴스를 전역적으로 사용할 수 있도록 설정
app.set('io', io);

// Middleware - CORS 설정
app.use(cors({
  origin: (origin, callback) => {
    // 개발 환경
    if (process.env.NODE_ENV !== 'production') {
      return callback(null, true);
    }
    
    // 프로덕션 환경 - 허용된 도메인 패턴
    const allowedOrigins = [
      'https://wherewemeets.com',
      'https://www.wherewemeets.com',
      'https://wherewemeets-production.up.railway.app',
      'https://wherewemeets-client.vercel.app'
    ];
    
    // Vercel 프리뷰 도메인 패턴 허용 (더 포괄적인 패턴)
    const vercelPattern = /^https:\/\/wherewemeets-client-[a-z0-9-]+-jkchos-projects\.vercel\.app$/;
    
    if (!origin || allowedOrigins.includes(origin) || vercelPattern.test(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// MongoDB 연결
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/wherewemeets', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    
    console.log(`✅ MongoDB 연결 성공: ${conn.connection.host}`);
  } catch (error) {
    console.error('❌ MongoDB 연결 실패:', error.message);
    
    // MongoDB 연결 실패 시 경고 메시지 출력하고 계속 진행
    console.log('⚠️  MongoDB 없이 개발 모드로 실행됩니다.');
    console.log('💡 실제 데이터베이스 기능을 사용하려면 MongoDB를 설치하고 실행해주세요.');
    
    // 프로세스를 종료하지 않고 계속 진행
    // process.exit(1);
  }
};

// 데이터베이스 연결
connectDB();

// MongoDB 연결 이벤트 처리
mongoose.connection.on('connected', () => {
  console.log('🔗 MongoDB 연결됨');
});

mongoose.connection.on('error', (err) => {
  console.error('❌ MongoDB 연결 에러:', err);
});

mongoose.connection.on('disconnected', () => {
  console.log('🔌 MongoDB 연결 해제됨');
});

// 헬스체크 엔드포인트
app.get('/api/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV 
  });
});

// 라우트 설정
app.use('/api/auth', authRoutes);
app.use('/api/meetings', meetingRoutes);
app.use('/api/locations', locationRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/votes', voteRoutes);
app.use('/api/places', placeRoutes);
app.use('/api/subscription', subscriptionRoutes);
app.use('/api/aiAssistant', aiAssistantRoutes);
app.use('/api/ai-query-logs', require('./routes/aiQueryLogs'));
app.use('/api/users', userHistoryRoutes);
app.use('/api/chat', chatRoutes);

// API 전용 서버 모드
app.get('/', (req, res) => {
  res.json({ 
    message: 'WhereWeMeets API Server is running!',
    version: '1.0.0',
    endpoints: {
      health: '/api/health',
      test: '/api/test',
      auth: '/api/auth',
      meetings: '/api/meetings',
      locations: '/api/locations',
      payments: '/api/payments',
      votes: '/api/votes',
      places: '/api/places',
      subscription: '/api/subscription',
      aiAssistant: '/api/aiAssistant',
      userHistory: '/api/users'
    }
  });
});

// 기본 테스트 라우트
app.get('/api/test', (req, res) => {
  res.json({ 
    message: 'WhereWeMeets API 서버가 정상 작동중입니다!', 
    timestamp: new Date(),
    database: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected'
  });
});

// 에러 처리 미들웨어
app.use((err, req, res, next) => {
  console.error('🚨 서버 에러:', err.stack);
  res.status(500).json({ 
    message: '서버 내부 오류가 발생했습니다.',
    error: process.env.NODE_ENV === 'development' ? err.message : {}
  });
});

// 404 에러 처리
app.use('*', (req, res) => {
  res.status(404).json({ message: '요청하신 경로를 찾을 수 없습니다.' });
});

// 서버 시작 (app.listen 대신 server.listen 사용)
server.listen(PORT, () => {
  console.log(`🚀 서버가 포트 ${PORT}에서 실행중입니다.`);
  console.log(`🌐 개발 서버: http://localhost:${PORT}`);
  console.log(`🔧 환경: ${process.env.NODE_ENV || 'development'}`);
  console.log(`⚡ Socket.io 서버 실행 중`);
  
  if (mongoose.connection.readyState === 1) {
    console.log('💾 데이터베이스: 연결됨');
  } else {
    console.log('💾 데이터베이스: 연결 안됨 (개발 모드)');
  }
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 서버 종료 중...');
  
  try {
    await mongoose.connection.close();
    console.log('✅ MongoDB 연결 종료됨');
  } catch (error) {
    console.error('❌ MongoDB 연결 종료 실패:', error);
  }
  
  process.exit(0);
}); 