import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getAIQueryLogs, getAIQueryStats, getFrequentQueries } from '../utils/api';

const AdminAIAnalyticsPage = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  
  // 데이터 상태
  const [stats, setStats] = useState(null);
  const [logs, setLogs] = useState([]);
  const [frequentQueries, setFrequentQueries] = useState([]);
  const [pagination, setPagination] = useState(null);
  
  // 자주 묻는 질문 정렬 상태
  const [frequentQueriesSortBy, setFrequentQueriesSortBy] = useState('frequency');
  
  // 필터 상태
  const [filters, setFilters] = useState({
    queryType: '',
    userType: '',
    success: '',
    startDate: '',
    endDate: '',
    search: '',
    page: 1,
    limit: 50
  });

  // 관리자 권한 확인
  useEffect(() => {
    if (!user || user.email !== 'admin@wherewemeets.com') {
      setError('관리자 권한이 필요합니다.');
      setLoading(false);
      return;
    }
    
    loadData();
  }, [user, filters, activeTab, frequentQueriesSortBy]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      if (activeTab === 'overview') {
        const [statsResult, frequentQueriesResult] = await Promise.all([
          getAIQueryStats({
            startDate: filters.startDate,
            endDate: filters.endDate
          }),
          getFrequentQueries({ limit: 20, days: 30, sortBy: frequentQueriesSortBy })
        ]);
        
        setStats(statsResult.data);
        setFrequentQueries(frequentQueriesResult.data);
      } else if (activeTab === 'logs') {
        const logsResult = await getAIQueryLogs(filters);
        setLogs(logsResult.data.logs);
        setPagination(logsResult.data.pagination);
      } else if (activeTab === 'frequent') {
        const frequentQueriesResult = await getFrequentQueries({ 
          limit: 50, 
          days: 30, 
          sortBy: frequentQueriesSortBy 
        });
        setFrequentQueries(frequentQueriesResult.data);
      }
      
    } catch (error) {
      console.error('데이터 로딩 실패:', error);
      setError('데이터를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({
      ...prev,
      [field]: value,
      page: field !== 'page' ? 1 : value // 페이지 외 필터 변경 시 첫 페이지로
    }));
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('ko-KR');
  };

  const formatResponseTime = (ms) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  if (!user || user.email !== 'admin@wherewemeets.com') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-md">
          <h1 className="text-2xl font-bold text-red-600 mb-4">접근 권한 없음</h1>
          <p className="text-gray-600">관리자만 접근할 수 있는 페이지입니다.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-md">
          <h1 className="text-2xl font-bold text-red-600 mb-4">오류 발생</h1>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">AI 질의 분석 대시보드</h1>
          <p className="mt-2 text-gray-600">사용자들의 AI 질의 패턴과 성과를 분석합니다.</p>
        </div>

        {/* 탭 네비게이션 */}
        <div className="mb-6">
          <nav className="flex space-x-8">
            <button
              onClick={() => setActiveTab('overview')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'overview'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              개요 및 통계
            </button>
            <button
              onClick={() => setActiveTab('logs')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'logs'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              상세 로그
            </button>
            <button
              onClick={() => setActiveTab('frequent')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'frequent'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              자주 묻는 질문
            </button>
          </nav>
        </div>

        {/* 개요 및 통계 탭 */}
        {activeTab === 'overview' && stats && (
          <div className="space-y-6">
            {/* 전체 통계 카드 */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="bg-white p-6 rounded-lg shadow">
                <div className="text-2xl font-bold text-blue-600">
                  {stats.overallStats.totalQueries || 0}
                </div>
                <div className="text-gray-600">총 질의 수</div>
              </div>
              <div className="bg-white p-6 rounded-lg shadow">
                <div className="text-2xl font-bold text-green-600">
                  {stats.overallStats.uniqueUserCount || 0}
                </div>
                <div className="text-gray-600">활성 사용자</div>
              </div>
              <div className="bg-white p-6 rounded-lg shadow">
                <div className="text-2xl font-bold text-purple-600">
                  {stats.overallStats.successRate?.toFixed(1) || 0}%
                </div>
                <div className="text-gray-600">성공률</div>
              </div>
              <div className="bg-white p-6 rounded-lg shadow">
                <div className="text-2xl font-bold text-orange-600">
                  {stats.overallStats.avgResponseTime || 0}ms
                </div>
                <div className="text-gray-600">평균 응답시간</div>
              </div>
            </div>

            {/* 인기 카테고리 */}
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-semibold mb-4">인기 질의 카테고리</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {stats.popularCategories?.slice(0, 10).map((category, index) => (
                  <div key={index} className="flex justify-between items-center p-3 bg-gray-50 rounded">
                    <span className="font-medium">{category._id}</span>
                    <span className="text-gray-600">{category.count}회</span>
                  </div>
                ))}
              </div>
            </div>

            {/* 일별 통계 차트 */}
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-semibold mb-4">일별 질의 현황</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">날짜</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">유형</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">질의 수</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">성공률</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">평균 응답시간</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {stats.dailyStats?.slice(0, 10).map((stat, index) => (
                      <tr key={index}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{stat.date}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{stat.queryType}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{stat.totalQueries}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{stat.successRate?.toFixed(1)}%</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{stat.avgResponseTime}ms</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* 상세 로그 탭 */}
        {activeTab === 'logs' && (
          <div className="space-y-6">
            {/* 필터 */}
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-semibold mb-4">필터</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
                <select
                  value={filters.queryType}
                  onChange={(e) => handleFilterChange('queryType', e.target.value)}
                  className="border border-gray-300 rounded-md px-3 py-2"
                >
                  <option value="">모든 유형</option>
                  <option value="place_recommendation">장소 추천</option>
                  <option value="chat_assistance">채팅 도움</option>
                  <option value="smart_collection">스마트 수집</option>
                  <option value="general">일반</option>
                </select>
                
                <select
                  value={filters.userType}
                  onChange={(e) => handleFilterChange('userType', e.target.value)}
                  className="border border-gray-300 rounded-md px-3 py-2"
                >
                  <option value="">모든 사용자</option>
                  <option value="guest">게스트</option>
                  <option value="member">회원</option>
                  <option value="premium">프리미엄</option>
                </select>
                
                <select
                  value={filters.success}
                  onChange={(e) => handleFilterChange('success', e.target.value)}
                  className="border border-gray-300 rounded-md px-3 py-2"
                >
                  <option value="">모든 결과</option>
                  <option value="true">성공</option>
                  <option value="false">실패</option>
                </select>
                
                <input
                  type="date"
                  value={filters.startDate}
                  onChange={(e) => handleFilterChange('startDate', e.target.value)}
                  className="border border-gray-300 rounded-md px-3 py-2"
                />
                
                <input
                  type="date"
                  value={filters.endDate}
                  onChange={(e) => handleFilterChange('endDate', e.target.value)}
                  className="border border-gray-300 rounded-md px-3 py-2"
                />
              </div>
            </div>

            {/* 로그 테이블 */}
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-semibold mb-4">AI 질의 로그</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">시간</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">사용자</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">유형</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">질의</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">응답시간</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">성공</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">평점</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {logs.map((log) => (
                      <tr key={log._id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatDate(log.createdAt)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            log.userType === 'premium' ? 'bg-purple-100 text-purple-800' :
                            log.userType === 'member' ? 'bg-blue-100 text-blue-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {log.userType}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{log.queryType}</td>
                        <td className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate">
                          {log.query}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatResponseTime(log.responseTime)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            log.success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                          }`}>
                            {log.success ? '성공' : '실패'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {log.userRating ? `⭐ ${log.userRating}` : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* 페이지네이션 */}
              {pagination && (
                <div className="mt-4 flex justify-between items-center">
                  <div className="text-sm text-gray-700">
                    총 {pagination.totalCount}개 중 {((pagination.currentPage - 1) * filters.limit) + 1}-
                    {Math.min(pagination.currentPage * filters.limit, pagination.totalCount)}개 표시
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleFilterChange('page', pagination.currentPage - 1)}
                      disabled={!pagination.hasPrev}
                      className="px-3 py-1 bg-gray-200 text-gray-700 rounded disabled:opacity-50"
                    >
                      이전
                    </button>
                    <span className="px-3 py-1 bg-blue-500 text-white rounded">
                      {pagination.currentPage}
                    </span>
                    <button
                      onClick={() => handleFilterChange('page', pagination.currentPage + 1)}
                      disabled={!pagination.hasNext}
                      className="px-3 py-1 bg-gray-200 text-gray-700 rounded disabled:opacity-50"
                    >
                      다음
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 자주 묻는 질문 탭 */}
        {activeTab === 'frequent' && (
          <div className="space-y-6">
            {/* 정렬 옵션 */}
            <div className="bg-white p-6 rounded-lg shadow">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">자주 묻는 질문 (최근 30일)</h3>
                <div className="flex items-center space-x-4">
                  <label htmlFor="sort-select" className="text-sm font-medium text-gray-700">
                    정렬 기준:
                  </label>
                  <select
                    id="sort-select"
                    value={frequentQueriesSortBy}
                    onChange={(e) => setFrequentQueriesSortBy(e.target.value)}
                    className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="frequency">빈도순</option>
                    <option value="time">최신순</option>
                    <option value="rating">평점순</option>
                  </select>
                </div>
              </div>
              
              <div className="space-y-4">
                {frequentQueries.map((query, index) => (
                  <div key={index} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-medium text-gray-900 flex-1 mr-4">
                        {query.query}
                      </h4>
                      <div className="flex space-x-4 text-sm text-gray-600">
                        <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs font-medium">
                          {query.count}회
                        </span>
                        {query.avgRating && (
                          <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full text-xs font-medium">
                            ⭐ {query.avgRating}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm text-gray-500">
                      <span>
                        <span className="font-medium">유형:</span> {query.queryType}
                      </span>
                      <span>
                        <span className="font-medium">평균 응답시간:</span> {formatResponseTime(query.avgResponseTime)}
                      </span>
                      <span>
                        <span className="font-medium">마지막 질의:</span> {formatDate(query.lastAsked)}
                      </span>
                    </div>
                    {frequentQueriesSortBy === 'time' && query.firstAsked && (
                      <div className="mt-2 text-sm text-gray-400">
                        <span className="font-medium">최초 질의:</span> {formatDate(query.firstAsked)}
                      </div>
                    )}
                  </div>
                ))}
                
                {frequentQueries.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    표시할 데이터가 없습니다.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminAIAnalyticsPage; 