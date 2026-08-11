import axios from 'axios';
import authService from './auth.service';

const API_URL = import.meta.env.VITE_API_URL?.replace('/auth', '/credit-committee') || 'http://localhost:8000/api/credit-committee';

const getAuthHeaders = () => {
  const token = authService.getAccessToken();
  return {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    }
  };
};

const handleError = (error) => {
  if (error.response?.status === 401) {
    authService.logout();
    window.location.href = '/';
  }
  throw error;
};

class CreditCommitteeService {
  // =========================================================================
  // Dashboard
  // =========================================================================
  async getDashboard() {
    try {
      const response = await axios.get(`${API_URL}/dashboard/`, getAuthHeaders());
      return response.data;
    } catch (error) {
      handleError(error);
    }
  }

  // =========================================================================
  // Applications
  // =========================================================================
  async getApplications() {
    try {
      const response = await axios.get(`${API_URL}/applications/`, getAuthHeaders());
      return response.data;
    } catch (error) {
      handleError(error);
    }
  }

  async getApplication(id) {
    try {
      const response = await axios.get(`${API_URL}/applications/${id}/`, getAuthHeaders());
      return response.data;
    } catch (error) {
      handleError(error);
    }
  }

  async getApplicationDocument(applicationId, documentId) {
    try {
      const response = await axios.get(
        `${API_URL}/applications/${applicationId}/documents/${documentId}/view/`,
        {
          ...getAuthHeaders(),
          responseType: 'blob',
        }
      );
      return response.data;
    } catch (error) {
      handleError(error);
    }
  }

  async submitDecision(id, decision, remarks, meetingDate, rejectionCategory = null) {
    try {
      const response = await axios.post(
        `${API_URL}/applications/${id}/decide/`,
        { decision, remarks, meeting_date: meetingDate, rejection_category: rejectionCategory },
        getAuthHeaders()
      );
      return response.data;
    } catch (error) {
      handleError(error);
    }
  }

  // =========================================================================
  // Decision History
  // =========================================================================
  async getDecisionHistory(filters = {}) {
    try {
      const params = new URLSearchParams(filters);
      const response = await axios.get(`${API_URL}/decisions/?${params}`, getAuthHeaders());
      return response.data;
    } catch (error) {
      handleError(error);
    }
  }

  // =========================================================================
  // Reports
  // =========================================================================
  async getReports(type = 'summary', filters = {}) {
    try {
      const params = new URLSearchParams({ type, ...filters });
      const response = await axios.get(`${API_URL}/reports/?${params}`, getAuthHeaders());
      return response.data;
    } catch (error) {
      handleError(error);
    }
  }

  // =========================================================================
  // Notifications
  // =========================================================================
  async getNotifications() {
    try {
      const response = await axios.get(`${API_URL}/notifications/`, getAuthHeaders());
      return response.data;
    } catch (error) {
      handleError(error);
    }
  }

  async getUnreadCount() {
    try {
      const response = await axios.get(`${API_URL}/notifications/unread-count/`, getAuthHeaders());
      return response.data;
    } catch (error) {
      handleError(error);
    }
  }

  async markNotificationRead(id) {
    try {
      const response = await axios.post(`${API_URL}/notifications/${id}/read/`, {}, getAuthHeaders());
      return response.data;
    } catch (error) {
      handleError(error);
    }
  }

  async markAllNotificationsRead() {
    try {
      const response = await axios.post(`${API_URL}/notifications/mark-all-read/`, {}, getAuthHeaders());
      return response.data;
    } catch (error) {
      handleError(error);
    }
  }

  async deleteNotification(id) {
    try {
      const response = await axios.post(`${API_URL}/notifications/${id}/delete/`, {}, getAuthHeaders());
      return response.data;
    } catch (error) {
      handleError(error);
    }
  }

  async archiveNotification(id) {
    try {
      const response = await axios.post(`${API_URL}/notifications/${id}/archive/`, {}, getAuthHeaders());
      return response.data;
    } catch (error) {
      handleError(error);
    }
  }

  // =========================================================================
  // Settings
  // =========================================================================
  async getProfile() {
    try {
      const response = await axios.get(`${API_URL}/settings/profile/`, getAuthHeaders());
      return response.data;
    } catch (error) {
      handleError(error);
    }
  }

  async updateProfile(profileData) {
    try {
      const response = await axios.put(`${API_URL}/settings/profile/`, profileData, getAuthHeaders());
      return response.data;
    } catch (error) {
      handleError(error);
    }
  }

  async uploadProfilePicture(file) {
    try {
      const token = authService.getAccessToken();
      const formData = new FormData();
      formData.append('profile_picture', file);

      const response = await axios.post(
        `${API_URL}/settings/profile/picture/`,
        formData,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'multipart/form-data',
          }
        }
      );
      return response.data;
    } catch (error) {
      handleError(error);
    }
  }

  async removeProfilePicture() {
    try {
      const response = await axios.delete(`${API_URL}/settings/profile/picture/`, getAuthHeaders());
      return response.data;
    } catch (error) {
      handleError(error);
    }
  }

  async changePassword(oldPassword, newPassword, confirmPassword) {
    try {
      const response = await axios.post(
        `${API_URL}/settings/change-password/`,
        { old_password: oldPassword, new_password: newPassword, confirm_password: confirmPassword },
        getAuthHeaders()
      );
      return response.data;
    } catch (error) {
      handleError(error);
    }
  }

  async getNotificationPreferences() {
    try {
      const response = await axios.get(`${API_URL}/settings/notification-preferences/`, getAuthHeaders());
      return response.data;
    } catch (error) {
      handleError(error);
    }
  }

  async updateNotificationPreferences(preferences) {
    try {
      const response = await axios.put(
        `${API_URL}/settings/notification-preferences/`,
        preferences,
        getAuthHeaders()
      );
      return response.data;
    } catch (error) {
      handleError(error);
    }
  }

  async deactivateAccount(password) {
    try {
      const response = await axios.post(
        `${API_URL}/settings/deactivate-account/`,
        { password },
        getAuthHeaders()
      );
      return response.data;
    } catch (error) {
      handleError(error);
    }
  }

  async logoutEverywhere() {
    try {
      const response = await axios.post(`${API_URL}/settings/logout-everywhere/`, {}, getAuthHeaders());
      return response.data;
    } catch (error) {
      handleError(error);
    }
  }
}

export default new CreditCommitteeService();
