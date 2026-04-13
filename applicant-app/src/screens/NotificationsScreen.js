/**
 * Notifications Screen — Dashboard color palette
 */

import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Image,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import notificationService from '../services/notificationService';
import logger from '../utils/logger';

// ── Design Tokens ──────────────────────────────────────────────────────────────
const PRIMARY   = '#0f1c52';
const GRAD      = '#17235a';
const ACCENT    = '#4D80E4';
const WHITE     = '#FFFFFF';
const PAGE_BG   = '#EEF4FF';
const CARD_BG   = '#F4F7FF';
const MUTED     = '#94A3B8';
const SECONDARY = '#64748B';

const TYPE_ICONS = {
  new_application: '📝',
  status_change:   '🔄',
  action_required: '⚠️',
  info:            'ℹ️',
  approval:        '✅',
  rejection:       '❌',
  comaker_request: '🤝',
};

function formatTimeAgo(dateString) {
  const date = new Date(dateString);
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60)     return 'just now';
  if (seconds < 3600)   return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400)  return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return date.toLocaleDateString();
}

// ── Notification Item ──────────────────────────────────────────────────────────
const NotificationItem = ({ notification, onPress, onLongPress }) => (
  <TouchableOpacity
    style={[styles.notifCard, !notification.is_read && styles.notifCardUnread]}
    onPress={onPress}
    onLongPress={onLongPress}
    activeOpacity={0.8}
  >
    {/* unread left stripe */}
    {!notification.is_read && <View style={styles.unreadStripe} />}

    <View style={[styles.iconBubble, !notification.is_read && styles.iconBubbleUnread]}>
      <Text style={styles.typeIcon}>
        {TYPE_ICONS[notification.notification_type] || '📌'}
      </Text>
    </View>

    <View style={styles.notifBody}>
      <Text style={[styles.notifTitle, !notification.is_read && styles.notifTitleUnread]}>
        {notification.title}
      </Text>
      <Text style={styles.notifMsg} numberOfLines={2}>
        {notification.message}
      </Text>
      <Text style={styles.notifTime}>{formatTimeAgo(notification.created_at)}</Text>
    </View>

    {!notification.is_read && <View style={styles.unreadDot} />}
  </TouchableOpacity>
);

// ── Main Screen ────────────────────────────────────────────────────────────────
export default function NotificationsScreen({ navigation }) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading]             = useState(true);
  const [refreshing, setRefreshing]       = useState(false);
  const [unreadCount, setUnreadCount]     = useState(0);

  const loadNotifications = useCallback(async () => {
    try {
      const [data, count] = await Promise.all([
        notificationService.getNotifications(),
        notificationService.getUnreadCount(),
      ]);
      setNotifications(data);
      setUnreadCount(count);
    } catch (error) {
      logger.error('Load notifications error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, 30000);
    return () => clearInterval(interval);
  }, [loadNotifications]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadNotifications();
  }, [loadNotifications]);

  const handleNotificationPress = async (notification) => {
    if (!notification.is_read) {
      try {
        await notificationService.markAsRead(notification.id);
        setNotifications((prev) =>
          prev.map((n) => n.id === notification.id ? { ...n, is_read: true } : n)
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      } catch (error) {
        logger.error('Mark as read error:', error);
      }
    }
    // Co-maker request notifications open the requests screen
    if (notification.notification_type === 'comaker_request') {
      navigation.navigate('CoMakerRequests');
      return;
    }
    if (notification.related_application_id) {
      navigation.navigate('ApplicationDetail', { id: notification.related_application_id });
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationService.markAllAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (error) {
      logger.error('Mark all as read error:', error);
    }
  };

  const handleLongPress = (notification) => {
    const options = [];
    if (!notification.is_read) {
      options.push({
        text: 'Mark as Read',
        onPress: async () => {
          try {
            await notificationService.markAsRead(notification.id);
            setNotifications((prev) =>
              prev.map((n) => n.id === notification.id ? { ...n, is_read: true } : n)
            );
            setUnreadCount((prev) => Math.max(0, prev - 1));
          } catch (error) {
            logger.error('Mark as read error:', error);
          }
        },
      });
    }
    options.push({
      text: 'Archive',
      onPress: async () => {
        try {
          await notificationService.archiveNotification(notification.id);
          setNotifications((prev) => prev.filter((n) => n.id !== notification.id));
          if (!notification.is_read) setUnreadCount((prev) => Math.max(0, prev - 1));
        } catch (error) {
          logger.error('Archive notification error:', error);
        }
      },
    });
    options.push({
      text: 'Delete',
      style: 'destructive',
      onPress: async () => {
        try {
          await notificationService.deleteNotification(notification.id);
          setNotifications((prev) => prev.filter((n) => n.id !== notification.id));
          if (!notification.is_read) setUnreadCount((prev) => Math.max(0, prev - 1));
        } catch (error) {
          logger.error('Delete notification error:', error);
        }
      },
    });
    options.push({ text: 'Cancel', style: 'cancel' });
    Alert.alert('Notification Options', notification.title, options);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingScreen}>
        <ActivityIndicator size="large" color={PRIMARY} />
        <Text style={styles.loadingText}>Loading notifications…</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={PRIMARY} />

      {/* ── Header ── */}
      <View style={styles.header}>
        <View style={styles.headerOverlay} />
        <View style={styles.headerContent}>
          <View>
            <Text style={styles.headerTitle}>Alerts</Text>
            <Text style={styles.headerSubtitle}>
              {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up!'}
            </Text>
          </View>
          {unreadCount > 0 && (
            <TouchableOpacity style={styles.markAllBtn} onPress={handleMarkAllRead}>
              <Text style={styles.markAllText}>Mark all read</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* ── List ── */}
      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <NotificationItem
            notification={item}
            onPress={() => handleNotificationPress(item)}
            onLongPress={() => handleLongPress(item)}
          />
        )}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[PRIMARY]}
            tintColor={PRIMARY}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Image
              source={require('../../assets/notification.gif')}
              style={styles.emptyGif}
              resizeMode="contain"
            />
            <Text style={styles.emptyTitle}>No notifications yet</Text>
            <Text style={styles.emptySub}>
              You'll be notified about your loan applications here
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({

  screen:        { flex: 1, backgroundColor: PRIMARY },
  loadingScreen: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: PAGE_BG },
  loadingText:   { marginTop: 12, fontSize: 16, color: SECONDARY },

  // ── Header ──
  header: {
    backgroundColor: PRIMARY,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 22,
    borderBottomLeftRadius: 22,
    borderBottomRightRadius: 22,
    overflow: 'hidden',
  },
  headerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: GRAD,
    opacity: 0.55,
  },
  headerContent:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle:    { fontSize: 24, fontFamily: 'Poppins_700Bold', color: WHITE },
  headerSubtitle: { fontSize: 13, color: 'rgba(255,255,255,0.60)', marginTop: 4 },
  markAllBtn: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  markAllText: { fontSize: 12, color: WHITE, fontFamily: 'Poppins_600SemiBold' },

  // ── List ──
  listContent: {
    padding: 16,
    paddingTop: 12,
    backgroundColor: PAGE_BG,
    flexGrow: 1,
  },

  // ── Notification Card ──
  notifCard: {
    flexDirection: 'row',
    backgroundColor: WHITE,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    alignItems: 'flex-start',
    overflow: 'hidden',
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 6,
    elevation: 3,
  },
  notifCardUnread: {
    backgroundColor: CARD_BG,
  },
  unreadStripe: {
    position: 'absolute',
    left: 0, top: 0, bottom: 0,
    width: 4,
    backgroundColor: ACCENT,
    borderTopLeftRadius: 14,
    borderBottomLeftRadius: 14,
  },
  iconBubble: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: PAGE_BG,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    flexShrink: 0,
  },
  iconBubbleUnread: {
    backgroundColor: ACCENT + '20',
  },
  typeIcon: { fontSize: 18 },

  notifBody:       { flex: 1 },
  notifTitle:      { fontSize: 14, fontFamily: 'Poppins_500Medium', color: SECONDARY, marginBottom: 3 },
  notifTitleUnread:{ fontFamily: 'Poppins_700Bold', color: PRIMARY },
  notifMsg:        { fontSize: 13, color: MUTED, marginBottom: 5, lineHeight: 18 },
  notifTime:       { fontSize: 11, color: MUTED },

  unreadDot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: ACCENT,
    position: 'absolute', top: 14, right: 14,
  },

  // ── Empty State ──
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  emptyGif:   { width: 130, height: 130, marginBottom: 16 },
  emptyTitle: { fontSize: 16, fontFamily: 'Poppins_700Bold', color: PRIMARY, marginBottom: 6 },
  emptySub:   { fontSize: 13, color: MUTED, textAlign: 'center', paddingHorizontal: 32, lineHeight: 20 },
});
