"""
Treasurer Module API URL Configuration

REST API endpoints for React frontend.
All endpoints require JWT authentication.

API Structure:
    /api/treasurer/dashboard/
    /api/treasurer/applications/forwarded/
    /api/treasurer/applications/<id>/
    /api/treasurer/applications/<id>/evaluate/
    /api/treasurer/loans/disbursed/
    /api/treasurer/loans/<id>/payments/
    /api/treasurer/loans/<id>/payments/add/
    /api/treasurer/loans/monitoring/
    /api/treasurer/reports/
    /api/treasurer/notifications/
    /api/treasurer/notifications/<id>/read/
    /api/treasurer/notifications/mark-all-read/
    /api/treasurer/notifications/unread-count/
    /api/treasurer/settings/profile/
    /api/treasurer/settings/profile/picture/
    /api/treasurer/settings/change-password/
    /api/treasurer/settings/notification-preferences/
    /api/treasurer/settings/deactivate-account/
    /api/treasurer/settings/logout-everywhere/
"""

from django.urls import path
from . import views

app_name = 'treasurer'

urlpatterns = [
    # ==========================================================================
    # Dashboard
    # ==========================================================================
    path('dashboard/', views.DashboardView.as_view(), name='dashboard'),

    # ==========================================================================
    # Forwarded Applications (Evaluation)
    # ==========================================================================
    path('applications/forwarded/', views.ForwardedApplicationsView.as_view(), name='forwarded_applications'),
    path('applications/<int:pk>/', views.ApplicationDetailView.as_view(), name='application_detail'),
    path('applications/<int:pk>/evaluate/', views.EvaluateApplicationView.as_view(), name='evaluate_application'),

    # ==========================================================================
    # Loans & Payments
    # ==========================================================================
    path('loans/disbursed/', views.DisbursedLoansView.as_view(), name='disbursed_loans'),
    path('loans/<int:pk>/payments/', views.PaymentHistoryView.as_view(), name='payment_history'),
    path('loans/<int:pk>/payments/add/', views.RecordPaymentView.as_view(), name='record_payment'),
    path('loans/monitoring/', views.LoanMonitoringView.as_view(), name='loan_monitoring'),

    # ==========================================================================
    # Reports
    # ==========================================================================
    path('reports/', views.ReportsView.as_view(), name='reports'),

    # ==========================================================================
    # Notifications
    # ==========================================================================
    path('notifications/', views.NotificationListView.as_view(), name='notifications'),
    path('notifications/<int:pk>/read/', views.MarkNotificationReadView.as_view(), name='mark_notification_read'),
    path('notifications/mark-all-read/', views.MarkAllNotificationsReadView.as_view(), name='mark_all_notifications_read'),
    path('notifications/unread-count/', views.UnreadNotificationCountView.as_view(), name='unread_notification_count'),

    # ==========================================================================
    # Settings
    # ==========================================================================
    path('settings/profile/', views.ProfileView.as_view(), name='profile'),
    path('settings/profile/picture/', views.ProfilePictureView.as_view(), name='profile_picture'),
    path('settings/change-password/', views.ChangePasswordView.as_view(), name='change_password'),
    path('settings/notification-preferences/', views.NotificationPreferencesView.as_view(), name='notification_preferences'),
    path('settings/deactivate-account/', views.DeactivateAccountView.as_view(), name='deactivate_account'),
    path('settings/logout-everywhere/', views.LogoutEverywhereView.as_view(), name='logout_everywhere'),
]
