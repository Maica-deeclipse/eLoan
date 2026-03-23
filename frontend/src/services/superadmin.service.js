import axios from 'axios';
import authService from './auth.service';

const API_URL = 'http://localhost:8000/api/superadmin';

const getAuthHeaders = () => {
  const token = authService.getAccessToken();
  return {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  };
};

const handleError = (error) => {
  if (error.response?.status === 401) {
    authService.logout();
    window.location.href = '/';
  }
  throw error;
};

class SuperAdminService {
  async getNotifications() {
    try {
      const res = await axios.get(`${API_URL}/notifications/`, getAuthHeaders());
      return res.data;
    } catch (e) { handleError(e); }
  }

  async markNotificationRead(id) {
    try {
      const res = await axios.post(`${API_URL}/notifications/${id}/read/`, {}, getAuthHeaders());
      return res.data;
    } catch (e) { handleError(e); }
  }

  async markAllNotificationsRead() {
    try {
      const res = await axios.post(`${API_URL}/notifications/mark-all-read/`, {}, getAuthHeaders());
      return res.data;
    } catch (e) { handleError(e); }
  }

  async getUnreadCount() {
    try {
      const res = await axios.get(`${API_URL}/notifications/unread-count/`, getAuthHeaders());
      return res.data;
    } catch (e) { handleError(e); }
  }

  async deleteNotification(id) {
    try {
      const res = await axios.post(`${API_URL}/notifications/${id}/delete/`, {}, getAuthHeaders());
      return res.data;
    } catch (e) { handleError(e); }
  }

  async archiveNotification(id) {
    try {
      const res = await axios.post(`${API_URL}/notifications/${id}/archive/`, {}, getAuthHeaders());
      return res.data;
    } catch (e) { handleError(e); }
  }
}

export default new SuperAdminService();
