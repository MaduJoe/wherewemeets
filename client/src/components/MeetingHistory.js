import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import api from '../utils/api';
import { formatDate, formatRelativeTime } from '../utils/dateUtils';
import './MeetingHistory.css';

const MeetingHistory = () => {
  const { user } = useAuth();
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
    if (user?.id) {
      fetchHistory();
      fetchStats();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, filter, pagination.currentPage]);

  // 미팅 히스토리 조회
  const fetchHistory = async () => {
    if (!user?.id) return;
    
    setLoading(true);
    try {
      const params = {
        page: pagination.currentPage,
        limit: 10,
        ...filter
      };
      
      const response = await api.get(`/users/${user.id}/history`, { params });
      
      if (response.data.success) {
        setHistory(response.data.data.history);
        setPagination(response.data.data.pagination);
      }
    } catch (error) {
      console.error('히스토리 조회 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  // 사용자 통계 조회
  const fetchStats = async () => {
    if (!user?.id) return;
    
    try {
      const response = await api.get(`/users/${user.id}/stats`);
      
      if (response.data.success) {
        setStats(response.data.data);
      }
    } catch (error) {
      console.error('통계 조회 실패:', error);
    }
  };

  // 미팅 상태 변경
  const updateMeetingStatus = async (meetingId, status, notes = '') => {
    try {
      const response = await api.patch(`/users/${user.id}/history/${meetingId}/status`, {
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
      const response = await api.delete(`/users/${user.id}/history/${meetingId}`);
      
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
      '카페': '☕',
      '식당': '🍽️',
      '술집': '🍺',
      '공원': '🌳',
      '영화관': '🎬',
      '쇼핑몰': '🛍️',
      '헬스장': '💪',
      '스터디카페': '📚',
      '노래방': '🎤',
      '기타': '📍'
    };
    return icons[category] || '📍';
  };

  // 상태 배지
  const getStatusBadge = (status) => {
    const statusMap = {
      planning: { text: '계획중', color: 'bg-blue-100 text-blue-800' },
      completed: { text: '완료', color: 'bg-green-100 text-green-800' },
      cancelled: { text: '취소', color: 'bg-red-100 text-red-800' }
    };
    
    const statusInfo = statusMap[status] || statusMap.planning;
    
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusInfo.color}`}>
        {statusInfo.text}
      </span>
    );
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">로그인이 필요합니다.</p>
      </div>
    );
  }

  return (
    <div className="meeting-history">
      {/* 통계 카드 */}
      {stats && (
        <div className="stats-grid mb-8">
          <div className="stat-card">
            <h3>총 미팅 수</h3>
            <p className="stat-number">{stats.totalMeetings}</p>
          </div>
          <div className="stat-card">
            <h3>주최한 미팅</h3>
            <p className="stat-number">{stats.hostCount}</p>
          </div>
          <div className="stat-card">
            <h3>참여한 미팅</h3>
            <p className="stat-number">{stats.participantCount}</p>
          </div>
          <div className="stat-card">
            <h3>완료된 미팅</h3>
            <p className="stat-number">{stats.completedMeetings}</p>
          </div>
        </div>
      )}

      {/* 선호 카테고리 */}
      {stats?.favoriteCategories?.length > 0 && (
        <div className="favorite-categories mb-6">
          <h3 className="text-lg font-semibold mb-3">자주 찾는 장소 유형</h3>
          <div className="category-list">
            {stats.favoriteCategories.map((item, index) => (
              <div key={index} className="category-item">
                <span className="category-icon">{getCategoryIcon(item.category)}</span>
                <span className="category-name">{item.category}</span>
                <span className="category-count">{item.count}회</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 필터 */}
      <div className="filters mb-6">
        <div className="filter-group">
          <label>상태</label>
          <select 
            value={filter.status} 
            onChange={(e) => {
              setFilter({...filter, status: e.target.value});
              setPagination({...pagination, currentPage: 1});
            }}
          >
            <option value="all">전체</option>
            <option value="planning">계획중</option>
            <option value="completed">완료</option>
            <option value="cancelled">취소</option>
          </select>
        </div>
        
        <div className="filter-group">
          <label>카테고리</label>
          <select 
            value={filter.category} 
            onChange={(e) => {
              setFilter({...filter, category: e.target.value});
              setPagination({...pagination, currentPage: 1});
            }}
          >
            <option value="all">전체</option>
            <option value="카페">카페</option>
            <option value="식당">식당</option>
            <option value="술집">술집</option>
            <option value="공원">공원</option>
            <option value="영화관">영화관</option>
            <option value="쇼핑몰">쇼핑몰</option>
            <option value="기타">기타</option>
          </select>
        </div>
      </div>

      {/* 히스토리 목록 */}
      {loading ? (
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>미팅 히스토리를 불러오는 중...</p>
        </div>
      ) : history.length === 0 ? (
        <div className="empty-state">
          <p>아직 미팅 기록이 없습니다.</p>
          <p className="text-sm text-gray-500">첫 미팅을 만들어보세요!</p>
        </div>
      ) : (
        <div className="history-list">
          {history.map((meeting) => (
            <div key={meeting._id} className="history-item">
              <div className="meeting-header">
                <div className="meeting-info">
                  <h4 className="meeting-title">{meeting.title}</h4>
                  <p className="meeting-date">{formatDate(meeting.createdAt)}</p>
                </div>
                <div className="meeting-status">
                  {getStatusBadge(meeting.meetingStatus)}
                </div>
              </div>

              {meeting.selectedPlace && (
                <div className="selected-place">
                  <span className="place-icon">{getCategoryIcon(meeting.selectedPlace.category)}</span>
                  <div className="place-info">
                    <p className="place-name">{meeting.selectedPlace.name}</p>
                    <p className="place-address">{meeting.selectedPlace.address}</p>
                  </div>
                  {meeting.selectedPlace.rating && (
                    <div className="place-rating">
                      <span>⭐ {meeting.selectedPlace.rating}</span>
                    </div>
                  )}
                </div>
              )}

              <div className="meeting-details">
                <div className="detail-item">
                  <span className="detail-label">참여자 수:</span>
                  <span>{meeting.participantCount}명</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">선정 방식:</span>
                  <span>
                    {meeting.selectionMethod === 'voting' && '투표'}
                    {meeting.selectionMethod === 'random' && '랜덤'}
                    {meeting.selectionMethod === 'manual' && '수동'}
                  </span>
                </div>
                {meeting.totalVotes > 0 && (
                  <div className="detail-item">
                    <span className="detail-label">총 투표 수:</span>
                    <span>{meeting.totalVotes}표</span>
                  </div>
                )}
              </div>

              {meeting.notes && (
                <div className="meeting-notes">
                  <p className="notes-label">메모:</p>
                  <p className="notes-content">{meeting.notes}</p>
                </div>
              )}

              <div className="meeting-actions">
                {meeting.meetingStatus === 'planning' && (
                  <>
                    <button 
                      onClick={() => updateMeetingStatus(meeting.meetingId, 'completed')}
                      className="btn-complete"
                    >
                      완료 처리
                    </button>
                    <button 
                      onClick={() => updateMeetingStatus(meeting.meetingId, 'cancelled')}
                      className="btn-cancel"
                    >
                      취소 처리
                    </button>
                  </>
                )}
                <button 
                  onClick={() => deleteMeeting(meeting.meetingId)}
                  className="btn-delete"
                >
                  삭제
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 페이지네이션 */}
      {pagination.totalPages > 1 && (
        <div className="pagination">
          <button 
            onClick={() => setPagination({...pagination, currentPage: pagination.currentPage - 1})}
            disabled={!pagination.hasPrev}
            className="pagination-btn"
          >
            이전
          </button>
          
          <div className="pagination-info">
            {pagination.currentPage} / {pagination.totalPages} 페이지
          </div>
          
          <button 
            onClick={() => setPagination({...pagination, currentPage: pagination.currentPage + 1})}
            disabled={!pagination.hasNext}
            className="pagination-btn"
          >
            다음
          </button>
        </div>
      )}
    </div>
  );
};

export default MeetingHistory; 