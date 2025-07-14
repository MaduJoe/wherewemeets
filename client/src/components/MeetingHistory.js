import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { formatVoteTime } from '../utils/dateUtils';
import './MeetingHistory.css';

const MeetingHistory = () => {
  const [history, setHistory] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState({ status: 'all', category: 'all' });
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalCount: 0
  });

  // 페이지 로드 시 데이터 가져오기
  useEffect(() => {
    fetchHistory();
    fetchStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, pagination.currentPage]);

  // 미팅 히스토리 조회
  const fetchHistory = async () => {
    setLoading(true);
    try {
      const params = {
        page: pagination.currentPage,
        limit: 10,
        ...filter
      };
      
      const response = await api.get('/users/history', { params });
      
      if (response.data.success) {
        setHistory(response.data.data.history);
        setPagination(response.data.data.pagination);
      } else {
        console.error('히스토리 조회 실패:', response.data.message);
        setHistory([]);
      }
    } catch (error) {
      console.error('히스토리 조회 실패:', error);
      setHistory([]);
    } finally {
      setLoading(false);
    }
  };

  // 사용자 통계 조회
  const fetchStats = async () => {
    try {
      const response = await api.get('/users/stats');
      
      if (response.data.success) {
        setStats(response.data.data);
      } else {
        console.error('통계 조회 실패:', response.data.message);
      }
    } catch (error) {
      console.error('통계 조회 실패:', error);
    }
  };

  // 미팅 상태 변경
  const updateMeetingStatus = async (meetingId, status, notes = '') => {
    try {
      const response = await api.patch(`/users/history/${meetingId}/status`, {
        status,
        notes
      });
      
      if (response.data.success) {
        fetchHistory(); // 목록 새로고침
        if (status === 'completed') {
          fetchStats(); // 완료된 경우 통계도 업데이트
        }
      }
    } catch (error) {
      console.error('상태 변경 실패:', error);
    }
  };

  // 미팅 히스토리 삭제
  const deleteMeeting = async (meetingId) => {
    if (!window.confirm('이 미팅 기록을 삭제하시겠습니까?')) return;
    
    try {
      const response = await api.delete(`/users/history/${meetingId}`);
      
      if (response.data.success) {
        fetchHistory();
        fetchStats();
      }
    } catch (error) {
      console.error('삭제 실패:', error);
    }
  };

  // 날짜 포맷팅은 이제 utils에서 import하여 사용

  // 카테고리 아이콘
  const getCategoryIcon = (category) => {
    const icons = {
      'cafe': '☕',
      'restaurant': '🍽️',
      'bar': '🍺',
      'park': '🌳',
      'entertainment': '🎬',
      'shopping': '🛍️',
      'gym': '💪',
      'study': '📚',
      'karaoke': '🎤',
      'other': '📍'
    };
    return icons[category] || '📍';
  };

  // 상태 배지
  const getStatusBadge = (status) => {
    const statusMap = {
      planning: { text: '계획중', className: 'status-badge planning' },
      completed: { text: '완료', className: 'status-badge completed' },
      cancelled: { text: '취소', className: 'status-badge cancelled' }
    };
    
    const statusInfo = statusMap[status] || statusMap.planning;
    
    return (
      <span className={statusInfo.className}>
        {statusInfo.text}
      </span>
    );
  };

  return (
    <div className="meeting-history-container">
      {/* 통계 섹션 */}
      {stats && (
        <div className="stats-section">
          <h3>내 미팅 통계</h3>
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-number">{stats.totalMeetings}</div>
              <div className="stat-label">총 미팅</div>
            </div>
            <div className="stat-card">
              <div className="stat-number">{stats.hostCount}</div>
              <div className="stat-label">주최한 미팅</div>
            </div>
            <div className="stat-card">
              <div className="stat-number">{stats.participantCount}</div>
              <div className="stat-label">참여한 미팅</div>
            </div>
            <div className="stat-card">
              <div className="stat-number">{stats.completedMeetings}</div>
              <div className="stat-label">완료된 미팅</div>
            </div>
          </div>
          
          {/* 선호 카테고리 */}
          {stats.favoriteCategories && stats.favoriteCategories.length > 0 && (
            <div className="favorite-categories">
              <h4>선호 카테고리</h4>
              <div className="categories-list">
                {stats.favoriteCategories.map((cat, index) => (
                  <div key={index} className="category-item">
                    <span className="category-name">{cat.category}</span>
                    <span className="category-count">{cat.count}회</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 필터 섹션 */}
      <div className="filter-section">
        <h3>미팅 히스토리</h3>
        <div className="filters">
          <div className="filter-group">
            <label>상태</label>
            <select
              value={filter.status}
              onChange={(e) => setFilter({ ...filter, status: e.target.value })}
            >
              <option value="all">전체</option>
              <option value="planning">계획 중</option>
              <option value="completed">완료</option>
              <option value="cancelled">취소</option>
            </select>
          </div>
          
          <div className="filter-group">
            <label>카테고리</label>
            <select
              value={filter.category}
              onChange={(e) => setFilter({ ...filter, category: e.target.value })}
            >
              <option value="all">전체</option>
              <option value="restaurant">식당</option>
              <option value="cafe">카페</option>
              <option value="bar">술집</option>
              <option value="park">공원</option>
              <option value="shopping">쇼핑</option>
              <option value="entertainment">엔터테인먼트</option>
            </select>
          </div>
        </div>
      </div>

      {/* 히스토리 목록 */}
      <div className="history-section">
        {loading ? (
          <div className="loading-state">
            <div className="loading-spinner"></div>
            <p>미팅 히스토리를 불러오는 중...</p>
          </div>
        ) : history.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📅</div>
            <h4>아직 미팅 기록이 없습니다</h4>
            <p>첫 미팅을 만들어보세요!</p>
            <button 
              className="create-meeting-btn"
              onClick={() => window.location.href = '/planner'}
            >
              첫 미팅 만들어보기
            </button>
          </div>
        ) : (
          <>
            <div className="history-list">
              {history.map((meeting, index) => (
                <div key={index} className="history-item">
                  <div className="meeting-header">
                    <h4>{meeting.title}</h4>
                    <div className="meeting-meta">
                      <span className="meeting-date">
                        {formatVoteTime(meeting.createdAt)}
                      </span>
                      <span className={`role-badge ${meeting.role}`}>
                        {meeting.role === 'host' ? '주최자' : '참여자'}
                      </span>
                    </div>
                  </div>
                  
                  {meeting.description && (
                    <p className="meeting-description">{meeting.description}</p>
                  )}
                  
                  {meeting.selectedPlace && (
                    <div className="selected-place">
                      <div className="place-info">
                        <span className="place-icon">
                          {getCategoryIcon(meeting.selectedPlace.category)}
                        </span>
                        <div className="place-details">
                          <strong>{meeting.selectedPlace.name}</strong>
                          <span className="place-address">
                            {meeting.selectedPlace.address}
                          </span>
                          {meeting.selectedPlace.rating && (
                            <span className="place-rating">
                              ⭐ {meeting.selectedPlace.rating}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                  
                  <div className="meeting-stats">
                    <span>참여자: {meeting.participantCount}명</span>
                    <span>총 투표: {meeting.totalVotes}표</span>
                    <span>선택방법: {meeting.selectionMethod === 'voting' ? '투표' : '랜덤'}</span>
                  </div>
                  
                  <div className="meeting-actions">
                    {getStatusBadge(meeting.meetingStatus)}
                    
                    {meeting.meetingStatus === 'planning' && (
                      <button
                        className="complete-btn"
                        onClick={() => updateMeetingStatus(meeting.meetingId, 'completed')}
                      >
                        완료 처리
                      </button>
                    )}
                    
                    <button
                      className="delete-btn"
                      onClick={() => deleteMeeting(meeting.meetingId)}
                    >
                      삭제
                    </button>
                  </div>
                </div>
              ))}
            </div>
            
            {/* 페이지네이션 */}
            {pagination.totalPages > 1 && (
              <div className="pagination">
                <button
                  disabled={!pagination.hasPrev}
                  onClick={() => setPagination({ ...pagination, currentPage: pagination.currentPage - 1 })}
                >
                  이전
                </button>
                
                <span className="page-info">
                  {pagination.currentPage} / {pagination.totalPages}
                </span>
                
                <button
                  disabled={!pagination.hasNext}
                  onClick={() => setPagination({ ...pagination, currentPage: pagination.currentPage + 1 })}
                >
                  다음
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default MeetingHistory; 