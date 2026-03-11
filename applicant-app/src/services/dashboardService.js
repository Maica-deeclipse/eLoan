/**
 * Dashboard Service
 * Handles dashboard API calls
 */

import apiService from './apiService';

class DashboardService {
  /**
   * Get dashboard data (stats, recent apps, notifications)
   */
  async getDashboard() {
    const response = await apiService.get('/applicant/dashboard/');
    return response.data;
  }

  /**
   * Check if user can apply for a loan
   */
  async checkCanApply() {
    const response = await apiService.get('/applicant/can-apply/');
    return response.data;
  }
}

export default new DashboardService();
