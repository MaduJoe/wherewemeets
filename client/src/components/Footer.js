import React from 'react';
import { Link } from 'react-router-dom';
import { MapPinIcon } from '@heroicons/react/24/outline';

const Footer = () => {
  return (
    <footer className="bg-gray-900 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid md:grid-cols-3 gap-8">
          {/* 로고 및 회사 정보 */}
          <div>
            <div className="flex items-center space-x-2 mb-4">
              <MapPinIcon className="h-8 w-8 text-primary-400" />
              <span className="text-xl font-bold">WhereWeMeets</span>
            </div>
          </div>

          {/* 서비스 */}
          <div>
            <h3 className="text-sm font-semibold text-gray-300 tracking-wider uppercase mb-4">
              서비스
            </h3>
            <ul className="space-y-3">
              <li>
                <Link to="/pricing" className="text-gray-400 hover:text-white transition duration-200">
                  요금제
                </Link>
              </li>
            </ul>
          </div>

          {/* 지원 */}
          <div>
            <h3 className="text-sm font-semibold text-gray-300 tracking-wider uppercase mb-4">
              지원
            </h3>
            <ul className="space-y-3">
              <li>
                <button 
                  type="button"
                  className="text-gray-400 hover:text-white transition duration-200 bg-transparent border-none cursor-pointer p-0"
                  onClick={() => {
                    // FAQ 기능은 향후 구현 예정
                    alert('FAQ 기능은 준비 중입니다.');
                  }}
                >
                  FAQ
                </button>
              </li>
              <li>
                <a href="mailto:support@wherewemeets.com" className="text-gray-400 hover:text-white transition duration-200">
                  문의하기
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-800 mt-8 pt-8">
          <div className="flex justify-center">
            <p className="text-sm text-gray-400">
              © 2025 WhereWeMeets. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer; 