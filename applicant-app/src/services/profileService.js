/**
 * Profile Service
 * Handles profile API calls
 */

import apiService from './apiService';

class ProfileService {
  /**
   * Get user profile
   */
  async getProfile() {
    const response = await apiService.get('/applicant/profile/');
    return response.data;
  }

  /**
   * Update user profile
   */
  async updateProfile(profileData) {
    const response = await apiService.put('/applicant/profile/', profileData);
    return response.data;
  }

  /**
   * Get autofill data for application
   */
  async getAutofillData() {
    const response = await apiService.get('/applicant/autofill-data/');
    return response.data;
  }

  /**
   * Upload profile picture
   */
  async uploadProfilePicture(imageUri) {
    const formData = new FormData();

    const ext = imageUri.split('.').pop().toLowerCase();
    formData.append('picture', {
      uri: imageUri,
      type: `image/${ext}`,
      name: `profile_${Date.now()}.${ext}`,
    });

    const response = await apiService.post('/applicant/profile/picture/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  }

  /**
   * Remove profile picture
   */
  async removeProfilePicture() {
    const response = await apiService.delete('/applicant/profile/picture/');
    return response.data;
  }

  /**
   * Change password
   */
  async changePassword(currentPassword, newPassword, confirmPassword) {
    const response = await apiService.post('/applicant/profile/change-password/', {
      current_password: currentPassword,
      new_password: newPassword,
      confirm_password: confirmPassword,
    });
    return response.data;
  }

  /**
   * Get latest employment status change request
   */
  async getLatestEmploymentStatusRequest() {
    const response = await apiService.get('/applicant/employment-status-change/latest/');
    return response.data;
  }

  /**
   * Submit an employment status change request with COE document
   */
  async submitEmploymentStatusChangeRequest(requestedStatus, coeDoc) {
    const formData = new FormData();
    formData.append('requested_status', requestedStatus);
    const ext = coeDoc.uri.split('.').pop() || 'jpg';
    formData.append('coe_document', {
      uri: coeDoc.uri,
      type: `image/${ext}`,
      name: `coe_${Date.now()}.${ext}`,
    });
    const response = await apiService.post('/applicant/employment-status-change/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  }
}

export default new ProfileService();
