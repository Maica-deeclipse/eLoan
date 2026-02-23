import { useState, useEffect } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import creditCommitteeService from '../../services/creditCommittee.service';

export default function Notifications() {
  const { fetchUnreadCount } = useOutletContext();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const result = await creditCommitteeService.getNotifications();
      setNotifications(result.notifications || []);
      setUnreadCount(result.unread_count || 0);
    } catch (err) {
      setError('Failed to load notifications');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsRead = async (id) => {
    try {
      await creditCommitteeService.markNotificationRead(id);
      setNotifications(prev =>
        prev.map(n => n.id === id ? { ...n, is_read: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
      fetchUnreadCount?.();
    } catch (err) {
      console.error('Failed to mark as read:', err);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await creditCommitteeService.markAllNotificationsRead();
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
      fetchUnreadCount?.();
    } catch (err) {
      console.error('Failed to mark all as read:', err);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <div style={{ textAlign: 'center', color: '#6b7280' }}>Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ background: '#fee2e2', color: '#dc2626', padding: '1rem', borderRadius: '0.5rem' }}>
        {error}
        <button onClick={fetchNotifications} style={{ marginLeft: '1rem', textDecoration: 'underline' }}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 600, color: '#1f2937' }}>
          Notifications
          {unreadCount > 0 && (
            <span style={{
              background: '#ef4444',
              color: '#fff',
              padding: '0.25rem 0.75rem',
              borderRadius: '9999px',
              fontSize: '0.875rem',
              marginLeft: '0.75rem',
            }}>
              {unreadCount} unread
            </span>
          )}
        </h1>
        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllAsRead}
            style={{
              background: '#8b5cf6',
              color: '#fff',
              padding: '0.5rem 1rem',
              borderRadius: '0.375rem',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 500,
            }}
          >
            Mark All as Read
          </button>
        )}
      </div>

      <div style={{
        background: '#fff',
        borderRadius: '0.75rem',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        overflow: 'hidden',
      }}>
        {notifications.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#6b7280' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>&#128276;</div>
            <div style={{ fontSize: '1.125rem', fontWeight: 500 }}>No Notifications</div>
            <div style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>
              You're all caught up!
            </div>
          </div>
        ) : (
          notifications.map((notification) => (
            <div
              key={notification.id}
              style={{
                padding: '1rem 1.5rem',
                borderBottom: '1px solid #e5e7eb',
                background: notification.is_read ? '#fff' : '#f5f3ff',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                  <NotificationIcon type={notification.notification_type} />
                  <span style={{ fontWeight: 600, color: '#1f2937' }}>{notification.title}</span>
                  {!notification.is_read && (
                    <span style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      background: '#8b5cf6',
                    }} />
                  )}
                </div>
                <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.5rem' }}>
                  {notification.message}
                </div>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
                    {formatTimeAgo(notification.created_at)}
                  </span>
                  {notification.related_application_id && (
                    <Link
                      to={`/credit-committee/applications/${notification.related_application_id}`}
                      style={{
                        fontSize: '0.75rem',
                        color: '#8b5cf6',
                        textDecoration: 'none',
                      }}
                    >
                      View Application &rarr;
                    </Link>
                  )}
                </div>
              </div>
              {!notification.is_read && (
                <button
                  onClick={() => handleMarkAsRead(notification.id)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#6b7280',
                    fontSize: '0.75rem',
                    cursor: 'pointer',
                    textDecoration: 'underline',
                  }}
                >
                  Mark as Read
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function NotificationIcon({ type }) {
  const icons = {
    action_required: { icon: '&#9888;', color: '#f59e0b' },
    approval: { icon: '&#10004;', color: '#10b981' },
    rejection: { icon: '&#10006;', color: '#ef4444' },
    status_change: { icon: '&#8634;', color: '#6366f1' },
    info: { icon: '&#8505;', color: '#3b82f6' },
    new_application: { icon: '&#128196;', color: '#8b5cf6' },
  };

  const { icon, color } = icons[type] || icons.info;

  return (
    <span
      style={{
        width: '24px',
        height: '24px',
        borderRadius: '50%',
        background: `${color}15`,
        color: color,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '0.875rem',
      }}
      dangerouslySetInnerHTML={{ __html: icon }}
    />
  );
}

function formatTimeAgo(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now - date;

  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  if (days < 7) return `${days} day${days > 1 ? 's' : ''} ago`;

  return date.toLocaleDateString();
}
