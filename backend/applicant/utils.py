"""
Applicant Module Utilities

Utility functions for:
- Amortization calculation
- Validation helpers
- File handling
"""

from decimal import Decimal, ROUND_HALF_UP
import os
import uuid
from django.conf import settings


def calculate_monthly_amortization(principal, annual_interest_rate, term_months):
    """
    Calculate monthly amortization using the standard formula.

    Formula: M = P × [r(1+r)^n] / [(1+r)^n - 1]
    Where:
        M = Monthly payment
        P = Principal (loan amount)
        r = Monthly interest rate (annual rate / 12 / 100)
        n = Number of months (term)

    Args:
        principal: Decimal or float - Loan amount
        annual_interest_rate: Decimal or float - Annual interest rate (e.g., 12 for 12%)
        term_months: int - Loan term in months

    Returns:
        dict: {
            'monthly_amortization': Decimal,
            'total_payable': Decimal,
            'total_interest': Decimal
        }
    """
    # Convert to Decimal for precision
    P = Decimal(str(principal))
    annual_rate = Decimal(str(annual_interest_rate))
    n = int(term_months)

    # Calculate monthly interest rate
    r = annual_rate / Decimal('12') / Decimal('100')

    if r == 0:
        # No interest - simple division
        monthly_payment = P / n
    else:
        # Standard amortization formula
        # M = P × [r(1+r)^n] / [(1+r)^n - 1]
        one_plus_r = Decimal('1') + r
        power_n = one_plus_r ** n

        monthly_payment = P * (r * power_n) / (power_n - Decimal('1'))

    # Round to 2 decimal places
    monthly_payment = monthly_payment.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
    total_payable = (monthly_payment * n).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
    total_interest = (total_payable - P).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)

    return {
        'monthly_amortization': monthly_payment,
        'total_payable': total_payable,
        'total_interest': total_interest
    }


def validate_loan_amount(amount, loan_type):
    """
    Validate that the loan amount is within the loan type's limits.

    Args:
        amount: Decimal - Requested loan amount
        loan_type: LoanType instance

    Returns:
        tuple: (is_valid: bool, error_message: str or None)
    """
    amount = Decimal(str(amount))

    if amount < loan_type.min_amount:
        return False, f"Minimum loan amount is ₱{loan_type.min_amount:,.2f}"

    if amount > loan_type.max_amount:
        return False, f"Maximum loan amount is ₱{loan_type.max_amount:,.2f}"

    return True, None


def validate_loan_term(term_months, loan_type):
    """
    Validate that the loan term is within the loan type's limits.

    Args:
        term_months: int - Requested term in months
        loan_type: LoanType instance

    Returns:
        tuple: (is_valid: bool, error_message: str or None)
    """
    term_months = int(term_months)

    if term_months < 1:
        return False, "Minimum term is 1 month"

    if term_months > loan_type.max_term_months:
        return False, f"Maximum term is {loan_type.max_term_months} months"

    return True, None


def get_comaker_requirement(loan_type):
    """
    Get the number of required co-makers for a loan type.

    Args:
        loan_type: LoanType instance

    Returns:
        int: Number of required co-makers (0, 1, or 2)
    """
    from .models import LoanTypeCoMakerRequirement

    try:
        requirement = LoanTypeCoMakerRequirement.objects.get(loan_type=loan_type)
        return requirement.required_comakers
    except LoanTypeCoMakerRequirement.DoesNotExist:
        # Default based on loan type name
        loan_name = loan_type.loan_name.lower()

        if any(name in loan_name for name in ['regular loan', 'gadget', 'appliance', 'enhanced']):
            return 2
        elif 'grace' in loan_name:
            return 1
        else:
            return 0


def generate_file_path(base_path, original_filename, prefix=''):
    """
    Generate a unique file path for uploads.

    Args:
        base_path: str - Base directory path (e.g., 'applicant/documents/')
        original_filename: str - Original filename
        prefix: str - Optional prefix for the filename

    Returns:
        str: Unique file path
    """
    ext = os.path.splitext(original_filename)[1].lower()
    unique_id = uuid.uuid4().hex[:12]
    filename = f"{prefix}_{unique_id}{ext}" if prefix else f"{unique_id}{ext}"
    return os.path.join(base_path, filename)


def get_client_ip(request):
    """
    Get the client IP address from the request.

    Args:
        request: Django request object

    Returns:
        str: IP address
    """
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        ip = x_forwarded_for.split(',')[0].strip()
    else:
        ip = request.META.get('REMOTE_ADDR')
    return ip


# Document type constants
class DocumentTypes:
    BUKSU_ID = 'buksu_id'
    PROOF_OF_INCOME = 'proof_of_income'
    PROOF_OF_ADDRESS = 'proof_of_address'
    EMPLOYMENT_CERTIFICATE = 'employment_certificate'
    BANK_STATEMENT = 'bank_statement'
    SUPPORTING_DOC = 'supporting_document'
    MEMBERSHIP_CERTIFICATE = 'membership_certificate'
    OTHER_DOCUMENTS = 'other_documents'
    COMAKER_ID = 'comaker_id'
    COMAKER_SIGNATURE = 'comaker_signature'

    REQUIRED_DOCUMENTS = [BUKSU_ID, PROOF_OF_INCOME]
    OPTIONAL_DOCUMENTS = [
        PROOF_OF_ADDRESS,
        EMPLOYMENT_CERTIFICATE,
        BANK_STATEMENT,
        SUPPORTING_DOC,
        MEMBERSHIP_CERTIFICATE,
        OTHER_DOCUMENTS,
    ]

    ALL_TYPES = REQUIRED_DOCUMENTS + OPTIONAL_DOCUMENTS + [COMAKER_ID, COMAKER_SIGNATURE]

    DISPLAY_NAMES = {
        BUKSU_ID: 'BukSu ID',
        PROOF_OF_INCOME: 'Proof of Income',
        PROOF_OF_ADDRESS: 'Proof of Address',
        EMPLOYMENT_CERTIFICATE: 'Employment Certificate',
        BANK_STATEMENT: 'Bank Statement',
        SUPPORTING_DOC: 'Supporting Document',
        MEMBERSHIP_CERTIFICATE: 'Cooperative Membership Certificate',
        OTHER_DOCUMENTS: 'Other Supporting Documents',
        COMAKER_ID: 'Co-Maker ID',
        COMAKER_SIGNATURE: 'Co-Maker Signature',
    }


# Application status constants
class ApplicationStatuses:
    DRAFT = 'Draft'
    SUBMITTED = 'Submitted'
    VERIFIED = 'Verified by Bookkeeper'
    REJECTED_BOOKKEEPER = 'Rejected by Bookkeeper'
    PENDING_CREDIT = 'Pending Credit Committee'
    APPROVED = 'Approved by Credit Committee'
    REJECTED_CREDIT = 'Rejected by Credit Committee'
    RETURNED = 'Returned to Treasurer'
    DISBURSED = 'Disbursed'
    PAID = 'Paid'

    ACTIVE_STATUSES = [SUBMITTED, VERIFIED, PENDING_CREDIT, APPROVED, DISBURSED]
    TERMINAL_STATUSES = [REJECTED_BOOKKEEPER, REJECTED_CREDIT, PAID]
