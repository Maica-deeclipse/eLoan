"""
Superadmin Module URL Configuration

API Structure:
    /api/superadmin/stats/                          - GET: aggregate counts for dashboard
    /api/superadmin/staff/                          - GET: list staff users
    /api/superadmin/staff/<id>/<action>/            - POST: approve/reject/suspend/reactivate
    /api/superadmin/members/                        - GET: all members with violation counts
    /api/superadmin/members/<id>/case-history/      - GET: full case history (violations + actions)
    /api/superadmin/members/<id>/terminate/         - POST: terminate member
    /api/superadmin/violations/                     - GET/POST: list or create violations
    /api/superadmin/violations/<id>/                - GET/PATCH: view or update violation
    /api/superadmin/disciplinary-actions/           - GET/POST: list or create disciplinary actions
    /api/superadmin/notifications/                  - GET: list notifications
    /api/superadmin/notifications/<id>/read/        - POST: mark one as read
    /api/superadmin/notifications/mark-all-read/    - POST: mark all as read
    /api/superadmin/notifications/unread-count/     - GET: unread count
"""

from django.urls import path
from . import views

app_name = 'superadmin'

urlpatterns = [
    # Stats
    path('stats/', views.StatsView.as_view(), name='stats'),

    # Staff management
    path('staff/', views.StaffListView.as_view(), name='staff_list'),
    path('staff/<int:user_id>/<str:action>/', views.StaffActionView.as_view(), name='staff_action'),

    # Member overview and case management
    path('members/', views.MemberOverviewView.as_view(), name='member_overview'),
    path('members/<int:member_id>/case-history/', views.MemberCaseHistoryView.as_view(), name='member_case_history'),
    path('members/<int:member_id>/terminate/', views.TerminateMemberView.as_view(), name='terminate_member'),

    # Violations
    path('violations/', views.ViolationListView.as_view(), name='violations'),
    path('violations/<int:pk>/', views.ViolationDetailView.as_view(), name='violation_detail'),

    # Disciplinary Actions
    path('disciplinary-actions/', views.DisciplinaryActionListView.as_view(), name='disciplinary_actions'),

    # Notifications
    path('notifications/', views.NotificationListView.as_view(), name='notifications'),
    path('notifications/mark-all-read/', views.MarkAllNotificationsReadView.as_view(), name='notifications_mark_all_read'),
    path('notifications/unread-count/', views.UnreadNotificationCountView.as_view(), name='notifications_unread_count'),
    path('notifications/<int:pk>/read/', views.MarkNotificationReadView.as_view(), name='notification_mark_read'),
    path('notifications/<int:pk>/delete/', views.DeleteNotificationView.as_view(), name='notification_delete'),
    path('notifications/<int:pk>/archive/', views.ArchiveNotificationView.as_view(), name='notification_archive'),
]
