import { useState, useEffect } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import bookkeeperService from '../../services/bookkeeper.service';

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
      const result = await bookkeeperService.getNotifications();
      setNotifications(result.notifications);
      setUnreadCount(result.unread_count);
    } catch (err) {
      setError('Failed to load notifications');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsRead = async (id) => {
    try {
      await bookkeeperService.markNotificationRead(id);
      setNotifications(notifications.map(n =>
        n.id === id ? { ...n, is_read: true } : n
      ));
      setUnreadCount(Math.max(0, unreadCount - 1));
      fetchUnreadCount?.();
    } catch (err) {
      console.error('Failed to mark as read:', err);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await bookkeeperService.markAllNotificationsRead();
      setNotifications(notifications.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
      fetchUnreadCount?.();
    } catch (err) {
      console.error('Failed to mark all as read:', err);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <div style={{ textAlign: 'center', color: '#6b7280' }}>Loading notifications...</div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 600, color: '#1f2937', margin: 0 }}>
          Notifications
          {unreadCount > 0 && (
            <span style={{
              marginLeft: '0.75rem',
              background: '#ef4444',
              color: '#fff',
              padding: '0.25rem 0.75rem',
              borderRadius: '9999px',
              fontSize: '0.875rem',
            }}>
              {unreadCount} unread
            </span>
          )}
        </h1>
        {notifications.length > 0 && unreadCount > 0 && (
          <button
            onClick={handleMarkAllAsRead}
            style={{
              background: '#6366f1',
              color: '#fff',
              border: 'none',
              padding: '0.5rem 1rem',
              borderRadius: '0.375rem',
              cursor: 'pointer',
              fontWeight: 500,
            }}
          >
            Mark All as Read
          </button>
        )}
      </div>

      {error && (
        <div style={{ background: '#fee2e2', color: '#dc2626', padding: '1rem', borderRadius: '0.5rem', marginBottom: '1rem' }}>
          {error}
        </div>
      )}

      <div style={{ background: '#fff', borderRadius: '0.75rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
        <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid #e5e7eb' }}>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>All Notifications</h3>
        </div>

        {notifications.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#6b7280' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>&#128276;</div>
            <h3 style={{ margin: 0, marginBottom: '0.5rem' }}>No Notifications</h3>
            <p style={{ margin: 0, fontSize: '0.875rem' }}>You're all caught up!</p>
          </div>
        ) : (
          <div>
            {notifications.map((notification) => (
              <div
                key={notification.id}
                style={{
                  padding: '1rem 1.5rem',
                  borderBottom: '1px solid #e5e7eb',
                  background: notification.is_read ? '#fff' : '#f0f9ff',
                  display: 'flex',
                  gap: '1rem',
                }}
              >
                <NotificationIcon type={notification.notification_type} />
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <h4 style={{
                        margin: '0 0 0.25rem',
                        fontSize: '0.875rem',
                        fontWeight: notification.is_read ? 500 : 700,
                      }}>
                        {notification.title}
                      </h4>
                      <p style={{ margin: '0 0 0.5rem', color: '#6b7280', fontSize: '0.875rem' }}>
                        {notification.message}
                      </p>
                      <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
                        {formatTimeAgo(notification.created_at)}
                        {notification.is_read && notification.read_at && (
                          <> &bull; Read {formatTimeAgo(notification.read_at)}</>
                        )}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      {notification.related_application_id && notification.notification_type !== 'security_alert' && (
                        <Link
                          to={`/bookkeeper/applications/${notification.related_application_id}`}
                          style={{
                            background: '#6366f1',
                            color: '#fff',
                            padding: '0.375rem 0.75rem',
                            borderRadius: '0.375rem',
                            fontSize: '0.75rem',
                            textDecoration: 'none',
                          }}
                        >
                          View
                        </Link>
                      )}
                      {!notification.is_read && (
                        <button
                          onClick={() => handleMarkAsRead(notification.id)}
                          style={{
                            background: '#f3f4f6',
                            border: 'none',
                            padding: '0.375rem 0.75rem',
                            borderRadius: '0.375rem',
                            fontSize: '0.75rem',
                            cursor: 'pointer',
                          }}
                          title="Mark as read"
                        >
                          &#10003;
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Notification Types Legend */}
      <div style={{ marginTop: '1.5rem', background: '#fff', borderRadius: '0.75rem', padding: '1rem 1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <h3 style={{ margin: '0 0 0.75rem', fontSize: '0.875rem', fontWeight: 600 }}>
          Notification Types
        </h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem' }}>
          <LegendItem type="new_application" label="New Application" />
          <LegendItem type="status_change" label="Status Change" />
          <LegendItem type="action_required" label="Action Required" />
          <LegendItem type="approval" label="Approval" />
          <LegendItem type="rejection" label="Rejection" />
        </div>
      </div>
    </div>
  );
}

function NotificationIcon({ type }) {
  const iconConfig = {
    new_application: { bg: '#dbeafe', color: '#2563eb', icon: '&#128196;' },
    status_change: { bg: '#fef3c7', color: '#d97706', icon: '&#8635;' },
    action_required: { bg: '#fee2e2', color: '#dc2626', icon: '&#9888;' },
    approval: { bg: '#d1fae5', color: '#059669', icon: '&#10004;' },
    rejection: { bg: '#fee2e2', color: '#dc2626', icon: '&#10006;' },
    security_alert: { bg: '#fef3c7', color: '#b45309', icon: '&#128274;' },
    info: { bg: '#e5e7eb', color: '#4b5563', icon: '&#8505;' },
  };

  const config = iconConfig[type] || iconConfig.info;

  return (
    <div style={{
      width: '40px',
      height: '40px',
      borderRadius: '50%',
      background: config.bg,
      color: config.color,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
      fontSize: '1.25rem',
    }}>
      <span dangerouslySetInnerHTML={{ __html: config.icon }} />
    </div>
  );
}

function LegendItem({ type, label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
      <NotificationIcon type={type} />
      <span style={{ fontSize: '0.875rem', color: '#374151' }}>{label}</span>
    </div>
  );
}

function formatTimeAgo(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now - date) / 1000);

  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)} days ago`;
  return date.toLocaleDateString();
}
