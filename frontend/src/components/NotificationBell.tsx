// frontend/src/components/NotificationBell.tsx
import React, { useState, useEffect, useRef } from 'react';
import { BellIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import { useAuth } from '../context/AuthContext';

interface Notification {
  id: string;
  type: 'NEW_TASK' | 'TASK_UPDATE' | 'MENTION' | 'SYSTEM' | 'info' | 'task' | 'alert';
  message: string;
  timestamp: string;
  read: boolean;
  payload?: Record<string, any>;
}

const NotificationBell: React.FC = () => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttempts = useRef(0);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const USER_ID = user?.username || user?.id || null;
  const WS_URL = `ws://localhost:8000/ws`;

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showDropdown]);

  // WebSocket with Reconnection
  useEffect(() => {
    if (!USER_ID) {
      console.log('❌ No user ID available, skipping WebSocket connection');
      setNotifications([]);
      setUnreadCount(0);
      return;
    }

    const connect = () => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        console.log('✓ WebSocket already connected');
        return;
      }

      try {
        console.log(`🔌 Connecting WebSocket for user: ${USER_ID}`);
        const ws = new WebSocket(`${WS_URL}/${USER_ID}`);
        wsRef.current = ws;

        ws.onopen = () => {
          console.log(`✓ Notifications WebSocket connected for ${USER_ID}`);
          reconnectAttempts.current = 0;
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            console.log('📨 Received notification:', data);
            
            const notif: Notification = {
              id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
              type: data.type || 'info',
              message: data.payload?.text || data.message || 'New update',
              timestamp: new Date().toISOString(),
              read: false,
              payload: data.payload,
            };
            
            setNotifications((prev) => [notif, ...prev].slice(0, 50));
            setUnreadCount((c) => c + 1);
          } catch (err) {
            console.error('❌ Invalid WebSocket message:', err);
          }
        };

        ws.onclose = (event) => {
          wsRef.current = null;
          console.log(`🔌 WebSocket closed (Code: ${event.code}). Reconnecting...`);
          
          const delay = Math.min(1000 * 2 ** reconnectAttempts.current, 10000);
          reconnectAttempts.current++;
          
          reconnectTimeout.current = setTimeout(connect, delay);
        };

        ws.onerror = (error) => {
          console.error('❌ WebSocket error:', error);
          ws.close();
        };
      } catch (err) {
        console.error('❌ Failed to create WebSocket:', err);
      }
    };

    connect();

    return () => {
      console.log('🧹 Cleaning up WebSocket connection');
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      if (reconnectTimeout.current) {
        clearTimeout(reconnectTimeout.current);
      }
    };
  }, [USER_ID]);

  // Load Mock Data (Dev Fallback) - only if no real notifications
  useEffect(() => {
    if (notifications.length === 0 && USER_ID) {
      console.log('📝 Loading mock notifications for development');
      const mock: Notification[] = [
        {
          id: 'mock-1',
          type: 'task',
          message: 'New task: Review Q4 roadmap',
          timestamp: new Date(Date.now() - 10 * 60000).toISOString(),
          read: false,
        },
        {
          id: 'mock-2',
          type: 'info',
          message: 'Team sentiment up 12% this week',
          timestamp: new Date(Date.now() - 60 * 60000).toISOString(),
          read: false,
        },
        {
          id: 'mock-3',
          type: 'alert',
          message: 'System: Backend connected successfully',
          timestamp: new Date(Date.now() - 2 * 3600000).toISOString(),
          read: true,
        },
      ];
      setNotifications(mock);
      setUnreadCount(mock.filter(n => !n.read).length);
    }
  }, [USER_ID]);

  // Actions
  const markAsRead = (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    setUnreadCount(c => Math.max(0, c - 1));
  };

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setUnreadCount(0);
  };

  const getTimeAgo = (ts: string) => {
    const diff = Date.now() - new Date(ts).getTime();
    const min = Math.floor(diff / 60000);
    const hr = Math.floor(diff / 3600000);
    const day = Math.floor(diff / 86400000);
    if (min < 1) return 'now';
    if (min < 60) return `${min}m`;
    if (hr < 24) return `${hr}h`;
    return `${day}d`;
  };

  const getIcon = (type: Notification['type']) => {
    const icons: Record<string, string> = {
      task: '📋',
      alert: '🚨',
      info: 'ℹ️',
      NEW_TASK: '✅',
      TASK_UPDATE: '🔄',
      MENTION: '@',
      SYSTEM: '⚙️',
    };
    return icons[type] || '🔔';
  };

  return (
    <div ref={dropdownRef} style={{ position: 'relative', display: 'inline-block' }}>
      {/* Bell Button */}
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        style={{
          position: 'relative',
          background: 'var(--surface-elevated)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-md)',
          padding: '0.5rem',
          cursor: 'pointer',
          color: 'var(--text-primary)',
          transition: 'all 0.2s',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
        onMouseEnter={e => {
          e.currentTarget.style.background = 'var(--surface-hover)';
          e.currentTarget.style.transform = 'translateY(-1px)';
        }}
        onMouseLeave={e => {
          e.currentTarget.style.background = 'var(--surface-elevated)';
          e.currentTarget.style.transform = 'translateY(0)';
        }}
        title={`${unreadCount} unread`}
      >
        <BellIcon style={{ width: 20, height: 20 }} />
        {unreadCount > 0 && (
          <span
            style={{
              position: 'absolute',
              top: -6,
              right: -6,
              background: '#ef4444',
              color: 'white',
              borderRadius: '50%',
              minWidth: 18,
              height: 18,
              fontSize: '0.7rem',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 4px',
              animation: 'pulse 2s infinite',
            }}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {showDropdown && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            width: 340,
            maxHeight: '80vh',
            background: 'var(--surface)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: 'var(--shadow-xl)',
            zIndex: 1000,
            overflow: 'hidden',
            animation: 'fadeInDown 0.2s ease-out',
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: '1rem',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: 'var(--surface-light)',
            }}
          >
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>
              Notifications
            </h3>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--primary-color)',
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                  fontWeight: 500
                }}
              >
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div style={{ maxHeight: 400, overflowY: 'auto' }}>
            {notifications.length === 0 ? (
              <div style={{ padding: '3rem 1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                <CheckCircleIcon style={{ width: 40, height: 40, margin: '0 auto 0.5rem', opacity: 0.5 }} />
                <p style={{ margin: 0, fontSize: '0.9rem' }}>You're all caught up!</p>
              </div>
            ) : (
              notifications.map(notif => (
                <div
                  key={notif.id}
                  onClick={() => markAsRead(notif.id)}
                  style={{
                    padding: '1rem',
                    borderBottom: '1px solid var(--border-color)',
                    cursor: 'pointer',
                    background: notif.read ? 'transparent' : 'var(--surface-elevated)',
                    transition: 'background 0.2s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-hover)'}
                  onMouseLeave={e => e.currentTarget.style.background = notif.read ? 'transparent' : 'var(--surface-elevated)'}
                >
                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: '50%',
                        background: 'var(--primary-light)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '1.2rem',
                        flexShrink: 0
                      }}
                    >
                      {getIcon(notif.type)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{
                        margin: '0 0 0.25rem',
                        fontSize: '0.9rem',
                        fontWeight: notif.read ? 400 : 600,
                        color: 'var(--text-primary)',
                        lineHeight: 1.4
                      }}>
                        {notif.message}
                      </p>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {getTimeAgo(notif.timestamp)}
                      </span>
                    </div>
                    {!notif.read && (
                      <div style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: 'var(--primary-color)',
                        marginTop: '0.5rem',
                        flexShrink: 0
                      }} />
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div
            style={{
              padding: '0.75rem',
              borderTop: '1px solid var(--border-color)',
              textAlign: 'center',
              background: 'var(--surface-light)',
            }}
          >
            <button
              onClick={() => setShowDropdown(false)}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--primary-color)',
                fontSize: '0.875rem',
                cursor: 'pointer',
                fontWeight: 500,
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* CSS Animations */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
        @keyframes fadeInDown {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};

export default NotificationBell;