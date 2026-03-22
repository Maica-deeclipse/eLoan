"""
Membership Appeal Submission Endpoint.
Allows rejected applicants to submit an appeal for their membership.
"""
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework_simplejwt.authentication import JWTAuthentication

from account_member_officer.services import AppealService
from users.models import User


class SubmitAppealView(APIView):
    """
    Authenticated endpoint for rejected applicants to submit a membership appeal.
    The Account Member Officer will review and decide on the appeal.
    """
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user

        if user.account_status != 'rejected':
            return Response(
                {'error': 'Only rejected applicants can submit an appeal.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        reason = request.data.get('reason', '').strip()
        if not reason:
            return Response(
                {'error': 'Appeal reason is required.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            appeal = AppealService.submit_appeal(user_id=user.id, reason=reason)
        except User.DoesNotExist:
            return Response({'error': 'User not found.'}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

        return Response({
            'message': 'Appeal submitted successfully. The Account Member Officer will review your appeal.',
            'appeal_id': appeal.id,
            'status': appeal.status,
            'submitted_at': appeal.submitted_at.isoformat(),
        }, status=status.HTTP_201_CREATED)

    def get(self, request):
        """Get current user's appeal status."""
        user = request.user
        try:
            appeal = user.membership_appeal
            return Response({
                'appeal_id': appeal.id,
                'reason': appeal.reason,
                'status': appeal.status,
                'submitted_at': appeal.submitted_at.isoformat(),
                'reviewed_at': appeal.reviewed_at.isoformat() if appeal.reviewed_at else None,
                'review_notes': appeal.review_notes,
            })
        except Exception:
            return Response({'appeal': None, 'message': 'No appeal found.'})
