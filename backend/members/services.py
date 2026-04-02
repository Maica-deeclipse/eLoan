from decimal import Decimal
from django.db import transaction
from users.models import Applicant
from applicant.models import Savings, SharedCapital


class MembershipService:
    """
    Business logic for membership classification and loan eligibility.
    """

    ASSOCIATE_MAX_LOAN = Decimal('20000.00')
    REGULAR_THRESHOLD = Decimal('20000.00')
    MIN_SAVINGS = Decimal('200.00')

    @classmethod
    def calculate_membership_type(cls, shared_capital_total):
        """
        Determine membership type based on shared capital.

        Args:
            shared_capital_total: Decimal total of shared capital

        Returns:
            str: 'associate' or 'regular'
        """
        if shared_capital_total >= cls.REGULAR_THRESHOLD:
            return 'regular'
        return 'associate'

    @classmethod
    def get_max_loan_amount(cls, member, loan_type=None):
        """
        Get maximum loan amount for a member.

        Args:
            member: Member instance
            loan_type: LoanType instance (optional)

        Returns:
            Decimal: Maximum loan amount allowed
        """
        if member.membership_type == 'associate':
            # Associate members limited to 20,000 regardless of loan type
            if loan_type and loan_type.max_amount:
                return min(cls.ASSOCIATE_MAX_LOAN, loan_type.max_amount)
            return cls.ASSOCIATE_MAX_LOAN

        # Regular members use loan type config
        if loan_type:
            return loan_type.max_amount
        return None

    @classmethod
    def check_loan_eligibility(cls, member, loan_type, requested_amount):
        """
        Check if member is eligible for a loan.

        Args:
            member: Member instance
            loan_type: LoanType instance
            requested_amount: Decimal amount requested

        Returns:
            dict: {eligible: bool, reason: str, max_amount: Decimal}
        """
        # Check minimum savings requirement
        if member.total_savings < cls.MIN_SAVINGS:
            return {
                'eligible': False,
                'reason': f'Minimum savings of PHP {cls.MIN_SAVINGS:,.2f} required. Current: PHP {member.total_savings:,.2f}',
                'max_amount': Decimal('0.00')
            }

        max_amount = cls.get_max_loan_amount(member, loan_type)

        # Check associate member limits
        if member.membership_type == 'associate':
            if requested_amount > cls.ASSOCIATE_MAX_LOAN:
                return {
                    'eligible': False,
                    'reason': f'Associate members can only borrow up to PHP {cls.ASSOCIATE_MAX_LOAN:,.2f}',
                    'max_amount': cls.ASSOCIATE_MAX_LOAN
                }

        # Check loan type max amount
        if max_amount and requested_amount > max_amount:
            return {
                'eligible': False,
                'reason': f'Requested amount exceeds maximum of PHP {max_amount:,.2f}',
                'max_amount': max_amount
            }

        return {
            'eligible': True,
            'reason': 'Eligible for loan',
            'max_amount': max_amount
        }

    @classmethod
    def check_can_apply(cls, user):
        """
        Check if a user can apply for a loan.

        Args:
            user: User instance

        Returns:
            dict: {can_apply: bool, reason: str}
        """
        # Check if user has a member profile
        try:
            member = user.applicant
        except Applicant.DoesNotExist:
            return {
                'can_apply': False,
                'reason': 'Applicant profile not found. Please contact the administrator.'
            }

        # Check minimum savings
        if member.total_savings < cls.MIN_SAVINGS:
            return {
                'can_apply': False,
                'reason': f'Minimum savings of PHP {cls.MIN_SAVINGS:,.2f} required to apply for loans. Current: PHP {member.total_savings:,.2f}'
            }

        return {
            'can_apply': True,
            'reason': None,
            'member': member
        }

    @classmethod
    @transaction.atomic
    def record_savings(cls, member, amount, transaction_type, recorded_by,
                       reference_number=None, remarks=None):
        """
        Record a savings transaction.

        Args:
            member: Member instance
            amount: Decimal amount (always positive)
            transaction_type: 'deposit' or 'withdrawal'
            recorded_by: User who recorded the transaction
            reference_number: Optional reference
            remarks: Optional remarks

        Returns:
            Savings: Created savings record

        Raises:
            ValueError: If withdrawal exceeds balance
        """
        if transaction_type == 'withdrawal':
            if member.total_savings < amount:
                raise ValueError('Insufficient savings balance')
            amount = -abs(amount)  # Store as negative for withdrawal
        else:
            amount = abs(amount)  # Ensure positive for deposit

        return Savings.objects.create(
            member=member,
            amount=amount,
            transaction_type=transaction_type,
            recorded_by=recorded_by,
            reference_number=reference_number,
            remarks=remarks
        )

    @classmethod
    @transaction.atomic
    def record_shared_capital(cls, member, amount, transaction_type, recorded_by,
                              reference_number=None, remarks=None):
        """
        Record a shared capital transaction.
        Auto-updates membership classification.

        Args:
            member: Member instance
            amount: Decimal amount (always positive)
            transaction_type: 'contribution' or 'withdrawal'
            recorded_by: User who recorded the transaction
            reference_number: Optional reference
            remarks: Optional remarks

        Returns:
            SharedCapital: Created shared capital record

        Raises:
            ValueError: If withdrawal exceeds balance
        """
        if transaction_type == 'withdrawal':
            if member.total_shared_capital < amount:
                raise ValueError('Insufficient shared capital balance')
            amount = -abs(amount)
        else:
            amount = abs(amount)

        record = SharedCapital.objects.create(
            member=member,
            amount=amount,
            transaction_type=transaction_type,
            recorded_by=recorded_by,
            reference_number=reference_number,
            remarks=remarks
        )

        # Note: membership classification is auto-updated in SharedCapital.save()

        return record
