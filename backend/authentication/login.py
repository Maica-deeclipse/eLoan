from rest_framework import serializers
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import authenticate
from users.models import User


class StaffLoginSerializer(serializers.Serializer):
    """Serializer for staff login with role validation."""
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)
    role = serializers.CharField()

    def validate(self, data):
        email = data.get('email')
        password = data.get('password')
        selected_role = data.get('role')

        if not email or not password:
            raise serializers.ValidationError('Email and password are required.')

        if not selected_role:
            raise serializers.ValidationError({
                'error': 'Please select your role.'
            })

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

        # Validate that user has an authorized staff role
        authorized_roles = ['Bookkeeper', 'Treasurer', 'Credit Committee']

        if user.is_superuser:
            # Super admin must select "Super Administrator"
            if selected_role != 'Super Administrator':
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

        if user.role.name not in authorized_roles:
            raise serializers.ValidationError({
                'error': 'You do not have permission to access this system.'
            })

        # Validate that selected role matches assigned role
        if user.role.name != selected_role:
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
    permission_classes = []  # No authentication required

    def post(self, request):
        serializer = StaffLoginSerializer(data=request.data)

        if serializer.is_valid():
            user = serializer.validated_data['user']
            role = serializer.validated_data['role']

            # Generate JWT tokens
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

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


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
                'error': 'Invalid email or password.'
            })

        data['user'] = user
        return data


class ApplicantLoginView(APIView):
    """
    Custom login endpoint for applicants (mobile app).
    Validates that only users with 'Applicant' role can log in.
    Does not require role parameter (auto-validates against Applicant role).
    """
    permission_classes = []  # No authentication required

    def post(self, request):
        serializer = ApplicantLoginSerializer(data=request.data)

        if serializer.is_valid():
            user = serializer.validated_data['user']

            # Generate JWT tokens
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

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
