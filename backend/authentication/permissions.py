from rest_framework import permissions


class IsStaffMember(permissions.BasePermission):
    """
    Permission class that allows access only to authenticated staff members
    with authorized roles (Bookkeeper, Treasurer, Credit Committee).
    """

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False

        if not request.user.is_active or request.user.status != 'active':
            return False

        if not request.user.role:
            return False

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

        if not request.user.is_active or request.user.status != 'active':
            return False

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

        if not request.user.is_active or request.user.status != 'active':
            return False

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

        if not request.user.is_active or request.user.status != 'active':
            return False

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

        if not request.user.is_active or request.user.status != 'active':
            return False

        if not request.user.role:
            return False

        return request.user.role.name in ['Bookkeeper', 'Treasurer']


class IsAccountMemberOfficer(permissions.BasePermission):
    """
    Permission class for Account Member Officer-only access.
    AMOs manage member registrations, savings, and capital.
    """

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False

        if not request.user.is_active or request.user.status != 'active':
            return False

        if not request.user.role:
            return False

        return request.user.role.name == 'Account Member Officer'


class IsSuperAdministrator(permissions.BasePermission):
    """
    Permission class for Super Administrator-only access.
    Super Admin responsibilities: approve admin registrations, loan type management,
    system oversight, and user visibility. Super Admin does NOT access operational
    endpoints belonging to other roles.
    """

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False

        return request.user.is_superuser and request.user.is_staff
