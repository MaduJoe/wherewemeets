import React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

const PaymentFailPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const code = searchParams.get('code');
  const message = searchParams.get('message');
  const orderId = searchParams.get('orderId');

  const getErrorMessage = () => {
    switch (code) {
      case 'PAY_PROCESS_CANCELED':
        return '사용자가 결제를 취소했습니다.';
      case 'PAY_PROCESS_ABORTED':
        return '결제 승인이 중단되었습니다.';
      case 'REJECT_CARD_COMPANY':
        return '카드사에서 결제를 거절했습니다.';
      case 'INVALID_CARD_NUMBER':
        return '유효하지 않은 카드번호입니다.';
      case 'NOT_ENOUGH_BALANCE':
        return '잔액이 부족합니다.';
      default:
        return message || '결제 처리 중 오류가 발생했습니다.';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="mx-auto h-16 w-16 text-red-600">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="h-16 w-16">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          
          <h2 className="mt-6 text-3xl font-extrabold text-red-900">
            결제 실패
          </h2>
          
          <p className="mt-2 text-sm text-gray-600">
            {getErrorMessage()}
          </p>

          {orderId && (
            <p className="mt-2 text-xs text-gray-500">
              주문번호: {orderId}
            </p>
          )}

          {code && (
            <p className="mt-1 text-xs text-gray-500">
              오류코드: {code}
            </p>
          )}

          <div className="mt-8 space-y-4">
            <button
              onClick={() => navigate('/pricing')}
              className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              다시 결제하기
            </button>
            
            <button
              onClick={() => navigate('/dashboard')}
              className="w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              대시보드로 이동
            </button>
          </div>

          <div className="mt-8 p-4 bg-blue-50 rounded-lg">
            <h3 className="text-sm font-medium text-blue-900 mb-2">
              결제에 문제가 있으신가요?
            </h3>
            <p className="text-xs text-blue-700 mb-3">
              다음을 확인해보세요:
            </p>
            <ul className="text-xs text-blue-700 space-y-1 text-left">
              <li>• 카드 잔액이 충분한지 확인</li>
              <li>• 카드 정보가 정확한지 확인</li>
              <li>• 해외결제 차단 설정이 되어 있지 않은지 확인</li>
              <li>• 결제 한도를 초과하지 않았는지 확인</li>
            </ul>
            <p className="text-xs text-blue-700 mt-3">
              문제가 지속되면 고객센터로 문의해주세요.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaymentFailPage; 