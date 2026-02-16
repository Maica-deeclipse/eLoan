"""
Role-Based Access Control Mixins for eLoan System

Design Decision:
- Separation of Concerns: Access control logic is isolated in reusable mixins
- Defense in Depth: Multiple validation layers (authentication + role)
- Extensibility: Easy to create mixins for other roles (Treasurer, Credit Committee)
- DRY Principle: Single mixin handles all role-checking logic

Usage:
    class MyView(BookkeeperRequiredMixin, TemplateView):
        template_name = 'bookkeeper/my_template.html'
"""

from django.contrib.auth.mixins import LoginRequiredMixin, UserPassesTestMixin
from django.shortcuts import redirect
from django.contrib import messages
from django.urls import reverse_lazy


class RoleRequiredMixin(LoginRequiredMixin, UserPassesTestMixin):
    """
    Base mixin for role-based access control.

    Attributes:
        required_role (str): The role name required to access the view
        login_url (str): URL to redirect unauthenticated users
        permission_denied_url (str): URL to redirect users without proper role

    Design Decision:
    - Inherits from LoginRequiredMixin: Ensures user is authenticated first
    - Inherits from UserPassesTestMixin: Provides test_func() hook for role checking
    - Separate URLs for login vs permission denied: Better UX and security
    """
    required_role = None
    login_url = '/bookkeeper/login/'
    permission_denied_url = '/bookkeeper/access-denied/'

    def test_func(self):
        """
        Check if user has the required role.

        Returns:
            bool: True if user has required role, False otherwise
        """
        user = self.request.user

        # Check if user is authenticated and active
        if not user.is_authenticated:
            return False

        if not user.is_active or user.status != 'active':
            return False

        # Check if user has the required role
        if not user.role:
            return False

        return user.role.name == self.required_role

    def handle_no_permission(self):
        """
        Handle cases where user doesn't have permission.

        Design Decision:
        - Different handling for unauthenticated vs unauthorized users
        - Uses Django messages framework for user feedback
        - Redirects to appropriate page based on context
        """
        if not self.request.user.is_authenticated:
            # User not logged in - redirect to login
            messages.warning(self.request, 'Please log in to access this page.')
            return redirect(self.login_url)
        else:
            # User logged in but wrong role
            messages.error(
                self.request,
                'You do not have permission to access the Bookkeeper module.'
            )
            return redirect(self.permission_denied_url)


class BookkeeperRequiredMixin(RoleRequiredMixin):
    """
    Mixin that restricts access to users with 'Bookkeeper' role only.

    Design Decision:
    - Specific mixin for Bookkeeper role
    - Inherits all functionality from RoleRequiredMixin
    - Easy to understand and maintain

    Usage:
        class DashboardView(BookkeeperRequiredMixin, TemplateView):
            template_name = 'bookkeeper/dashboard.html'
    """
    required_role = 'Bookkeeper'
    login_url = reverse_lazy('bookkeeper:login')
    permission_denied_url = reverse_lazy('bookkeeper:access_denied')


class TreasurerRequiredMixin(RoleRequiredMixin):
    """
    Mixin for Treasurer role access (for future use).
    """
    required_role = 'Treasurer'
    login_url = reverse_lazy('treasurer:login')
    permission_denied_url = reverse_lazy('treasurer:access_denied')


class CreditCommitteeRequiredMixin(RoleRequiredMixin):
    """
    Mixin for Credit Committee role access (for future use).
    """
    required_role = 'Credit Committee'
    login_url = reverse_lazy('credit_committee:login')
    permission_denied_url = reverse_lazy('credit_committee:access_denied')
