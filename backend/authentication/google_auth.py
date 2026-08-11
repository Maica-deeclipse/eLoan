"""
Google OAuth Authentication

- GoogleAuthView: For applicants. Verifies Google ID tokens, creates/logs in buksu.edu.ph users.
- StaffGoogleAuthView: For staff/admins. Verifies Google ID tokens, logs in existing staff accounts.
"""

import secrets
import string

from google.oauth2 import id_token
from google.auth.transport import requests as google_requests

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework_simplejwt.tokens import RefreshToken

from django.conf import settings
from django.core.mail import send_mail
from django.utils import timezone as _tz

from users.models import User, Role
from applicant.throttles import LoginRateThrottle
from applicant.utils import get_client_ip
import logging

security_log = logging.getLogger('security')

ALLOWED_EMAIL_DOMAIN = 'buksu.edu.ph'


def _verify_google_id_token(token):
    """
    Cryptographically verify a Google ID token.

    Checks: RSA signature, expiry, issuer (accounts.google.com),
    and audience (must match GOOGLE_CLIENT_ID — i.e. our app).

    Returns the decoded token payload dict on success,
    or raises ValueError if verification fails.
    """
    return id_token.verify_oauth2_token(
        token,
        google_requests.Request(),
        settings.GOOGLE_CLIENT_ID,
        clock_skew_in_seconds=10,
    )


class GoogleAuthView(APIView):
    """
    POST /api/auth/google/

    Authenticate or register an applicant via Google OAuth.
    Only buksu.edu.ph email addresses are allowed (verifies BukSU affiliation).

    Request body:
        { "id_token": "<google_oauth_id_token>" }

    Response:
        { "tokens": { "access": "...", "refresh": "..." }, "user": {...}, "is_new": bool }
    """
    permission_classes = []
    throttle_classes = [LoginRateThrottle]

    def post(self, request):
        token = request.data.get('id_token')
        if not token:
            return Response(
                {'error': 'id_token is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        ip = get_client_ip(request)
        try:
            id_info = _verify_google_id_token(token)
        except ValueError:
            security_log.warning(f"GOOGLE_TOKEN_INVALID ip={ip} view=GoogleAuthView")
            return Response(
                {'error': 'Invalid or expired Google token. Please sign in again.'},
                status=status.HTTP_401_UNAUTHORIZED
            )

        email = id_info.get('email', '')
        email_verified = id_info.get('email_verified', False)

        if not email_verified:
            security_log.warning(f"GOOGLE_EMAIL_UNVERIFIED email={email} ip={ip}")
            return Response(
                {'error': 'Google email is not verified.'},
                status=status.HTTP_403_FORBIDDEN
            )

        if not email.endswith(ALLOWED_EMAIL_DOMAIN):
            return Response(
                {
                    'error': (
                        f'Only {ALLOWED_EMAIL_DOMAIN} accounts are allowed. '
                        'Please use your BukSU institutional email.'
                    )
                },
                status=status.HTTP_403_FORBIDDEN
            )

        firstname = id_info.get('given_name', '') or email.split('@')[0]
        lastname = id_info.get('family_name', '') or ''
        picture = id_info.get('picture', '')

        is_new = False
        try:
            user = User.objects.get(email=email)

            # Block non-applicants — staff must use the web portal
            if user.role and user.role.name != 'Applicant':
                return Response(
                    {
                        'error': (
                            f"Your account is registered as '{user.role.name}'. "
                            'Please use the staff web portal to sign in.'
                        )
                    },
                    status=status.HTTP_403_FORBIDDEN
                )

            # Existing user — check account status
            if user.account_status == 'rejected':
                return Response(
                    {'error': 'Your registration was rejected. Please contact the administrator.'},
                    status=status.HTTP_403_FORBIDDEN
                )
            if user.account_status == 'pending':
                return Response(
                    {
                        'error': (
                            'Your account is pending approval. '
                            'Please wait for administrator confirmation.'
                        ),
                        'account_status': 'pending',
                    },
                    status=status.HTTP_403_FORBIDDEN
                )

        except User.DoesNotExist:
            # New user — create applicant account
            # Google buksu.edu.ph login verifies BukSU affiliation.
            # Account still needs admin approval before loan applications.
            try:
                applicant_role = Role.objects.get(name='Applicant')
            except Role.DoesNotExist:
                return Response(
                    {'error': 'System error: Applicant role not found.'},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )

            # Generate a secure random password (user authenticates via Google, not password)
            random_password = ''.join(
                secrets.choice(string.ascii_letters + string.digits)
                for _ in range(48)
            )

            user = User.objects.create_user(
                email=email,
                password=random_password,
                firstname=firstname,
                lastname=lastname,
                role=applicant_role,
                account_status='pending',
                status='active',
            )
            is_new = True

            # Send security notification email to the registered address
            try:
                timestamp = _tz.now().strftime('%B %d, %Y at %I:%M %p UTC')
                send_mail(
                    subject='eLoan Account Registration Notification',
                    message=(
                        f'Hello {firstname},\n\n'
                        f'Your BukSU Google account ({email}) was used to create an eLoan account '
                        f'on {timestamp} from IP {ip}.\n\n'
                        f'Your account is currently pending administrator approval. '
                        f'You will be notified once it has been reviewed.\n\n'
                        f'If you did not perform this registration, please contact the system administrator immediately.\n\n'
                        f'— eLoan System'
                    ),
                    from_email=settings.DEFAULT_FROM_EMAIL,
                    recipient_list=[email],
                    fail_silently=True,
                )
            except Exception:
                pass  # Email failure must never block account creation

            # Return pending status for new accounts
            return Response(
                {
                    'message': (
                        'Account created successfully! '
                        'Your account is pending admin approval. '
                        'You will be able to log in once approved.'
                    ),
                    'account_status': 'pending',
                    'is_new': True,
                    'user': {
                        'email': user.email,
                        'firstname': user.firstname,
                        'lastname': user.lastname,
                        'picture': picture,
                    }
                },
                status=status.HTTP_201_CREATED
            )

        # Active user — generate JWT tokens and log in
        security_log.info(f"LOGIN_SUCCESS email={user.email} role=Applicant method=google ip={ip}")
        refresh = RefreshToken.for_user(user)

        return Response(
            {
                'tokens': {
                    'access': str(refresh.access_token),
                    'refresh': str(refresh),
                },
                'user': {
                    'id': user.id,
                    'email': user.email,
                    'firstname': user.firstname,
                    'lastname': user.lastname,
                    'role': user.role.name if user.role else 'Applicant',
                    'account_status': user.account_status,
                    'picture': picture,
                },
                'is_new': is_new,
            },
            status=status.HTTP_200_OK
        )


class StaffGoogleAuthView(APIView):
    """
    POST /api/auth/google/staff/

    Authenticate an existing staff/admin user via Google OAuth.
    The user must already have a registered and approved account.
    No email domain restriction — staff may use any Google account
    that matches their registered email.

    Request body:
        { "id_token": "<google_oauth_id_token>" }

    Response:
        { "tokens": { "access": "...", "refresh": "..." }, "user": {...} }
    """
    permission_classes = []
    throttle_classes = [LoginRateThrottle]

    def post(self, request):
        token = request.data.get('id_token')
        if not token:
            return Response(
                {'error': 'id_token is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        ip = get_client_ip(request)
        try:
            id_info = _verify_google_id_token(token)
        except ValueError:
            security_log.warning(f"GOOGLE_TOKEN_INVALID ip={ip} view=StaffGoogleAuthView")
            return Response(
                {'error': 'Invalid or expired Google token. Please sign in again.'},
                status=status.HTTP_401_UNAUTHORIZED
            )

        email = id_info.get('email', '')
        email_verified = id_info.get('email_verified', False)
        picture = id_info.get('picture', '')

        if not email_verified:
            security_log.warning(f"GOOGLE_EMAIL_UNVERIFIED email={email} ip={ip}")
            return Response(
                {'error': 'Google email is not verified.'},
                status=status.HTTP_403_FORBIDDEN
            )

        # Optional: role sent from frontend for cross-role guard
        requested_role = request.data.get('role', '').strip()

        # Find the staff user by email
        try:
            user = User.objects.select_related('role').get(email=email)
        except User.DoesNotExist:
            return Response(
                {
                    'error': (
                        'No staff account found for this Google account. '
                        'Please register first or use a different email.'
                    )
                },
                status=status.HTTP_404_NOT_FOUND
            )

        # Reject applicants — they should use /api/auth/google/ instead
        if user.role and user.role.name == 'Applicant':
            return Response(
                {'error': 'This login is for staff only. Applicants should use the mobile app.'},
                status=status.HTTP_403_FORBIDDEN
            )

        # Block cross-role login: user already has a different role
        if requested_role and user.role and user.role.name != requested_role:
            return Response(
                {
                    'error': (
                        f"Your account is registered as '{user.role.name}'. "
                        f"Please select '{user.role.name}' on the role selection screen to sign in."
                    )
                },
                status=status.HTTP_403_FORBIDDEN
            )

        # Check account status
        if user.account_status == 'rejected':
            return Response(
                {'error': 'Your account has been rejected. Please contact the administrator.'},
                status=status.HTTP_403_FORBIDDEN
            )
        if user.account_status == 'pending':
            return Response(
                {
                    'error': (
                        'Your account is pending approval. '
                        'Please wait for the Super Administrator to approve your account.'
                    ),
                    'account_status': 'pending',
                },
                status=status.HTTP_403_FORBIDDEN
            )
        if not user.is_active or user.status == 'suspended':
            return Response(
                {'error': 'Your account has been suspended. Please contact the administrator.'},
                status=status.HTTP_403_FORBIDDEN
            )

        # Generate JWT tokens and log in
        security_log.info(
            f"LOGIN_SUCCESS email={user.email} role={user.role.name if user.role else 'unknown'} "
            f"method=google ip={get_client_ip(request)}"
        )
        refresh = RefreshToken.for_user(user)

        return Response(
            {
                'tokens': {
                    'access': str(refresh.access_token),
                    'refresh': str(refresh),
                },
                'user': {
                    'id': user.id,
                    'email': user.email,
                    'firstname': user.firstname,
                    'lastname': user.lastname,
                    'role': user.role.name if user.role else '',
                    'account_status': user.account_status,
                    'picture': picture,
                },
            },
            status=status.HTTP_200_OK
        )
