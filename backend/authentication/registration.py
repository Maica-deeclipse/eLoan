import secrets
import string
import logging

from google.oauth2 import id_token
from google.auth.transport import requests as google_requests

from rest_framework import serializers
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.conf import settings
from users.models import User, Role, Applicant, AdminUser
from applicant.throttles import RegistrationRateThrottle, LoginRateThrottle
from applicant.utils import get_client_ip, verify_recaptcha

security_log = logging.getLogger('security')

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

    def validate_password(self, value):
        errors = []
        if not any(c.isupper() for c in value):
            errors.append('one uppercase letter')
        if not any(c.islower() for c in value):
            errors.append('one lowercase letter')
        if not any(c.isdigit() for c in value):
            errors.append('one number')
        if not any(c in '!@#$%^&*()_+-=[]{}|;:,.<>?/' for c in value):
            errors.append('one special character (!@#$%^&* etc.)')
        if errors:
            raise serializers.ValidationError(
                f'Password must contain at least: {", ".join(errors)}.'
            )
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
    throttle_classes = [RegistrationRateThrottle]

    def post(self, request):
        ip = get_client_ip(request)
        captcha_ok, captcha_err = verify_recaptcha(request.data.get('captcha_token', ''), ip)
        if not captcha_ok:
            return Response({'error': captcha_err}, status=status.HTTP_400_BAD_REQUEST)

        serializer = StaffRegistrationSerializer(data=request.data)
        if serializer.is_valid():
            admin_user = serializer.save()
            security_log.info(f"REGISTRATION_SUCCESS email={admin_user.email} role={admin_user.role.name} method=password ip={ip}")
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
        security_log.warning(f"REGISTRATION_FAILED email={request.data.get('email', 'unknown')} ip={ip}")
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class StaffGoogleRegistrationView(APIView):
    """
    POST /api/auth/staff/register/google/

    Register a new staff account via Google OAuth.
    Verifies the Google token, extracts name + email, then creates a
    pending staff account. Employee ID and role must still be provided.

    Request body:
        { "id_token": "...", "role": "Bookkeeper", "employee_id": "EMP-001" }
    """
    permission_classes = []
    throttle_classes = [RegistrationRateThrottle]

    def post(self, request):
        token = request.data.get('id_token')
        role_name = request.data.get('role', '').strip()
        employee_id = request.data.get('employee_id', '').strip()

        if not token:
            return Response({'error': 'id_token is required.'}, status=status.HTTP_400_BAD_REQUEST)
        if not role_name:
            return Response({'error': 'role is required.'}, status=status.HTTP_400_BAD_REQUEST)
        if not employee_id:
            return Response({'error': 'employee_id is required.'}, status=status.HTTP_400_BAD_REQUEST)
        if role_name not in STAFF_ROLES:
            return Response({'error': f'Invalid role. Must be one of: {", ".join(STAFF_ROLES)}.'}, status=status.HTTP_400_BAD_REQUEST)

        ip = get_client_ip(request)

        # Cryptographically verify the Google ID token (signature, expiry, audience)
        try:
            id_info = id_token.verify_oauth2_token(
                token,
                google_requests.Request(),
                settings.GOOGLE_CLIENT_ID,
                clock_skew_in_seconds=10,
            )
        except ValueError:
            security_log.warning(f"GOOGLE_TOKEN_INVALID ip={ip} view=StaffGoogleRegistrationView")
            return Response({'error': 'Invalid or expired Google token.'}, status=status.HTTP_401_UNAUTHORIZED)

        email = id_info.get('email', '').lower().strip()
        email_verified = id_info.get('email_verified', False)

        if not email_verified:
            return Response({'error': 'Google email is not verified.'}, status=status.HTTP_403_FORBIDDEN)
        if not email:
            return Response({'error': 'Could not retrieve email from Google account.'}, status=status.HTTP_400_BAD_REQUEST)

        existing = User.objects.filter(email=email).first()
        if existing:
            return Response(
                {'error': 'An account with this email already exists. Please log in instead.'},
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
            return Response({'error': f'Role "{role_name}" not found.'}, status=status.HTTP_400_BAD_REQUEST)

        firstname = id_info.get('given_name', '') or email.split('@')[0]
        lastname = id_info.get('family_name', '') or ''

        # Generate secure random password — user authenticates via Google, not password
        random_password = ''.join(
            secrets.choice(string.ascii_letters + string.digits) for _ in range(48)
        )

        try:
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
        except Exception as e:
            return Response(
                {'error': f'Failed to create user account: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

        security_log.info(f"REGISTRATION_SUCCESS email={user.email} role={user.role.name} method=google ip={ip}")
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
    """Serializer for applicant self-registration — validates account credentials only."""
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, min_length=8)
    confirm_password = serializers.CharField(write_only=True)
    firstname = serializers.CharField(max_length=50)
    lastname = serializers.CharField(max_length=50)

    def validate(self, data):
        if data['password'] != data['confirm_password']:
            raise serializers.ValidationError({'confirm_password': 'Passwords do not match.'})
        return data

    def validate_email(self, value):
        """Validate BukSU domain and check uniqueness.

        Accepted domains (production):
          - @buksu.edu.ph          (faculty / staff)
          - @student.buksu.edu.ph  (students)
          - +alias variants of the above (e.g. you+test1@student.buksu.edu.ph)

        In DEBUG mode any email domain is accepted to ease testing.
        """
        from django.conf import settings
        value = value.lower().strip()
        if not settings.DEBUG and not value.endswith('buksu.edu.ph'):
            raise serializers.ValidationError(
                'Only @buksu.edu.ph or @student.buksu.edu.ph email addresses are allowed to register.'
            )
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError('An account with this email already exists.')
        return value

    def create(self, validated_data):
        """Create a new applicant user with pending status."""
        validated_data.pop('confirm_password', None)
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
    throttle_classes = [RegistrationRateThrottle]

    def post(self, request):
        import json
        from decimal import Decimal
        from applicant.models import ApplicantBeneficiary

        ip = get_client_ip(request)

        serializer = ApplicantRegistrationSerializer(data=request.data)
        if not serializer.is_valid():
            security_log.warning(f"REGISTRATION_FAILED email={request.data.get('email', 'unknown')} role=Applicant ip={ip}")
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
            'office', 'position', 'father_name', 'father_occupation', 'father_contact',
            'mother_name', 'mother_occupation', 'mother_contact',
            'emergency_contact_name', 'emergency_contact_number', 'emergency_contact_relationship',
        ]
        for field in str_fields:
            val = request.data.get(field, '').strip()
            if val:
                setattr(applicant, field, val)

        # Date of birth (validate format: YYYY-MM-DD)
        dob = request.data.get('date_of_birth', '').strip()
        if dob:
            from datetime import datetime
            try:
                datetime.strptime(dob, '%Y-%m-%d')
                applicant.date_of_birth = dob
            except ValueError:
                pass

        # Years employed
        years_employed = request.data.get('years_employed', '').strip()
        if years_employed:
            try:
                applicant.years_employed = int(years_employed)
            except Exception:
                pass

        # Monthly income
        income = request.data.get('monthly_income', '').strip()
        if income:
            try:
                applicant.monthly_income = Decimal(income)
            except Exception:
                pass

        # Net take-home pay
        net_pay = request.data.get('net_take_home_pay', '').strip()
        if net_pay:
            try:
                applicant.net_take_home_pay = Decimal(net_pay)
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
            from datetime import datetime
            beneficiaries = json.loads(beneficiaries_raw)
            for b in beneficiaries:
                name = b.get('name', '').strip()
                if not name:
                    continue
                # Validate beneficiary date_of_birth
                beneficiary_dob = b.get('date_of_birth', '').strip() if isinstance(b.get('date_of_birth'), str) else None
                beneficiary_dob_parsed = None
                if beneficiary_dob:
                    try:
                        datetime.strptime(beneficiary_dob, '%Y-%m-%d')
                        beneficiary_dob_parsed = beneficiary_dob
                    except ValueError:
                        pass
                
                ApplicantBeneficiary.objects.create(
                    profile=applicant,
                    name=name,
                    relationship=b.get('relationship', ''),
                    date_of_birth=beneficiary_dob_parsed,
                    contact_number=b.get('contact_number', ''),
                )
        except (json.JSONDecodeError, Exception):
            pass

        security_log.info(f"REGISTRATION_SUCCESS email={applicant.email} role=Applicant ip={ip}")
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
