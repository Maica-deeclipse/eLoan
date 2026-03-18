import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import amoService from '../../services/amo.service';

const TYPE_COLORS = {
  new_registration: { bg: '#dbeafe', color: '#1e40af' },
  approval: { bg: '#d1fae5', color: '#065f46' },
  rejection: { bg: '#fee2e2', color: '#991b1b' },
  security_alert: { bg: '#fee2e2', color: '#991b1b' },
  action_required: { bg: '#fef3c7', color: '#92400e' },
  info: { bg: '#f3f4f6', color: '#374151' },
};

export default function AMONotifications() {
  const { fetchUnreadCount } = useOutletContext() || {};
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const data = await amoService.getNotifications();
    setNotifications(data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const markRead = async (id) => {
    await amoService.markNotificationRead(id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    if (fetchUnreadCount) fetchUnreadCount();
  };

  const markAllRead = async () => {
    await amoService.markAllNotificationsRead();
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    if (fetchUnreadCount) fetchUnreadCount();
  };

  const unread = notifications.filter(n => !n.is_read).length;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1f2937', marginBottom: '0.25rem' }}>Notifications</h1>
          <p style={{ color: '#6b7280' }}>{unread > 0 ? `${unread} unread notification${unread > 1 ? 's' : ''}` : 'All caught up!'}</p>
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
          No notifications yet.
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {notifications.map(n => {
          const typeStyle = TYPE_COLORS[n.notification_type] || TYPE_COLORS.info;
          return (
            <div key={n.id} style={{
              background: n.is_read ? '#fff' : '#f0fdf4',
              borderRadius: '12px', padding: '1.25rem',
              boxShadow: '0 1px 3px rgba(0,0,0,0.07)',
              borderLeft: `4px solid ${n.is_read ? '#e5e7eb' : '#10b981'}`,
              display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
            }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.375rem' }}>
                  <span style={{ fontWeight: 600, fontSize: '0.9rem', color: '#1f2937' }}>{n.title}</span>
                  <span style={{ background: typeStyle.bg, color: typeStyle.color, padding: '0.15rem 0.5rem', borderRadius: '9999px', fontSize: '0.7rem', fontWeight: 600 }}>
                    {n.notification_type.replace(/_/g, ' ')}
                  </span>
                  {!n.is_read && <span style={{ width: '8px', height: '8px', background: '#10b981', borderRadius: '50%', display: 'inline-block' }} />}
                </div>
                <p style={{ fontSize: '0.875rem', color: '#4b5563', margin: '0 0 0.5rem' }}>{n.message}</p>
                <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>{new Date(n.created_at).toLocaleString()}</span>
              </div>
              {!n.is_read && (
                <button onClick={() => markRead(n.id)} style={{
                  marginLeft: '1rem', background: 'none', border: '1px solid #d1d5db', padding: '0.35rem 0.75rem',
                  borderRadius: '6px', cursor: 'pointer', fontSize: '0.75rem', color: '#6b7280', whiteSpace: 'nowrap',
                }}>Mark read</button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}