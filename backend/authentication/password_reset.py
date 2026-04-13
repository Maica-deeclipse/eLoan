import logging

from django.contrib.auth.tokens import PasswordResetTokenGenerator
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from django.utils.encoding import force_bytes, force_str
from django.core.mail import send_mail
from django.conf import settings
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework import serializers
from users.models import User
from applicant.throttles import PasswordResetThrottle
from applicant.utils import get_client_ip

security_log = logging.getLogger('security')


class PasswordResetTokenSerializer(serializers.Serializer):
    """Serializer for validating password reset tokens and setting new passwords."""
    uid = serializers.CharField()
    token = serializers.CharField()
    new_password = serializers.CharField(min_length=8, write_only=True)
    confirm_password = serializers.CharField(min_length=8, write_only=True)

    def validate(self, data):
        """Validate that passwords match and token is valid."""
        if data['new_password'] != data['confirm_password']:
            raise serializers.ValidationError({
                'confirm_password': 'Passwords do not match.'
            })

        # Decode user ID
        try:
            uid = force_str(urlsafe_base64_decode(data['uid']))
            user = User.objects.get(pk=uid)
        except (TypeError, ValueError, OverflowError, User.DoesNotExist):
            raise serializers.ValidationError({
                'uid': 'Invalid user ID.'
            })

        # Validate token
        token_generator = PasswordResetTokenGenerator()
        if not token_generator.check_token(user, data['token']):
            raise serializers.ValidationError({
                'token': 'Invalid or expired token.'
            })

        data['user'] = user
        return data

    def save(self):
        """Set the new password for the user."""
        user = self.validated_data['user']
        user.set_password(self.validated_data['new_password'])
        user.is_active = True
        user.status = 'active'
        user.save()
        return user


class SetPasswordView(APIView):
    """
    API endpoint for setting password using a reset token.
    This is used when users receive an invitation email.
    """
    permission_classes = []  # No authentication required

    def post(self, request):
        serializer = PasswordResetTokenSerializer(data=request.data)
        ip = get_client_ip(request)

        if serializer.is_valid():
            user = serializer.save()
            security_log.info(f"PASSWORD_SET_SUCCESS email={user.email} ip={ip}")
            return Response({
                'message': 'Password set successfully. You can now log in.',
                'email': user.email
            }, status=status.HTTP_200_OK)

        security_log.warning(f"PASSWORD_SET_FAILED ip={ip}")
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class ValidateTokenView(APIView):
    """
    API endpoint to validate if a password reset token is still valid.
    This allows the frontend to show appropriate messages before the user fills the form.
    """
    permission_classes = []  # No authentication required

    def post(self, request):
        uid = request.data.get('uid')
        token = request.data.get('token')

        if not uid or not token:
            return Response({
                'valid': False,
                'message': 'Missing UID or token.'
            }, status=status.HTTP_400_BAD_REQUEST)

        try:
            user_id = force_str(urlsafe_base64_decode(uid))
            user = User.objects.get(pk=user_id)
        except (TypeError, ValueError, OverflowError, User.DoesNotExist):
            return Response({
                'valid': False,
                'message': 'Invalid link.'
            }, status=status.HTTP_400_BAD_REQUEST)

        token_generator = PasswordResetTokenGenerator()
        if token_generator.check_token(user, token):
            return Response({
                'valid': True,
                'email': user.email,
                'firstname': user.firstname,
                'lastname': user.lastname
            }, status=status.HTTP_200_OK)

        return Response({
            'valid': False,
            'message': 'This link has expired or is invalid.'
        }, status=status.HTTP_400_BAD_REQUEST)


def generate_password_reset_link(user, frontend_url='http://localhost:3000'):
    """
    Generate a secure password reset link for a user.

    Args:
        user: User instance
        frontend_url: Base URL of the frontend application

    Returns:
        str: Complete password reset URL with token
    """
    token_generator = PasswordResetTokenGenerator()
    token = token_generator.make_token(user)
    uid = urlsafe_base64_encode(force_bytes(user.pk))

    reset_link = f"{frontend_url}/set-password/{uid}/{token}"
    return reset_link


class ForgotPasswordView(APIView):
    """
    API endpoint for requesting a password reset link.
    Used when staff members click "Forgot Password?" on the login page.
    """
    permission_classes = []
    throttle_classes = [PasswordResetThrottle]

    def post(self, request):
        email = request.data.get('email')
        ip = get_client_ip(request)

        if not email:
            return Response({
                'error': 'Email is required.'
            }, status=status.HTTP_400_BAD_REQUEST)

        try:
            user = User.objects.get(email=email)

            # Check if user is super admin or has an authorized role (staff or applicant)
            is_authorized = (
                user.is_superuser or
                (user.role and user.role.name in ['Bookkeeper', 'Treasurer', 'Credit Committee', 'Account Member Officer', 'Applicant'])
            )

            if is_authorized:
                # Generate password reset link
                reset_link = generate_password_reset_link(user, frontend_url=settings.FRONTEND_URL)

                # Determine user role for email
                user_role = 'Super Administrator' if user.is_superuser else user.role.name

                # Send password reset email
                subject = 'eLoan - Password Reset Request'
                message = f"""
Hello {user.firstname} {user.lastname},

We received a request to reset your password for your eLoan account ({user_role}).

Please click the link below to reset your password:
{reset_link}

This link will expire after a certain period for security reasons.

If you did not request a password reset, please ignore this email and your password will remain unchanged.

Best regards,
eLoan Admin Team
                """

                try:
                    send_mail(
                        subject,
                        message,
                        settings.DEFAULT_FROM_EMAIL,
                        [user.email],
                        fail_silently=False,
                    )

                    security_log.info(f"PASSWORD_RESET_SENT email={user.email} ip={ip}")
                    return Response({
                        'message': 'Password reset link has been sent to your email.'
                    }, status=status.HTTP_200_OK)

                except Exception as e:
                    security_log.error(f"PASSWORD_RESET_EMAIL_FAILED email={user.email} ip={ip}")
                    return Response({
                        'error': 'Failed to send email. Please try again later.'
                    }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            else:
                # User exists but doesn't have authorized role
                # Return generic message for security (don't reveal user exists)
                return Response({
                    'message': 'If an account exists with this email, a password reset link will be sent.'
                }, status=status.HTTP_200_OK)

        except User.DoesNotExist:
            # Return generic message for security (don't reveal if user exists or not)
            return Response({
                'message': 'If an account exists with this email, a password reset link will be sent.'
            }, status=status.HTTP_200_OK)