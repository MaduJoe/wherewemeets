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

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 5000;

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

  // 선정 결과 업데이트 이벤트
  socket.on('selection-updated', (data) => {
    console.log('선정 결과 업데이트:', data);
    // 같은 미팅의 모든 클라이언트에게 업데이트 알림
    socket.to(data.meetingId).emit('data-updated', data);
  });

  // 연결 해제
  socket.on('disconnect', () => {
    console.log('클라이언트 연결 해제됨:', socket.id);
  });
});

// Socket.io 인스턴스를 전역적으로 사용할 수 있도록 설정
app.set('io', io);

// Middleware - CORS 설정
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://wherewemeets.com', 'https://wherewemeets-production.up.railway.app']
    : 'http://localhost:3000',
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

// 라우트 설정
app.use('/api/auth', authRoutes);
app.use('/api/meetings', meetingRoutes);
app.use('/api/locations', locationRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/votes', voteRoutes);
app.use('/api/places', placeRoutes);
app.use('/api/subscription', subscriptionRoutes);
app.use('/api/aiAssistant', aiAssistantRoutes);

// 프로덕션에서 React 앱 서빙
if (process.env.NODE_ENV === 'production') {
  // React 빌드 파일 서빙
  app.use(express.static(path.join(__dirname, 'client/build')));

  // React 라우팅을 위한 catch-all handler
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'client/build', 'index.html'));
  });
} else {
  app.get('/', (req, res) => {
    res.json({ message: 'WhereWeMeets API Server is running!' });
  });
}

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