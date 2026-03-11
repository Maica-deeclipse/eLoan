from rest_framework import serializers
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from users.models import User, Role


class ApplicantRegistrationSerializer(serializers.Serializer):
    """Serializer for applicant self-registration."""
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, min_length=8)
    firstname = serializers.CharField(max_length=50)
    lastname = serializers.CharField(max_length=50)

    def validate_email(self, value):
        """Check if email is already registered."""
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError('An account with this email already exists.')
        return value

    def create(self, validated_data):
        """Create a new applicant user with pending status."""
        try:
            # Get the Applicant role
            applicant_role = Role.objects.get(name='Applicant')
        except Role.DoesNotExist:
            raise serializers.ValidationError({
                'error': 'System configuration error: Applicant role not found.'
            })

        # Create user with pending account status
        user = User.objects.create_user(
            email=validated_data['email'],
            password=validated_data['password'],
            firstname=validated_data['firstname'],
            lastname=validated_data['lastname'],
            role=applicant_role,
            account_status='pending',  # Requires admin approval
            status='active'  # Active but account_status is pending
        )
        return user


class ApplicantRegistrationView(APIView):
    """
    Public endpoint for applicant self-registration.
    Creates a new account with 'pending' status that requires Super Admin approval.
    """
    permission_classes = []  # No authentication required

    def post(self, request):
        serializer = ApplicantRegistrationSerializer(data=request.data)

        if serializer.is_valid():
            user = serializer.save()

            return Response({
                'message': 'Registration successful. Your account is pending approval.',
                'user': {
                    'id': user.id,
                    'email': user.email,
                    'firstname': user.firstname,
                    'lastname': user.lastname,
                    'account_status': user.account_status,
                }
            }, status=status.HTTP_201_CREATED)

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
