import { useState, useEffect, useCallback, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import amoService from '../../services/amo.service';

const ICON_CONFIG = {
  new_registration: { bg: '#dbeafe', color: '#1e40af', icon: '👤' },
  approval:         { bg: '#d1fae5', color: '#065f46', icon: '✅' },
  rejection:        { bg: '#fee2e2', color: '#991b1b', icon: '❌' },
  savings_update:   { bg: '#d1fae5', color: '#059669', icon: '💰' },
  capital_update:   { bg: '#ede9fe', color: '#6d28d9', icon: '📈' },
  action_required:  { bg: '#fef3c7', color: '#92400e', icon: '⚠️' },
  info:             { bg: '#f3f4f6', color: '#374151', icon: 'ℹ️' },
};

export default function AMONotifications() {
  const { fetchUnreadCount } = useOutletContext() || {};
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0, notification: null });
  const contextMenuRef = useRef(null);

  const load = useCallback(async () => {
    try {
      const data = await amoService.getNotifications();
      setNotifications(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, [load]);

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
      await amoService.markNotificationRead(notification.id);
      setNotifications(prev =>
        prev.map(n => n.id === notification.id ? { ...n, is_read: true } : n)
      );
      if (fetchUnreadCount) fetchUnreadCount();
    }
  };

  const handleContextMenu = (e, notification) => {
    e.preventDefault();
    setContextMenu({ visible: true, x: e.clientX, y: e.clientY, notification });
  };

  const markAllRead = async () => {
    await amoService.markAllNotificationsRead();
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    if (fetchUnreadCount) fetchUnreadCount();
  };

  const handleDelete = async (notification) => {
    setContextMenu(prev => ({ ...prev, visible: false }));
    await amoService.deleteNotification(notification.id);
    setNotifications(prev => prev.filter(n => n.id !== notification.id));
    if (!notification.is_read && fetchUnreadCount) fetchUnreadCount();
  };

  const handleArchive = async (notification) => {
    setContextMenu(prev => ({ ...prev, visible: false }));
    await amoService.archiveNotification(notification.id);
    setNotifications(prev => prev.filter(n => n.id !== notification.id));
    if (!notification.is_read && fetchUnreadCount) fetchUnreadCount();
  };

  const unread = notifications.filter(n => !n.is_read).length;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1f2937', marginBottom: '0.25rem' }}>Notifications</h1>
          <p style={{ color: '#6b7280', margin: 0 }}>{unread > 0 ? `${unread} unread notification${unread > 1 ? 's' : ''}` : 'All caught up!'}</p>
        </div>
        {unread > 0 && (
          <button onClick={markAllRead} style={{ background: '#e5e7eb', color: '#374151', border: 'none', padding: '0.5rem 1.25rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem' }}>
            Mark all as read
          </button>
        )}
      </div>

      {loading && <div style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>Loading...</div>}

      {!loading && notifications.length === 0 && (
        <div style={{ background: '#fff', borderRadius: '12px', padding: '3rem', textAlign: 'center', color: '#9ca3af', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>🔔</div>
          No notifications yet.
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {notifications.map(n => {
          const cfg = ICON_CONFIG[n.notification_type] || ICON_CONFIG.info;
          return (
            <div
              key={n.id}
              onClick={() => handleCardClick(n)}
              onContextMenu={(e) => handleContextMenu(e, n)}
              style={{
                background: n.is_read ? '#fff' : '#f0fdf4',
                borderRadius: '12px',
                padding: '1.25rem',
                boxShadow: '0 1px 3px rgba(0,0,0,0.07)',
                borderLeft: `4px solid ${n.is_read ? '#e5e7eb' : '#10b981'}`,
                display: 'flex',
                gap: '1rem',
                alignItems: 'flex-start',
                cursor: n.is_read ? 'default' : 'pointer',
                transition: 'box-shadow 0.15s',
                userSelect: 'none',
              }}
              onMouseEnter={e => { if (!n.is_read) e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.12)'; }}
              onMouseLeave={e => { if (!n.is_read) e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.07)'; }}
            >
              <div style={{ width: 40, height: 40, borderRadius: '50%', background: cfg.bg, color: cfg.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '1.2rem' }}>
                {cfg.icon}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.375rem', flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: n.is_read ? 500 : 700, fontSize: '0.9rem', color: '#1f2937' }}>{n.title}</span>
                  <span style={{ background: cfg.bg, color: cfg.color, padding: '0.15rem 0.5rem', borderRadius: '9999px', fontSize: '0.7rem', fontWeight: 600 }}>
                    {n.notification_type.replace(/_/g, ' ')}
                  </span>
                  {!n.is_read && <span style={{ width: 8, height: 8, background: '#10b981', borderRadius: '50%', display: 'inline-block', flexShrink: 0 }} />}
                </div>
                <p style={{ fontSize: '0.875rem', color: '#4b5563', margin: '0 0 0.5rem', lineHeight: 1.5 }}>{n.message}</p>
                <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>{new Date(n.created_at).toLocaleString()}</span>
              </div>
            </div>
          );
        })}
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
