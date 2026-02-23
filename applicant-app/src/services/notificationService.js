/**
 * Notification Service
 * Handles notification API calls
 */

import apiService from './apiService';

class NotificationService {
  /**
   * Get notifications
   */
  async getNotifications(limit = null, unreadOnly = false) {
    const params = {};
    if (limit) params.limit = limit;
    if (unreadOnly) params.unread_only = 'true';

    const response = await apiService.get('/applicant/notifications/', { params });
    return response.data.notifications;
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId) {
    const response = await apiService.post(`/applicant/notifications/${notificationId}/read/`);
    return response.data;
  }

  /**
   * Mark all notifications as read
   */
  async markAllAsRead() {
    const response = await apiService.post('/applicant/notifications/mark-all-read/');
    return response.data;
  }

  /**
   * Get unread count
   */
  async getUnreadCount() {
    const response = await apiService.get('/applicant/notifications/unread-count/');
    return response.data.unread_count;
  }
}

export default new NotificationService();
