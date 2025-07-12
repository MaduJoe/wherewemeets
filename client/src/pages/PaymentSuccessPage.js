import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';

const PaymentSuccessPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [status, setStatus] = useState('processing'); // processing, success, error
  const [message, setMessage] = useState('결제 승인을 처리하고 있습니다...');

  useEffect(() => {
    const processPayment = async () => {
      try {
        const paymentKey = searchParams.get('paymentKey');
        const orderId = searchParams.get('orderId');
        const amount = searchParams.get('amount');
        const plan = searchParams.get('plan');

        if (!paymentKey || !orderId || !amount || !plan) {
          setStatus('error');
          setMessage('결제 정보가 올바르지 않습니다.');
          return;
        }

        // 백엔드로 결제 승인 요청
        const response = await axios.post('/api/payments/toss/confirm', {
          paymentKey,
          orderId,
          amount: parseInt(amount),
          plan
        });

        if (response.data.success) {
          setStatus('success');
          setMessage('결제가 성공적으로 완료되었습니다!');
          
          // 3초 후 대시보드로 이동
          setTimeout(() => {
            navigate('/dashboard');
          }, 3000);
        } else {
          setStatus('error');
          setMessage(response.data.error || '결제 승인 중 오류가 발생했습니다.');
        }
      } catch (error) {
        console.error('Payment confirmation error:', error);
        setStatus('error');
        setMessage(error.response?.data?.error || '결제 승인 중 오류가 발생했습니다.');
      }
    };

    if (user) {
      processPayment();
    } else {
      setStatus('error');
      setMessage('로그인이 필요합니다.');
      setTimeout(() => {
        navigate('/login');
      }, 2000);
    }
  }, [searchParams, user, navigate]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          {status === 'processing' && (
            <>
              <div className="mx-auto h-16 w-16 text-blue-600">
                <svg className="animate-spin h-16 w-16" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              </div>
              <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
                결제 처리 중
              </h2>
            </>
          )}

          {status === 'success' && (
            <>
              <div className="mx-auto h-16 w-16 text-green-600">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="h-16 w-16">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h2 className="mt-6 text-3xl font-extrabold text-green-900">
                결제 완료!
              </h2>
            </>
          )}

          {status === 'error' && (
            <>
              <div className="mx-auto h-16 w-16 text-red-600">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="h-16 w-16">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h2 className="mt-6 text-3xl font-extrabold text-red-900">
                결제 실패
              </h2>
            </>
          )}

          <p className="mt-2 text-sm text-gray-600">
            {message}
          </p>

          {status === 'success' && (
            <p className="mt-4 text-xs text-gray-500">
              3초 후 대시보드로 이동합니다...
            </p>
          )}

          {status === 'error' && (
            <div className="mt-6 space-y-4">
              <button
                onClick={() => navigate('/pricing')}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                요금제 페이지로 돌아가기
              </button>
              <button
                onClick={() => navigate('/dashboard')}
                className="w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                대시보드로 이동
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PaymentSuccessPage; 