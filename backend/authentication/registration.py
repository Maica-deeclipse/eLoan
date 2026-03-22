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
