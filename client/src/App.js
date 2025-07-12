import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './contexts/AuthContext';

// Components
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import ScrollToTop from './components/ScrollToTop';

// Pages
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import CreateMeetingPage from './pages/CreateMeetingPage';
import MeetingDetailPage from './pages/MeetingDetailPage';
import MeetingPlannerPage from './pages/MeetingPlannerPage';
import ProfilePage from './pages/ProfilePage';
import PricingPage from './pages/PricingPage';
import PaymentSuccessPage from './pages/PaymentSuccessPage';
import PaymentFailPage from './pages/PaymentFailPage';
import DateTestPage from './pages/DateTestPage';
import AdminAIAnalyticsPage from './pages/AdminAIAnalyticsPage';

// 토스페이먼츠로 결제 시스템 변경됨

// 로딩 스피너 컴포넌트
const LoadingSpinner = () => (
  <div className="min-h-screen bg-gray-50 flex items-center justify-center">
    <div className="text-center">
      <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-primary-600 mx-auto mb-4"></div>
      <p className="text-gray-600 text-lg">WhereWeMeets 초기화 중...</p>
      <p className="text-gray-500 text-sm mt-2">잠시만 기다려주세요</p>
    </div>
  </div>
);

// 앱 내용 컴포넌트
const AppContent = () => {
  const { loading } = useAuth();

  useEffect(() => {
    // 브라우저의 자동 스크롤 복원 비활성화
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }
  }, []);

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <Router>
      <ScrollToTop />
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <main className="flex-1">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/create-meeting" element={<CreateMeetingPage />} />
            <Route path="/meeting/:id" element={<MeetingDetailPage />} />
            <Route path="/meeting-planner/:id?" element={<MeetingPlannerPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/pricing" element={<PricingPage />} />
            <Route path="/payment/success" element={<PaymentSuccessPage />} />
            <Route path="/payment/fail" element={<PaymentFailPage />} />
            <Route path="/date-test" element={<DateTestPage />} />
            <Route path="/admin/ai-analytics" element={<AdminAIAnalyticsPage />} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </main>
        <Footer />
        <Toaster position="top-right" />
      </div>
    </Router>
  );
};

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App; 