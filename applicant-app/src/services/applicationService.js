/**
 * Application Service
 * Handles loan application API calls
 */

import apiService from './apiService';

class ApplicationService {
  /**
   * Check if user can apply for a new loan
   */
  async checkCanApply() {
    const response = await apiService.get('/applicant/can-apply/');
    return response.data;
  }

  /**
   * Get all active loan types
   */
  async getLoanTypes() {
    const response = await apiService.get('/applicant/loan-types/');
    return response.data.loan_types;
  }

  /**
   * Get loan type details including co-maker requirements
   */
  async getLoanTypeDetail(loanTypeId) {
    const response = await apiService.get(`/applicant/loan-types/${loanTypeId}/`);
    return response.data;
  }

  /**
   * Create a new draft application
   */
  async createApplication(loanTypeId) {
    const response = await apiService.post('/applicant/applications/create/', {
      loan_type_id: loanTypeId,
    });
    return response.data;
  }

  /**
   * Get user's applications
   */
  async getApplications(statusFilter = null) {
    const params = statusFilter ? { status: statusFilter } : {};
    const response = await apiService.get('/applicant/applications/', { params });
    return response.data.applications;
  }

  /**
   * Get application detail
   */
  async getApplication(applicationId) {
    const response = await apiService.get(`/applicant/applications/${applicationId}/`);
    return response.data;
  }

  /**
   * Update application step data
   */
  async updateStep(applicationId, stepNumber, data) {
    const response = await apiService.put(
      `/applicant/applications/${applicationId}/step/${stepNumber}/`,
      data
    );
    return response.data;
  }

  /**
   * Calculate amortization
   */
  async calculateAmortization(loanTypeId, amount, termMonths) {
    const response = await apiService.post('/applicant/calculate-amortization/', {
      loan_type_id: loanTypeId,
      amount: amount,
      term_months: termMonths,
    });
    return response.data;
  }

  /**
   * Upload document
   */
  async uploadDocument(applicationId, documentType, fileUri) {
    const formData = new FormData();
    formData.append('document_type', documentType);

    // Get file extension
    const ext = fileUri.split('.').pop().toLowerCase();
    const mimeType = ext === 'pdf' ? 'application/pdf' : `image/${ext}`;

    formData.append('file', {
      uri: fileUri,
      type: mimeType,
      name: `${documentType}_${Date.now()}.${ext}`,
    });

    const response = await apiService.post(
      `/applicant/applications/${applicationId}/documents/upload/`,
      formData,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
      }
    );
    return response.data;
  }

  /**
   * Get application documents
   */
  async getDocuments(applicationId) {
    const response = await apiService.get(`/applicant/applications/${applicationId}/documents/`);
    return response.data;
  }

  /**
   * Delete a document
   */
  async deleteDocument(documentId) {
    const response = await apiService.delete(`/applicant/documents/${documentId}/`);
    return response.data;
  }

  /**
   * Upload face capture
   */
  async uploadFaceCapture(applicationId, imageUri) {
    console.log('[ApplicationService] uploadFaceCapture called. applicationId:', applicationId, 'imageUri:', imageUri);
    const formData = new FormData();
    const filename = `face_${Date.now()}.jpg`;
    formData.append('image', {
      uri: imageUri,
      type: 'image/jpeg',
      name: filename,
    });

    try {
      console.log('[ApplicationService] Posting face capture. filename:', filename);
      const response = await apiService.post(
        `/applicant/applications/${applicationId}/face-capture/`,
        formData,
        {
          headers: { 'Content-Type': 'multipart/form-data' },
          timeout: 180000, // 3 minutes — DeepFace/TensorFlow model loading can be slow
        }
      );
      console.log('[ApplicationService] uploadFaceCapture response status:', response.status);
      console.log('[ApplicationService] uploadFaceCapture response data:', JSON.stringify(response.data));
      return response.data;
    } catch (error) {
      console.error('[ApplicationService] uploadFaceCapture FAILED');
      console.error('[ApplicationService] Error message:', error?.message);
      console.error('[ApplicationService] Response status:', error?.response?.status);
      console.error('[ApplicationService] Response data:', JSON.stringify(error?.response?.data));
      throw error;
    }
  }

  /**
   * Perform liveness check (legacy - for image-based liveness)
   */
  async performLivenessCheck(applicationId, imageUri, method) {
    const formData = new FormData();
    formData.append('image', {
      uri: imageUri,
      type: 'image/jpeg',
      name: `liveness_${Date.now()}.jpg`,
    });
    formData.append('method', method);

    const response = await apiService.post(
      `/applicant/applications/${applicationId}/liveness-check/`,
      formData,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
      }
    );
    return response.data;
  }

  /**
   * Upload liveness video for verification
   */
  async uploadLivenessVideo(applicationId, videoUri) {
    console.log('[ApplicationService] uploadLivenessVideo called');
    console.log('[ApplicationService] applicationId:', applicationId);
    console.log('[ApplicationService] videoUri:', videoUri);

    if (!videoUri) {
      console.error('[ApplicationService] videoUri is null/undefined!');
      throw new Error('videoUri is required for liveness video upload');
    }

    const filename = `liveness_${Date.now()}.mp4`;
    const formData = new FormData();
    formData.append('video', {
      uri: videoUri,
      type: 'video/mp4',
      name: filename,
    });

    console.log('[ApplicationService] FormData prepared. filename:', filename, 'type: video/mp4');

    try {
      console.log('[ApplicationService] Posting to liveness-video endpoint...');
      const response = await apiService.post(
        `/applicant/applications/${applicationId}/liveness-video/`,
        formData,
        {
          headers: { 'Content-Type': 'multipart/form-data' },
          timeout: 60000, // 60 second timeout for video upload
        }
      );
      console.log('[ApplicationService] uploadLivenessVideo response status:', response.status);
      console.log('[ApplicationService] uploadLivenessVideo response data:', JSON.stringify(response.data));
      return response.data;
    } catch (error) {
      console.error('[ApplicationService] uploadLivenessVideo FAILED');
      console.error('[ApplicationService] Error message:', error?.message);
      console.error('[ApplicationService] Response status:', error?.response?.status);
      console.error('[ApplicationService] Response data:', JSON.stringify(error?.response?.data));
      console.error('[ApplicationService] Is timeout?', error?.code === 'ECONNABORTED');
      console.error('[ApplicationService] Full error:', error);
      throw error;
    }
  }

  /**
   * Get verification status
   */
  async getVerificationStatus(applicationId) {
    const response = await apiService.get(
      `/applicant/applications/${applicationId}/verification-status/`
    );
    return response.data;
  }

  /**
   * Upload e-signature
   */
  async uploadESignature(applicationId, signatureBase64, termsAccepted) {
    const response = await apiService.post(
      `/applicant/applications/${applicationId}/esignature/`,
      {
        signature: signatureBase64,
        terms_accepted: termsAccepted,
      }
    );
    return response.data;
  }

  /**
   * Submit application for review
   */
  async submitApplication(applicationId) {
    const response = await apiService.post(
      `/applicant/applications/${applicationId}/submit/`
    );
    return response.data;
  }

  /**
   * Withdraw application
   */
  async withdrawApplication(applicationId, reason = '') {
    const response = await apiService.post(
      `/applicant/applications/${applicationId}/withdraw/`,
      { reason }
    );
    return response.data;
  }

  /**
   * Delete a draft application
   */
  async deleteDraftApplication(applicationId) {
    const response = await apiService.post(
      `/applicant/applications/${applicationId}/delete/`
    );
    return response.data;
  }

  /**
   * Search users for co-maker
   */
  async searchUsers(query) {
    const response = await apiService.get('/applicant/search-users/', {
      params: { q: query },
    });
    return response.data.users;
  }

  /**
   * Get application co-makers
   */
  async getCoMakers(applicationId) {
    const response = await apiService.get(`/applicant/applications/${applicationId}/comakers/`);
    return response.data;
  }

  /**
   * Add co-maker to application
   */
  async addCoMaker(applicationId, comakerUserId, comakerInfo) {
    const response = await apiService.post(
      `/applicant/applications/${applicationId}/comakers/`,
      {
        comaker_user_id: comakerUserId,
        comaker_info: comakerInfo,
      }
    );
    return response.data;
  }

  /**
   * Update co-maker information
   */
  async updateCoMaker(comakerId, comakerInfo) {
    const response = await apiService.put(
      `/applicant/comakers/${comakerId}/`,
      comakerInfo
    );
    return response.data;
  }

  /**
   * Remove co-maker from application
   */
  async removeCoMaker(comakerId) {
    const response = await apiService.delete(`/applicant/comakers/${comakerId}/`);
    return response.data;
  }
}

export default new ApplicationService();
