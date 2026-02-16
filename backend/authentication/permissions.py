from rest_framework import permissions


class IsStaffMember(permissions.BasePermission):
    """
    Permission class that allows access only to authenticated staff members
    with authorized roles (Bookkeeper, Treasurer, Credit Committee).
    """

    def has_permission(self, request, view):
        # Check if user is authenticated
        if not request.user or not request.user.is_authenticated:
            return False

        # Super admin always has access
        if request.user.is_superuser:
            return True

        # Check if user account is active
        if not request.user.is_active or request.user.status != 'active':
            return False

        # Check if user has a role
        if not request.user.role:
            return False

        # Check if role is authorized
        authorized_roles = ['Bookkeeper', 'Treasurer', 'Credit Committee']
        return request.user.role.name in authorized_roles


class IsBookkeeper(permissions.BasePermission):
    """
    Permission class for Bookkeeper-only access.
    Bookkeepers can manage transactions and reports.
    """

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False

        # Super admin always has access
        if request.user.is_superuser:
            return True

        # Check if user is active
        if not request.user.is_active or request.user.status != 'active':
            return False

        # Check role
        if not request.user.role:
            return False

        return request.user.role.name == 'Bookkeeper'


class IsTreasurer(permissions.BasePermission):
    """
    Permission class for Treasurer-only access.
    Treasurers can approve disbursements and review balances.
    """

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False

        # Super admin always has access
        if request.user.is_superuser:
            return True

        # Check if user is active
        if not request.user.is_active or request.user.status != 'active':
            return False

        # Check role
        if not request.user.role:
            return False

        return request.user.role.name == 'Treasurer'


class IsCreditCommittee(permissions.BasePermission):
    """
    Permission class for Credit Committee-only access.
    Credit Committee members can evaluate loan applications.
    """

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False

        # Super admin always has access
        if request.user.is_superuser:
            return True

        # Check if user is active
        if not request.user.is_active or request.user.status != 'active':
            return False

        # Check role
        if not request.user.role:
            return False

        return request.user.role.name == 'Credit Committee'


class IsBookkeeperOrTreasurer(permissions.BasePermission):
    """
    Permission class for Bookkeeper or Treasurer access.
    Useful for endpoints that both roles should access.
    """

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False

        # Super admin always has access
        if request.user.is_superuser:
            return True

        # Check if user is active
        if not request.user.is_active or request.user.status != 'active':
            return False

        # Check role
        if not request.user.role:
            return False

        return request.user.role.name in ['Bookkeeper', 'Treasurer']


class IsSuperAdministrator(permissions.BasePermission):
    """
    Permission class for Super Administrator-only access.
    Only Super Admins can create users and assign roles.
    """

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False

        return request.user.is_superuser and request.user.is_staff
