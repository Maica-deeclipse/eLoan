import secrets
import string
import requests

from rest_framework import serializers
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from users.models import User, Role, Applicant, AdminUser

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

        admin_user = AdminUser.objects.create_user(
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
        return admin_user


class StaffRegistrationView(APIView):
    """
    Public endpoint for staff self-registration.
    Creates account with 'pending' status — requires Super Admin approval to login.
    """
    permission_classes = []

    def post(self, request):
        serializer = StaffRegistrationSerializer(data=request.data)
        if serializer.is_valid():
            admin_user = serializer.save()
            return Response({
                'message': 'Registration submitted. Your account is pending Super Admin approval.',
                'user': {
                    'id': admin_user.id,
                    'email': admin_user.email,
                    'firstname': admin_user.firstname,
                    'lastname': admin_user.lastname,
                    'role': admin_user.role.name,
                    'account_status': admin_user.account_status,
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

        existing = User.objects.select_related('role').filter(email=email).first()
        if existing:
            role_info = f" as '{existing.role.name}'" if existing.role else ""
            return Response(
                {'error': f"An account with this email already exists{role_info}. Please log in instead."},
                status=status.HTTP_400_BAD_REQUEST
            )

        if AdminUser.objects.filter(employee_id=employee_id).exists():
            return Response(
                {'error': f"Employee ID '{employee_id}' is already registered. Please use a different Employee ID."},
                status=status.HTTP_400_BAD_REQUEST
            )

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

        admin_user = AdminUser.objects.create_user(
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
                'id': admin_user.id,
                'email': admin_user.email,
                'firstname': admin_user.firstname,
                'lastname': admin_user.lastname,
                'role': admin_user.role.name,
                'account_status': admin_user.account_status,
            }
        }, status=status.HTTP_201_CREATED)


class ApplicantRegistrationSerializer(serializers.Serializer):
    """Serializer for applicant self-registration — validates account credentials only."""
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

        applicant = Applicant.objects.create_user(
            email=validated_data['email'],
            password=validated_data['password'],
            firstname=validated_data['firstname'],
            lastname=validated_data['lastname'],
            role=applicant_role,
            account_status='pending',
            status='active',
        )
        return applicant


class ApplicantRegistrationView(APIView):
    """
    Public endpoint for applicant self-registration.
    Accepts multipart/form-data with full profile fields + file uploads.
    Creates account with 'pending' status — AMO reviews and approves/rejects.
    """
    permission_classes = []

    def post(self, request):
        import json
        from decimal import Decimal
        from applicant.models import ApplicantBeneficiary

        serializer = ApplicantRegistrationSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        applicant = serializer.save()

        # Set profile fields directly on the Applicant instance
        str_fields = [
            'middle_name', 'gender', 'citizenship', 'civil_status', 'spouse_name',
            'contact_number', 'tin', 'sss_number', 'highest_education',
            'address_line1', 'address_line2', 'city', 'province', 'zip_code',
            'permanent_address_line1', 'permanent_address_barangay',
            'permanent_city', 'permanent_province', 'permanent_zip_code',
            'buksu_id_number', 'employment_category', 'employment_status',
            'office', 'father_name', 'father_occupation', 'father_contact',
            'mother_name', 'mother_occupation', 'mother_contact',
            'emergency_contact_name', 'emergency_contact_number', 'emergency_contact_relationship',
        ]
        for field in str_fields:
            val = request.data.get(field, '').strip()
            if val:
                setattr(applicant, field, val)

        # Date of birth
        dob = request.data.get('date_of_birth', '').strip()
        if dob:
            applicant.date_of_birth = dob

        # Monthly income
        income = request.data.get('monthly_income', '').strip()
        if income:
            try:
                applicant.monthly_income = Decimal(income)
            except Exception:
                pass

        # File uploads
        if 'id_photo' in request.FILES:
            applicant.id_photo = request.FILES['id_photo']
        if 'payslip' in request.FILES:
            applicant.payslip = request.FILES['payslip']
        if 'coe_document' in request.FILES:
            applicant.coe_document = request.FILES['coe_document']

        applicant.save()

        # Beneficiaries (sent as JSON string)
        beneficiaries_raw = request.data.get('beneficiaries', '[]')
        try:
            beneficiaries = json.loads(beneficiaries_raw)
            for b in beneficiaries:
                name = b.get('name', '').strip()
                if not name:
                    continue
                ApplicantBeneficiary.objects.create(
                    profile=applicant,
                    name=name,
                    relationship=b.get('relationship', ''),
                    date_of_birth=b.get('date_of_birth') or None,
                    contact_number=b.get('contact_number', ''),
                )
        except (json.JSONDecodeError, Exception):
            pass

        return Response({
            'message': 'Registration successful. Your account is pending approval by the Account Member Officer.',
            'user': {
                'id': applicant.id,
                'email': applicant.email,
                'firstname': applicant.firstname,
                'lastname': applicant.lastname,
                'account_status': applicant.account_status,
            }
        }, status=status.HTTP_201_CREATED)
