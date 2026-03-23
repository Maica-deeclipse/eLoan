import secrets
import string
import requests

from rest_framework import serializers
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from users.models import User, Role

STAFF_ROLES = ['Bookkeeper', 'Treasurer', 'Credit Committee', 'Account Member Officer']


class StaffRegistrationSerializer(serializers.Serializer):
    """Serializer for staff self-registration."""
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, min_length=8)
    firstname = serializers.CharField(max_length=50)
    lastname = serializers.CharField(max_length=50)
    role = serializers.ChoiceField(choices=[(r, r) for r in STAFF_ROLES])
    employee_id = serializers.CharField(max_length=50)

    def validate_email(self, value):
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError('An account with this email already exists.')
        return value

    def create(self, validated_data):
        role_name = validated_data['role']
        try:
            role = Role.objects.get(name=role_name)
        except Role.DoesNotExist:
            raise serializers.ValidationError({'error': f'Role "{role_name}" not found.'})

        user = User.objects.create_user(
            email=validated_data['email'],
            password=validated_data['password'],
            firstname=validated_data['firstname'],
            lastname=validated_data['lastname'],
            role=role,
            employee_id=validated_data['employee_id'],
            account_status='pending',
            status='active',
            is_staff=True,
        )
        return user


class StaffRegistrationView(APIView):
    """
    Public endpoint for staff self-registration.
    Creates account with 'pending' status — requires Super Admin approval to login.
    """
    permission_classes = []

    def post(self, request):
        serializer = StaffRegistrationSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save()
            return Response({
                'message': 'Registration submitted. Your account is pending Super Admin approval.',
                'user': {
                    'id': user.id,
                    'email': user.email,
                    'firstname': user.firstname,
                    'lastname': user.lastname,
                    'role': user.role.name,
                    'account_status': user.account_status,
                }
            }, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class StaffGoogleRegistrationView(APIView):
    """
    POST /api/auth/staff/register/google/

    Register a new staff account via Google OAuth.
    Verifies the Google token, extracts name + email, then creates a
    pending staff account. Employee ID and role must still be provided.

    Request body:
        { "access_token": "...", "role": "Bookkeeper", "employee_id": "EMP-001" }
    """
    permission_classes = []

    def post(self, request):
        access_token = request.data.get('access_token')
        role_name = request.data.get('role', '').strip()
        employee_id = request.data.get('employee_id', '').strip()

        if not access_token:
            return Response({'error': 'access_token is required.'}, status=status.HTTP_400_BAD_REQUEST)
        if not role_name:
            return Response({'error': 'role is required.'}, status=status.HTTP_400_BAD_REQUEST)
        if not employee_id:
            return Response({'error': 'employee_id is required.'}, status=status.HTTP_400_BAD_REQUEST)
        if role_name not in STAFF_ROLES:
            return Response({'error': f'Invalid role. Must be one of: {", ".join(STAFF_ROLES)}.'}, status=status.HTTP_400_BAD_REQUEST)

        # Verify token and get user info from Google
        try:
            google_response = requests.get(
                'https://www.googleapis.com/oauth2/v3/userinfo',
                headers={'Authorization': f'Bearer {access_token}'},
                timeout=10
            )
            if google_response.status_code != 200:
                return Response({'error': 'Invalid or expired Google token.'}, status=status.HTTP_401_UNAUTHORIZED)
            google_user = google_response.json()
        except requests.RequestException:
            return Response({'error': 'Failed to verify Google token. Check your connection.'}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        email = google_user.get('email', '').lower().strip()
        email_verified = google_user.get('email_verified', False)

        if not email_verified:
            return Response({'error': 'Google email is not verified.'}, status=status.HTTP_403_FORBIDDEN)
        if not email:
            return Response({'error': 'Could not retrieve email from Google account.'}, status=status.HTTP_400_BAD_REQUEST)

        if User.objects.filter(email=email).exists():
            return Response({'error': 'An account with this email already exists.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            role = Role.objects.get(name=role_name)
        except Role.DoesNotExist:
            return Response({'error': f'Role "{role_name}" not found.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        firstname = google_user.get('given_name', '') or email.split('@')[0]
        lastname = google_user.get('family_name', '') or ''

        # Generate secure random password — user authenticates via Google, not password
        random_password = ''.join(
            secrets.choice(string.ascii_letters + string.digits) for _ in range(48)
        )

        user = User.objects.create_user(
            email=email,
            password=random_password,
            firstname=firstname,
            lastname=lastname,
            role=role,
            employee_id=employee_id,
            account_status='pending',
            status='active',
            is_staff=True,
        )

        return Response({
            'message': 'Registration submitted. Your account is pending Super Admin approval.',
            'user': {
                'id': user.id,
                'email': user.email,
                'firstname': user.firstname,
                'lastname': user.lastname,
                'role': user.role.name,
                'account_status': user.account_status,
            }
        }, status=status.HTTP_201_CREATED)


class ApplicantRegistrationSerializer(serializers.Serializer):
    """Serializer for applicant self-registration."""
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, min_length=8)
    firstname = serializers.CharField(max_length=50)
    lastname = serializers.CharField(max_length=50)

    def validate_email(self, value):
        """Validate @buksu.edu.ph domain and check uniqueness."""
        value = value.lower().strip()
        if not value.endswith('@buksu.edu.ph'):
            raise serializers.ValidationError(
                'Only @buksu.edu.ph email addresses are allowed to register.'
            )
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError('An account with this email already exists.')
        return value

    def create(self, validated_data):
        """Create a new applicant user with pending status."""
        try:
            applicant_role = Role.objects.get(name='Applicant')
        except Role.DoesNotExist:
            raise serializers.ValidationError({
                'error': 'System configuration error: Applicant role not found.'
            })

        user = User.objects.create_user(
            email=validated_data['email'],
            password=validated_data['password'],
            firstname=validated_data['firstname'],
            lastname=validated_data['lastname'],
            role=applicant_role,
            account_status='pending',
            status='active'
        )
        return user


class ApplicantRegistrationView(APIView):
    """
    Public endpoint for applicant self-registration.
    Requires @buksu.edu.ph email. Creates account with 'pending' status.
    AMO reviews COE document and approves/rejects.
    """
    permission_classes = []

    def post(self, request):
        serializer = ApplicantRegistrationSerializer(data=request.data)

        if serializer.is_valid():
            user = serializer.save()

            # Save COE document and membership form if provided
            coe_document = request.FILES.get('coe_document')
            membership_form_file = request.FILES.get('membership_form')
            if coe_document or membership_form_file:
                from applicant.models import ApplicantProfile
                profile, _ = ApplicantProfile.objects.get_or_create(user=user)
                if coe_document:
                    profile.coe_document = coe_document
                if membership_form_file:
                    profile.membership_form = membership_form_file
                profile.save()

            return Response({
                'message': 'Registration successful. Your account is pending approval by the Account Member Officer.',
                'user': {
                    'id': user.id,
                    'email': user.email,
                    'firstname': user.firstname,
                    'lastname': user.lastname,
                    'account_status': user.account_status,
                }
            }, status=status.HTTP_201_CREATED)

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
