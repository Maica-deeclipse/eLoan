import { useState, useEffect, useCallback, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import superadminService from '../../services/superadmin.service';

const ICON_CONFIG = {
  security_alert:  { bg: '#fee2e2', color: '#b91c1c', icon: '🔒' },
  action_required: { bg: '#fef3c7', color: '#b45309', icon: '⚠️' },
  info:            { bg: '#e5e7eb', color: '#4b5563', icon: 'ℹ️' },
  approval:        { bg: '#d1fae5', color: '#059669', icon: '✅' },
  rejection:       { bg: '#fee2e2', color: '#dc2626', icon: '❌' },
  status_change:   { bg: '#fef3c7', color: '#d97706', icon: '🔄' },
};

export default function SuperAdminNotifications() {
  const { fetchUnreadCount } = useOutletContext() || {};
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0, notification: null });
  const contextMenuRef = useRef(null);

  const fetchNotifications = useCallback(async () => {
    try {
      const result = await superadminService.getNotifications();
      setNotifications(result.notifications || []);
      setUnreadCount(result.unread_count || 0);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  useEffect(() => {
    const dismiss = (e) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target)) {
        setContextMenu(prev => ({ ...prev, visible: false }));
      }
    };
    if (contextMenu.visible) {
      window.addEventListener('mousedown', dismiss);
    }
    return () => window.removeEventListener('mousedown', dismiss);
  }, [contextMenu.visible]);

  const handleCardClick = async (notification) => {
    if (!notification.is_read) {
      await superadminService.markNotificationRead(notification.id);
      setNotifications(prev =>
        prev.map(n => n.id === notification.id ? { ...n, is_read: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
      fetchUnreadCount?.();
    }
  };

  const handleContextMenu = (e, notification) => {
    e.preventDefault();
    setContextMenu({ visible: true, x: e.clientX, y: e.clientY, notification });
  };

  const handleMarkAllAsRead = async () => {
    await superadminService.markAllNotificationsRead();
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    setUnreadCount(0);
    fetchUnreadCount?.();
  };

  const handleDelete = async (notification) => {
    setContextMenu(prev => ({ ...prev, visible: false }));
    await superadminService.deleteNotification(notification.id);
    setNotifications(prev => prev.filter(n => n.id !== notification.id));
    if (!notification.is_read) {
      setUnreadCount(prev => Math.max(0, prev - 1));
      fetchUnreadCount?.();
    }
  };

  const handleArchive = async (notification) => {
    setContextMenu(prev => ({ ...prev, visible: false }));
    await superadminService.archiveNotification(notification.id);
    setNotifications(prev => prev.filter(n => n.id !== notification.id));
    if (!notification.is_read) {
      setUnreadCount(prev => Math.max(0, prev - 1));
      fetchUnreadCount?.();
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh', color: '#6b7280' }}>
        Loading notifications...
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1f2937', margin: '0 0 0.25rem' }}>
            System Notifications
            {unreadCount > 0 && (
              <span style={{ marginLeft: '0.75rem', background: '#ef4444', color: '#fff', padding: '0.25rem 0.75rem', borderRadius: '9999px', fontSize: '0.875rem', fontWeight: 600 }}>
                {unreadCount} unread
              </span>
            )}
          </h1>
          <p style={{ margin: 0, color: '#6b7280', fontSize: '0.875rem' }}>
            Security alerts and system-level events — visible to Super Administrator only
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllAsRead}
            style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '0.5rem 1.25rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem' }}
          >
            Mark All as Read
          </button>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {notifications.length === 0 ? (
          <div style={{ background: '#fff', borderRadius: '12px', padding: '3rem', textAlign: 'center', color: '#9ca3af', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>🔔</div>
            <h3 style={{ margin: '0 0 0.5rem', color: '#6b7280' }}>No Notifications</h3>
            <p style={{ margin: 0, fontSize: '0.875rem' }}>No system alerts at this time.</p>
          </div>
        ) : (
          notifications.map(n => {
            const cfg = ICON_CONFIG[n.notification_type] || ICON_CONFIG.info;
            return (
              <div
                key={n.id}
                onClick={() => handleCardClick(n)}
                onContextMenu={(e) => handleContextMenu(e, n)}
                style={{
                  background: n.is_read ? '#fff' : '#fff5f5',
                  borderRadius: '12px',
                  padding: '1.25rem',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                  borderLeft: `4px solid ${n.is_read ? '#e5e7eb' : '#ef4444'}`,
                  display: 'flex',
                  gap: '1rem',
                  alignItems: 'flex-start',
                  cursor: n.is_read ? 'default' : 'pointer',
                  transition: 'box-shadow 0.15s',
                  userSelect: 'none',
                }}
                onMouseEnter={e => { if (!n.is_read) e.currentTarget.style.boxShadow = '0 4px 12px rgba(239,68,68,0.15)'; }}
                onMouseLeave={e => { if (!n.is_read) e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.08)'; }}
              >
                <div style={{ width: 44, height: 44, borderRadius: '50%', background: cfg.bg, color: cfg.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '1.3rem' }}>
                  {cfg.icon}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.375rem', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: n.is_read ? 500 : 700, fontSize: '0.95rem', color: '#1f2937' }}>{n.title}</span>
                    <span style={{ background: cfg.bg, color: cfg.color, padding: '0.1rem 0.5rem', borderRadius: '9999px', fontSize: '0.7rem', fontWeight: 600 }}>
                      {n.notification_type.replace(/_/g, ' ')}
                    </span>
                    {!n.is_read && <span style={{ width: 8, height: 8, background: '#ef4444', borderRadius: '50%', display: 'inline-block', flexShrink: 0 }} />}
                  </div>
                  <p style={{ margin: '0 0 0.5rem', color: '#4b5563', fontSize: '0.875rem', lineHeight: 1.6, whiteSpace: 'pre-line' }}>{n.message}</p>
                  <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>{new Date(n.created_at).toLocaleString()}</span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {contextMenu.visible && (
        <div
          ref={contextMenuRef}
          style={{
            position: 'fixed',
            top: contextMenu.y,
            left: contextMenu.x,
            background: '#fff',
            borderRadius: '0.5rem',
            boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
            border: '1px solid #e5e7eb',
            zIndex: 9999,
            minWidth: 160,
            overflow: 'hidden',
          }}
        >
          <button
            onClick={() => handleArchive(contextMenu.notification)}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%', padding: '0.625rem 1rem', border: 'none', background: 'none', cursor: 'pointer', fontSize: '0.875rem', color: '#374151', textAlign: 'left' }}
            onMouseEnter={e => e.currentTarget.style.background = '#f3f4f6'}
            onMouseLeave={e => e.currentTarget.style.background = 'none'}
          >
            📁 Archive
          </button>
          <div style={{ height: 1, background: '#e5e7eb' }} />
          <button
            onClick={() => handleDelete(contextMenu.notification)}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%', padding: '0.625rem 1rem', border: 'none', background: 'none', cursor: 'pointer', fontSize: '0.875rem', color: '#dc2626', textAlign: 'left' }}
            onMouseEnter={e => e.currentTarget.style.background = '#fef2f2'}
            onMouseLeave={e => e.currentTarget.style.background = 'none'}
          >
            🗑️ Delete
          </button>
        </div>
      )}
    </div>
  );
}
