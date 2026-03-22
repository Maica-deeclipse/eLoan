"""
Superadmin Module URL Configuration

API Structure:
    /api/superadmin/members/                        - GET: all members with violation counts
    /api/superadmin/members/<id>/case-history/      - GET: full case history (violations + actions)
    /api/superadmin/members/<id>/terminate/         - POST: terminate member
    /api/superadmin/violations/                     - GET/POST: list or create violations
    /api/superadmin/violations/<id>/                - GET/PATCH: view or update violation
    /api/superadmin/disciplinary-actions/           - GET/POST: list or create disciplinary actions
"""

from django.urls import path
from . import views

app_name = 'superadmin'

urlpatterns = [
    # Member overview and case management
    path('members/', views.MemberOverviewView.as_view(), name='member_overview'),
    path('members/<int:member_id>/case-history/', views.MemberCaseHistoryView.as_view(), name='member_case_history'),
    path('members/<int:member_id>/terminate/', views.TerminateMemberView.as_view(), name='terminate_member'),

    # Violations
    path('violations/', views.ViolationListView.as_view(), name='violations'),
    path('violations/<int:pk>/', views.ViolationDetailView.as_view(), name='violation_detail'),

    # Disciplinary Actions
    path('disciplinary-actions/', views.DisciplinaryActionListView.as_view(), name='disciplinary_actions'),
]
