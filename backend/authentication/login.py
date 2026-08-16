import logging

from rest_framework import serializers
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import authenticate
from users.models import User
from applicant.throttles import LoginRateThrottle
from applicant.utils import get_client_ip, verify_recaptcha

security_log = logging.getLogger('security')
auth_log = logging.getLogger(__name__)


class StaffLoginSerializer(serializers.Serializer):
    """Serializer for staff login using the user's assigned role."""
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)
    role = serializers.CharField(required=False, allow_blank=True)

    def validate(self, data):
        email = data.get('email')
        password = data.get('password')
        selected_role = data.get('role', '')

        if not email or not password:
            raise serializers.ValidationError('Email and password are required.')

        # Authenticate user
        user = authenticate(username=email, password=password)

        if not user:
            raise serializers.ValidationError({
                'error': 'Invalid credentials or role mismatch.'
            })

        # Check if user account is active
        if not user.is_active or user.status != 'active':
            raise serializers.ValidationError({
                'error': 'Your account has been suspended. Please contact the administrator.'
            })

        # Check account_status for self-registered staff (pending approval / rejected)
        if not user.is_superuser:
            if user.account_status == 'pending':
                raise serializers.ValidationError({
                    'error': 'Your account is pending Super Admin approval. Please wait for verification.'
                })
            if user.account_status == 'rejected':
                raise serializers.ValidationError({
                    'error': 'Your registration was rejected. Please contact the administrator.'
                })

        # Validate that user has an authorized staff role
        authorized_roles = ['Bookkeeper', 'Treasurer', 'Credit Committee', 'Account Member Officer']

        if user.is_superuser:
            if selected_role and selected_role != 'Super Administrator':
                raise serializers.ValidationError({
                    'error': 'Invalid credentials or role mismatch.'
                })
            data['user'] = user
            data['role'] = 'Super Administrator'
            return data

        if not user.role:
            raise serializers.ValidationError({
                'error': 'You do not have permission to access this system.'
            })

        if user.role.name == 'Applicant':
            raise serializers.ValidationError({
                'error': 'Applicant accounts must sign in through the applicant app.'
            })

        if user.role.name not in authorized_roles:
            raise serializers.ValidationError({
                'error': 'You do not have permission to access this system.'
            })

        # If an older client still sends a role, keep validating it.
        if selected_role and user.role.name != selected_role:
            raise serializers.ValidationError({
                'error': 'Invalid credentials or role mismatch.'
            })

        data['user'] = user
        data['role'] = user.role.name
        return data


class StaffLoginView(APIView):
    """
    Custom login endpoint for staff members.
    Validates that only users with authorized roles can log in:
    - Bookkeeper
    - Treasurer
    - Credit Committee
    - Super Administrator
    """
    permission_classes = []
    throttle_classes = [LoginRateThrottle]

    def post(self, request):
        ip = get_client_ip(request)
        captcha_ok, captcha_err = verify_recaptcha(request.data.get('captcha_token', ''), ip)
        if not captcha_ok:
            return Response({'error': captcha_err}, status=status.HTTP_400_BAD_REQUEST)

        serializer = StaffLoginSerializer(data=request.data)

        if serializer.is_valid():
            user = serializer.validated_data['user']
            role = serializer.validated_data['role']
            security_log.info(f"LOGIN_SUCCESS email={user.email} role={role} ip={ip}")

            refresh = RefreshToken.for_user(user)

            return Response({
                'message': 'Login successful.',
                'user': {
                    'id': user.id,
                    'email': user.email,
                    'firstname': user.firstname,
                    'lastname': user.lastname,
                    'role': role,
                    'status': user.status,
                },
                'tokens': {
                    'refresh': str(refresh),
                    'access': str(refresh.access_token),
                }
            }, status=status.HTTP_200_OK)

        email = request.data.get('email', 'unknown')
        security_log.warning(f"LOGIN_FAILED email={email} ip={ip}")
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class SuperAdminLoginView(APIView):
    """
    POST /api/auth/superadmin/login/

    Dedicated login endpoint for superusers only.
    Checks is_superuser=True — no role parameter required.
    Always returns role as 'Super Administrator'.
    """
    permission_classes = []
    throttle_classes = [LoginRateThrottle]

    def post(self, request):
        email = request.data.get('email', '').strip()
        password = request.data.get('password', '')
        ip = get_client_ip(request)

        captcha_ok, captcha_err = verify_recaptcha(request.data.get('captcha_token', ''), ip)
        if not captcha_ok:
            return Response({'error': captcha_err}, status=status.HTTP_400_BAD_REQUEST)

        if not email or not password:
            return Response(
                {'error': 'Email and password are required.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        user = authenticate(username=email, password=password)

        if not user:
            security_log.warning(f"LOGIN_FAILED email={email} role=SuperAdmin ip={ip}")
            return Response(
                {'error': 'Invalid credentials.'},
                status=status.HTTP_401_UNAUTHORIZED
            )

        if not user.is_superuser:
            return Response(
                {'error': 'Access denied.'},
                status=status.HTTP_403_FORBIDDEN
            )

        if not user.is_active or user.status != 'active':
            return Response(
                {'error': 'Your account has been suspended. Please contact support.'},
                status=status.HTTP_403_FORBIDDEN
            )

        security_log.info(f"LOGIN_SUCCESS email={user.email} role=SuperAdmin ip={ip}")
        refresh = RefreshToken.for_user(user)

        return Response({
            'message': 'Login successful.',
            'user': {
                'id': user.id,
                'email': user.email,
                'firstname': user.firstname,
                'lastname': user.lastname,
                'role': 'Super Administrator',
                'status': user.status,
            },
            'tokens': {
                'refresh': str(refresh),
                'access': str(refresh.access_token),
            }
        }, status=status.HTTP_200_OK)


class ApplicantLoginSerializer(serializers.Serializer):
    """Serializer for applicant login (no role parameter required)."""
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)

    def validate(self, data):
        email = data.get('email')
        password = data.get('password')

        if not email or not password:
            raise serializers.ValidationError('Email and password are required.')

        # Authenticate user
        user = authenticate(username=email, password=password)

        if not user:
            raise serializers.ValidationError({
                'error': 'Invalid email or password.'
            })

        # Check if user account is active
        if not user.is_active or user.status != 'active':
            raise serializers.ValidationError({
                'error': 'Your account has been suspended. Please contact the administrator.'
            })

        # Check account_status for pending/rejected users
        if user.account_status == 'pending':
            raise serializers.ValidationError({
                'error': 'Your account is pending approval. Please wait for admin verification.'
            })

        if user.account_status == 'rejected':
            raise serializers.ValidationError({
                'error': 'Your registration was rejected. Please contact the administrator.'
            })

        # Validate that user has 'Applicant' role
        if not user.role or user.role.name != 'Applicant':
            raise serializers.ValidationError({
                'error': 'This account cannot log in through the applicant portal. Please use the appropriate login page.'
            })

        data['user'] = user
        return data


class ApplicantLoginView(APIView):
    """
    Custom login endpoint for applicants (mobile app).
    Validates that only users with 'Applicant' role can log in.
    Does not require role parameter (auto-validates against Applicant role).
    """
    permission_classes = []
    throttle_classes = [LoginRateThrottle]

    def post(self, request):
        ip = get_client_ip(request)
        email = request.data.get('email', 'unknown')

        auth_log.info(f"[APPLICANT_LOGIN] ▶ Attempt | email={email} ip={ip}")
        print(f"[APPLICANT_LOGIN] ▶ Attempt | email={email} ip={ip}")
        print(f"[APPLICANT_LOGIN]   payload keys: {list(request.data.keys())}")

        captcha_ok, captcha_err = verify_recaptcha(request.data.get('captcha_token', ''), ip)
        if not captcha_ok:
            print(f"[APPLICANT_LOGIN] ❌ CAPTCHA failed: {captcha_err}")
            return Response({'error': captcha_err}, status=status.HTTP_400_BAD_REQUEST)

        print(f"[APPLICANT_LOGIN]   CAPTCHA: OK (bypass={captcha_ok})")

        serializer = ApplicantLoginSerializer(data=request.data)

        if serializer.is_valid():
            user = serializer.validated_data['user']
            security_log.info(f"LOGIN_SUCCESS email={user.email} role=Applicant ip={ip}")
            auth_log.info(f"[APPLICANT_LOGIN] ✅ SUCCESS | email={user.email} status={user.status} account_status={user.account_status}")
            print(f"[APPLICANT_LOGIN] ✅ SUCCESS | email={user.email} status={user.status} account_status={user.account_status}")

            refresh = RefreshToken.for_user(user)

            return Response({
                'message': 'Login successful.',
                'user': {
                    'id': user.id,
                    'email': user.email,
                    'firstname': user.firstname,
                    'lastname': user.lastname,
                    'role': 'Applicant',
                    'status': user.status,
                },
                'tokens': {
                    'refresh': str(refresh),
                    'access': str(refresh.access_token),
                }
            }, status=status.HTTP_200_OK)

        auth_log.warning(f"[APPLICANT_LOGIN] ❌ FAILED | email={email} ip={ip} errors={serializer.errors}")
        print(f"[APPLICANT_LOGIN] ❌ FAILED | email={email}")
        print(f"[APPLICANT_LOGIN]   serializer errors: {serializer.errors}")

        # Try to give a hint about the likely cause for quick debugging
        raw_user = None
        try:
            from users.models import User as U
            raw_user = U.objects.filter(email=email).first()
            if raw_user:
                print(f"[APPLICANT_LOGIN]   DB user found: is_active={raw_user.is_active} status={raw_user.status} account_status={raw_user.account_status} role={getattr(raw_user.role, 'name', None)}")
            else:
                print(f"[APPLICANT_LOGIN]   No user found with email={email}")
        except Exception as e:
            print(f"[APPLICANT_LOGIN]   Could not inspect user: {e}")

        security_log.warning(f"LOGIN_FAILED email={email} role=Applicant ip={ip}")
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
