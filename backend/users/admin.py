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
from django.contrib.auth.forms import ReadOnlyPasswordHashField
from django.core.mail import send_mail
from django.urls import reverse
from django.utils.html import format_html
from django import forms
from django.conf import settings
from unfold.admin import ModelAdmin
from unfold.decorators import display
from unfold.contrib.filters.admin import RangeDateFilter
from .models import User, Role
from authentication.password_reset import generate_password_reset_link


class UserCreationForm(forms.ModelForm):
    """Form for creating new users in the admin panel."""

    class Meta:
        model = User
        fields = ('email', 'firstname', 'lastname', 'role', 'status')

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
    password = ReadOnlyPasswordHashField(
        label="Password",
        help_text=(
            "Raw passwords are not stored. "
            '<a href="../password/">Change password</a>.'
        ),
    )

    class Meta:
        model = User
        fields = ('email', 'password', 'firstname', 'lastname', 'role', 'status', 'is_active', 'is_staff')


@admin.register(User)
class UserAdmin(BaseUserAdmin, ModelAdmin):
    form = UserChangeForm
    add_form = UserCreationForm

    list_display = ('email', 'get_full_name', 'role', 'status', 'is_staff', 'date_joined')
    list_filter = ('role', 'status', 'is_staff', 'is_superuser', 'date_joined')

    fieldsets = (
        (None, {'fields': ('email', 'password')}),
        ('Personal Info', {'fields': ('firstname', 'lastname')}),
        ('Role & Status', {'fields': ('role', 'status')}),
        ('Permissions', {'fields': ('is_active', 'is_staff', 'is_superuser', 'groups', 'user_permissions')}),
        ('Important dates', {'fields': ('last_login', 'date_joined')}),
    )

    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': ('email', 'firstname', 'lastname', 'role', 'status'),
            'description': 'An invitation email will be sent to the user to set their password.'
        }),
    )

    search_fields = ('email', 'firstname', 'lastname')
    ordering = ('-date_joined',)
    filter_horizontal = ('groups', 'user_permissions',)
    readonly_fields = ('last_login', 'date_joined')

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

    actions = ['resend_invitation', 'activate_users', 'suspend_users', 'send_test_email']

    def resend_invitation(self, request, queryset):
        """Admin action to resend invitation emails."""
        for user in queryset:
            if not user.has_usable_password():
                form = UserCreationForm(instance=user)
                form.send_invitation_email(user)
        self.message_user(request, f"Invitation emails sent to {queryset.count()} user(s).")
    resend_invitation.short_description = "Resend invitation email"

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

    def send_test_email(self, request, queryset):
        """Send test email to verify email configuration."""
        print("\n" + "="*80)
        print("📧 SENDING TEST EMAIL")
        print("="*80)
        print("This is a test to verify your email configuration.")
        print("="*80 + "\n")

        try:
            send_mail(
                'Test Email from eLoan System',
                'This is a test email. If you see this in your terminal, email configuration is working!',
                settings.DEFAULT_FROM_EMAIL,
                ['test@example.com'],
                fail_silently=False,
            )
            print("✅ Test email sent successfully! Check console output above.\n")
            self.message_user(
                request,
                "Test email sent! Check your Django terminal/console for the email output.",
                level='SUCCESS'
            )
        except Exception as e:
            print(f"❌ Test email failed: {str(e)}\n")
            self.message_user(
                request,
                f"Test email failed: {str(e)}. Check console for details.",
                level='ERROR'
            )
    send_test_email.short_description = "📧 Send test email (check console)"


@admin.register(Role)
class RoleAdmin(ModelAdmin):
    list_display = ('name', 'user_count')
    search_fields = ('name',)

    def user_count(self, obj):
        return obj.user_set.count()
    user_count.short_description = 'Number of Users'
