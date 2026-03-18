"""
Account Member Officer Module URL Configuration

API Structure:
    /api/amo/dashboard/
    /api/amo/applications/
    /api/amo/applications/<id>/
    /api/amo/applications/<id>/approve/
    /api/amo/applications/<id>/reject/
    /api/amo/members/
    /api/amo/members/<id>/
    /api/amo/members/<id>/status/
    /api/amo/members/<id>/savings/
    /api/amo/members/<id>/capital/
    /api/amo/reports/
    /api/amo/activity-logs/
    /api/amo/notifications/
    /api/amo/notifications/<id>/read/
    /api/amo/notifications/mark-all-read/
    /api/amo/notifications/unread-count/
    /api/amo/settings/profile/
    /api/amo/settings/change-password/
"""

from django.urls import path
from . import views

app_name = 'account_member_officer'

urlpatterns = [
    # Dashboard
    path('dashboard/', views.DashboardView.as_view(), name='dashboard'),

    # Member Applications
    path('applications/', views.MemberApplicationListView.as_view(), name='applications'),
    path('applications/<int:pk>/', views.MemberApplicationDetailView.as_view(), name='application_detail'),
    path('applications/<int:pk>/approve/', views.ApproveMemberApplicationView.as_view(), name='approve_application'),
    path('applications/<int:pk>/reject/', views.RejectMemberApplicationView.as_view(), name='reject_application'),

    # Members
    path('members/', views.MemberListView.as_view(), name='members'),
    path('members/<int:pk>/', views.MemberDetailView.as_view(), name='member_detail'),
    path('members/<int:pk>/status/', views.MemberStatusView.as_view(), name='member_status'),
    path('members/<int:pk>/savings/', views.MemberSavingsView.as_view(), name='member_savings'),
    path('members/<int:pk>/capital/', views.MemberCapitalView.as_view(), name='member_capital'),

    # Reports
    path('reports/', views.ReportsView.as_view(), name='reports'),

    # Activity Logs
    path('activity-logs/', views.ActivityLogsView.as_view(), name='activity_logs'),

    # Notifications
    path('notifications/', views.NotificationListView.as_view(), name='notifications'),
    path('notifications/<int:pk>/read/', views.MarkNotificationReadView.as_view(), name='mark_notification_read'),
    path('notifications/mark-all-read/', views.MarkAllNotificationsReadView.as_view(), name='mark_all_notifications_read'),
    path('notifications/unread-count/', views.UnreadNotificationCountView.as_view(), name='unread_notification_count'),

    # Settings
    path('settings/profile/', views.ProfileView.as_view(), name='profile'),
    path('settings/change-password/', views.ChangePasswordView.as_view(), name='change_password'),
]