"""
User Administration for eLoan System

EMAIL BEHAVIOR IN DEVELOPMENT:
    When you create a new user, the invitation email is printed to the terminal
    where 'python manage.py runserver' is running (not the browser).

    Look for this in your terminal:
    ================================================================================
    📧 SENDING INVITATION EMAIL
    ================================================================================
    To: user@example.com
    Password Reset Link: http://localhost:3000/set-password/...
    ================================================================================
    ✅ SUCCESS: Invitation email sent to user@example.com

PRODUCTION:
    Set environment variables for SMTP (EMAIL_HOST, EMAIL_HOST_USER, etc.)
    and change EMAIL_BACKEND to 'django.core.mail.backends.smtp.EmailBackend'
"""

from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.core.mail import send_mail
from django.urls import reverse
from django.utils.html import format_html
from django.utils import timezone
from django import forms
from django.conf import settings
from unfold.admin import ModelAdmin
from unfold.decorators import display
from unfold.contrib.filters.admin import RangeDateFilter
from .models import User, Role, Applicant, AdminUser
from authentication.password_reset import generate_password_reset_link


class UserCreationForm(forms.ModelForm):
    """Form for creating new users in the admin panel."""

    class Meta:
        model = User
        fields = ('email', 'firstname', 'lastname', 'role', 'status', 'account_status')

    def save(self, commit=True):
        user = super().save(commit=False)
        # Don't set a password - user will set it via email link
        user.set_unusable_password()
        if commit:
            user.save()
            # Send invitation and track success
            self._email_sent_successfully = self.send_invitation_email(user)
        return user

    def send_invitation_email(self, user):
        """Send invitation email with password reset link."""
        reset_link = generate_password_reset_link(user, frontend_url=settings.FRONTEND_URL)

        subject = 'Welcome to eLoan - Set Your Password'
        message = f"""
Hello {user.firstname} {user.lastname},

You have been invited to join the eLoan system as a {user.role.name if user.role else 'staff member'}.

Please click the link below to set your password and activate your account:
{reset_link}

This link will expire after a certain period for security reasons.

If you did not expect this invitation, please ignore this email.

Best regards,
eLoan Admin Team
        """

        # Print prominent console message
        print("\n" + "="*80)
        print("📧 SENDING INVITATION EMAIL")
        print("="*80)
        print(f"To: {user.email}")
        print(f"From: {settings.DEFAULT_FROM_EMAIL}")
        print(f"Subject: {subject}")
        print(f"\nPassword Reset Link:")
        print(f"{reset_link}")
        print("="*80 + "\n")

        try:
            send_mail(
                subject,
                message,
                settings.DEFAULT_FROM_EMAIL,
                [user.email],
                fail_silently=False,
            )
            print(f"✅ SUCCESS: Invitation email sent to {user.email}\n")
            return True
        except Exception as e:
            print(f"❌ ERROR: Failed to send email to {user.email}")
            print(f"Exception: {str(e)}\n")
            import traceback
            traceback.print_exc()
            return False


class UserChangeForm(forms.ModelForm):
    """Form for updating users in the admin panel."""

    class Meta:
        model = User
        fields = ('email', 'firstname', 'lastname', 'role', 'status', 'is_active', 'is_staff', 'account_status')


@admin.register(User)
class UserAdmin(BaseUserAdmin, ModelAdmin):
    form = UserChangeForm
    add_form = UserCreationForm

    list_display = ('email', 'get_full_name', 'role', 'account_status_display', 'status', 'is_staff', 'date_joined')
    list_filter = ('role', 'status', 'account_status', 'is_staff', 'is_superuser', 'date_joined')

    fieldsets = (
        (None, {'fields': ('email',)}),
        ('Personal Info', {'fields': ('firstname', 'lastname')}),
        ('Role & Status', {'fields': ('role', 'status', 'account_status')}),
        ('Approval Info', {'fields': ('approved_by', 'approved_at', 'rejection_reason'), 'classes': ('collapse',)}),
        ('Permissions', {'fields': ('is_active', 'is_staff', 'is_superuser', 'groups', 'user_permissions')}),
        ('Important dates', {'fields': ('last_login', 'date_joined')}),
    )

    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': ('email', 'firstname', 'lastname', 'role', 'status', 'account_status'),
            'description': 'An invitation email will be sent to the user to set their password.'
        }),
    )

    readonly_fields = ('last_login', 'date_joined', 'approved_by', 'approved_at')

    @display(description='Account Status', label=True)
    def account_status_display(self, obj):
        if obj.account_status == 'approved':
            return 'Approved', 'success'
        elif obj.account_status == 'rejected':
            return 'Rejected', 'danger'
        return 'Pending', 'warning'

    search_fields = ('email', 'firstname', 'lastname')
    ordering = ('-date_joined',)
    filter_horizontal = ('groups', 'user_permissions',)

    def save_model(self, request, obj, form, change):
        """Override to show email status message after user creation."""
        super().save_model(request, obj, form, change)

        # Only show message for new user creation (not updates)
        if not change and isinstance(form, UserCreationForm):
            if hasattr(form, '_email_sent_successfully') and form._email_sent_successfully:
                self.message_user(
                    request,
                    f"✅ User '{obj.email}' created successfully! "
                    f"Invitation email sent. Check your Django console/terminal for the "
                    f"password reset link.",
                    level='SUCCESS'
                )
            else:
                self.message_user(
                    request,
                    f"⚠️ User '{obj.email}' created but failed to send invitation email. "
                    f"Check console for error details.",
                    level='WARNING'
                )

    def get_full_name(self, obj):
        return f"{obj.firstname} {obj.lastname}"
    get_full_name.short_description = 'Full Name'

    actions = ['approve_registrations', 'reject_registrations', 'activate_users', 'suspend_users']

    def approve_registrations(self, request, queryset):
        """Approve pending user registrations."""
        pending_users = queryset.filter(account_status='pending')
        count = 0
        for user in pending_users:
            user.account_status = 'approved'
            user.approved_by = request.user
            user.approved_at = timezone.now()
            user.save()

            # Set member_since date if applicant and not yet set
            if user.role and user.role.name == 'Applicant':
                try:
                    from datetime import date
                    applicant = user.applicant
                    if applicant.member_since is None:
                        applicant.member_since = date.today()
                        applicant.save(update_fields=['member_since'])
                except Exception as e:
                    print(f"Could not set member_since for {user.email}: {e}")

            # Log the approval
            try:
                from applicant.models import MembershipApprovalLog
                MembershipApprovalLog.objects.create(
                    user=user,
                    action='approved',
                    performed_by=request.user,
                    ip_address=request.META.get('REMOTE_ADDR'),
                )
            except Exception as e:
                print(f"Could not log approval for {user.email}: {e}")

            count += 1

        self.message_user(request, f"{count} registration(s) approved successfully.")
    approve_registrations.short_description = "Approve selected registrations"

    def reject_registrations(self, request, queryset):
        """Reject pending user registrations."""
        pending_users = queryset.filter(account_status='pending')
        count = 0
        for user in pending_users:
            user.account_status = 'rejected'
            user.save()

            # Log the rejection
            try:
                from applicant.models import MembershipApprovalLog
                MembershipApprovalLog.objects.create(
                    user=user,
                    action='rejected',
                    performed_by=request.user,
                    ip_address=request.META.get('REMOTE_ADDR'),
                )
            except Exception as e:
                print(f"Could not log rejection for {user.email}: {e}")

            count += 1

        self.message_user(request, f"{count} registration(s) rejected.")
    reject_registrations.short_description = "Reject selected registrations"

    def activate_users(self, request, queryset):
        """Admin action to activate users."""
        updated = queryset.update(status='active', is_active=True)
        self.message_user(request, f"{updated} user(s) activated.")
    activate_users.short_description = "Activate selected users"

    def suspend_users(self, request, queryset):
        """Admin action to suspend users."""
        updated = queryset.update(status='suspended', is_active=False)
        self.message_user(request, f"{updated} user(s) suspended.")
    suspend_users.short_description = "Suspend selected users"


@admin.register(Role)
class RoleAdmin(ModelAdmin):
    list_display = ('name', 'user_count')
    search_fields = ('name',)

    def user_count(self, obj):
        return obj.user_set.count()
    user_count.short_description = 'Number of Users'


@admin.register(Applicant)
class ApplicantAdmin(ModelAdmin):
    """Combined applicant profile and membership view."""

    list_display = ('email', 'get_full_name', 'membership_type', 'membership_status', 'account_status_display', 'member_since')
    list_filter = ('membership_type', 'membership_status', 'account_status', 'member_since')
    search_fields = ('email', 'firstname', 'lastname', 'contact_number')
    readonly_fields = ('profile_created_at', 'profile_updated_at', 'member_since')
    ordering = ['-profile_created_at']

    fieldsets = (
        ('Account', {'fields': ('email', 'firstname', 'lastname', 'role', 'status', 'account_status')}),
        ('Contact', {'fields': ('contact_number', 'secondary_contact')}),
        ('Present Address', {'fields': ('address_line1', 'address_line2', 'city', 'province', 'zip_code')}),
        ('Personal', {'fields': ('gender', 'middle_name', 'date_of_birth', 'civil_status', 'citizenship')}),
        ('Employment', {'fields': ('employment_category', 'employment_status', 'employer_name', 'position', 'monthly_income')}),
        ('Membership', {'fields': ('membership_type', 'membership_status', 'fixed_deposit', 'subscribed_shares', 'paid_shares', 'member_since')}),
        ('Timestamps', {'fields': ('profile_created_at', 'profile_updated_at'), 'classes': ('collapse',)}),
    )

    def get_full_name(self, obj):
        return f"{obj.firstname} {obj.lastname}"
    get_full_name.short_description = 'Full Name'

    @display(description='Account Status', label=True)
    def account_status_display(self, obj):
        if obj.account_status == 'approved':
            return 'Approved', 'success'
        elif obj.account_status == 'rejected':
            return 'Rejected', 'danger'
        return 'Pending', 'warning'

    def has_add_permission(self, request):
        return False


@admin.register(AdminUser)
class AdminUserAdmin(ModelAdmin):
    """Staff/admin user management."""

    list_display = ('email', 'get_full_name', 'employee_id', 'role', 'account_status_display', 'status', 'department')
    list_filter = ('role', 'status', 'account_status')
    search_fields = ('email', 'firstname', 'lastname', 'employee_id')
    readonly_fields = ('date_joined',)

    fieldsets = (
        (None, {'fields': ('email', 'employee_id', 'department')}),
        ('Personal Info', {'fields': ('firstname', 'lastname')}),
        ('Role & Status', {'fields': ('role', 'status', 'account_status')}),
        ('Permissions', {'fields': ('is_active', 'is_staff')}),
        ('Important dates', {'fields': ('last_login', 'date_joined')}),
    )

    def get_full_name(self, obj):
        return f"{obj.firstname} {obj.lastname}"
    get_full_name.short_description = 'Full Name'

    @display(description='Account Status', label=True)
    def account_status_display(self, obj):
        if obj.account_status == 'approved':
            return 'Approved', 'success'
        elif obj.account_status == 'rejected':
            return 'Rejected', 'danger'
        return 'Pending', 'warning'
