"""
Credit Committee Module API URL Configuration

API Structure:
    /api/credit-committee/dashboard/
    /api/credit-committee/applications/
    /api/credit-committee/applications/<id>/
    /api/credit-committee/applications/<id>/decide/
    /api/credit-committee/decisions/
    /api/credit-committee/reports/
    /api/credit-committee/notifications/
    /api/credit-committee/notifications/<id>/read/
    /api/credit-committee/notifications/mark-all-read/
    /api/credit-committee/notifications/unread-count/
    /api/credit-committee/settings/profile/
    /api/credit-committee/settings/profile/picture/
    /api/credit-committee/settings/change-password/
    /api/credit-committee/settings/notification-preferences/
    /api/credit-committee/settings/deactivate-account/
    /api/credit-committee/settings/logout-everywhere/
"""

from django.urls import path
from . import views

app_name = 'credit_committee'

urlpatterns = [
    # Dashboard
    path('dashboard/', views.DashboardView.as_view(), name='dashboard'),

    # Applications
    path('applications/', views.ApplicationListView.as_view(), name='applications'),
    path('applications/<int:pk>/', views.ApplicationDetailView.as_view(), name='application_detail'),
    path('applications/<int:pk>/decide/', views.SubmitDecisionView.as_view(), name='submit_decision'),

    # Decision History
    path('decisions/', views.DecisionHistoryView.as_view(), name='decision_history'),

    # Reports
    path('reports/', views.ReportsView.as_view(), name='reports'),

    # Notifications
    path('notifications/', views.NotificationListView.as_view(), name='notifications'),
    path('notifications/<int:pk>/read/', views.MarkNotificationReadView.as_view(), name='mark_notification_read'),
    path('notifications/mark-all-read/', views.MarkAllNotificationsReadView.as_view(), name='mark_all_notifications_read'),
    path('notifications/unread-count/', views.UnreadNotificationCountView.as_view(), name='unread_notification_count'),

    # Settings
    path('settings/profile/', views.ProfileView.as_view(), name='profile'),
    path('settings/profile/picture/', views.ProfilePictureView.as_view(), name='profile_picture'),
    path('settings/change-password/', views.ChangePasswordView.as_view(), name='change_password'),
    path('settings/notification-preferences/', views.NotificationPreferencesView.as_view(), name='notification_preferences'),
    path('settings/deactivate-account/', views.DeactivateAccountView.as_view(), name='deactivate_account'),
    path('settings/logout-everywhere/', views.LogoutEverywhereView.as_view(), name='logout_everywhere'),
]
