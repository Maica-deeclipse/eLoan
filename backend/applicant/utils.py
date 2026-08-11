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
import urllib.request
import urllib.parse
import json as _json
from django.conf import settings

# ---------------------------------------------------------------------------
# File type validation via magic bytes
# ---------------------------------------------------------------------------

# Maps leading magic bytes → MIME type.
# Checked in order — longer/more specific patterns first.
_MAGIC_SIGNATURES = [
    (b'\x89PNG\r\n\x1a\n', 'image/png'),
    (b'\xff\xd8\xff',       'image/jpeg'),
    (b'%PDF',               'application/pdf'),
]

ALLOWED_DOCUMENT_TYPES = frozenset({'image/jpeg', 'image/png', 'application/pdf'})
ALLOWED_IMAGE_TYPES    = frozenset({'image/jpeg', 'image/png'})


def detect_file_mime(file) -> str | None:
    """
    Detect the real MIME type of an uploaded file by reading its magic bytes.
    Resets the file pointer to 0 afterwards so the file can still be read normally.

    Returns the detected MIME string, or None if the type is unrecognised.
    """
    header = file.read(8)
    file.seek(0)
    for magic, mime in _MAGIC_SIGNATURES:
        if header.startswith(magic):
            return mime
    return None


def validate_file_type(file, allowed_types: frozenset) -> tuple[bool, str]:
    """
    Validate that the uploaded file's actual type (by magic bytes) is in allowed_types.

    Returns (is_valid, error_message).  error_message is '' on success.
    """
    detected = detect_file_mime(file)
    if detected is None:
        return False, 'Unsupported file type. Only PDF, JPEG, and PNG files are accepted.'
    if detected not in allowed_types:
        labels = {'image/jpeg': 'JPEG', 'image/png': 'PNG', 'application/pdf': 'PDF'}
        allowed_label = ', '.join(labels.get(t, t) for t in sorted(allowed_types))
        return False, f'Invalid file type. Accepted formats: {allowed_label}.'
    return True, ''


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


def verify_recaptcha(token: str, remote_ip: str = '') -> tuple[bool, str]:
    """
    Verify a Google reCAPTCHA v2 response token against the server-side API.

    Returns (success: bool, error_message: str).
    When settings.RECAPTCHA_BYPASS is True (dev/test), always returns (True, '').
    """
    if getattr(settings, 'RECAPTCHA_BYPASS', False):
        return True, ''

    secret_key = getattr(settings, 'RECAPTCHA_SECRET_KEY', '')
    if not secret_key:
        return False, 'reCAPTCHA is not configured on the server.'

    if not token:
        return False, 'CAPTCHA token is required.'

    try:
        data = urllib.parse.urlencode({
            'secret': secret_key,
            'response': token,
            'remoteip': remote_ip,
        }).encode()
        req = urllib.request.Request(
            'https://www.google.com/recaptcha/api/siteverify',
            data=data,
            method='POST',
        )
        with urllib.request.urlopen(req, timeout=5) as resp:
            result = _json.loads(resp.read().decode())
    except Exception:
        return False, 'CAPTCHA verification request failed. Please try again.'

    if result.get('success'):
        return True, ''

    errors = result.get('error-codes', [])
    if 'timeout-or-duplicate' in errors:
        return False, 'CAPTCHA has expired. Please complete it again.'
    return False, 'CAPTCHA verification failed. Please try again.'


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
    # Universal (all loan types)
    BUKSU_ID = 'buksu_id'
    PROOF_OF_INCOME = 'proof_of_income'
    MEMBERSHIP_CERTIFICATE = 'membership_certificate'

    # Loan form & insurance (multiple loan types)
    COMPLETED_LOAN_FORM = 'completed_loan_form'
    CISP_INSURANCE_FORM = 'cisp_insurance_form'

    # Payslip variants
    PAYSLIP_1_MONTH = 'payslip_1_month'
    PAYSLIP_2_MONTHS = 'payslip_2_months'
    PAYSLIP_3_MONTHS = 'payslip_3_months'

    # Employment / appointment
    CERTIFICATE_OF_EMPLOYMENT = 'certificate_of_employment'
    LETTER_OF_INTENT = 'letter_of_intent'

    # Co-maker documents
    COMAKER_ID = 'comaker_id'
    COMAKER_PAYSLIP = 'comaker_payslip'
    COMAKER_SIGNATURE = 'comaker_signature'

    # Spouse
    SPOUSE_VALID_ID = 'spouse_valid_id'

    # Gadget/Appliance-specific
    GADGET_QUOTATION = 'gadget_quotation'

    # Generic optional
    PROOF_OF_ADDRESS = 'proof_of_address'
    BANK_STATEMENT = 'bank_statement'
    SUPPORTING_DOC = 'supporting_document'
    OTHER_DOCUMENTS = 'other_documents'

    # Default required for all loan types (fallback if no LoanTypeRequiredDocument rows exist)
    REQUIRED_DOCUMENTS = [PROOF_OF_INCOME]
    OPTIONAL_DOCUMENTS = [
        PROOF_OF_ADDRESS,
        BANK_STATEMENT,
        SUPPORTING_DOC,
        MEMBERSHIP_CERTIFICATE,
        OTHER_DOCUMENTS,
    ]

    ALL_TYPES = [
        BUKSU_ID, PROOF_OF_INCOME, MEMBERSHIP_CERTIFICATE,
        COMPLETED_LOAN_FORM, CISP_INSURANCE_FORM,
        PAYSLIP_1_MONTH, PAYSLIP_2_MONTHS, PAYSLIP_3_MONTHS,
        CERTIFICATE_OF_EMPLOYMENT, LETTER_OF_INTENT,
        COMAKER_ID, COMAKER_PAYSLIP, COMAKER_SIGNATURE,
        SPOUSE_VALID_ID,
        GADGET_QUOTATION,
        PROOF_OF_ADDRESS, BANK_STATEMENT, SUPPORTING_DOC, OTHER_DOCUMENTS,
    ]

    DISPLAY_NAMES = {
        BUKSU_ID: 'BukSU ID (Front)',
        PROOF_OF_INCOME: 'Proof of Income / Latest Payslip',
        MEMBERSHIP_CERTIFICATE: 'Cooperative Membership Certificate',
        COMPLETED_LOAN_FORM: 'Completed Loan Application Form',
        CISP_INSURANCE_FORM: 'CISP Insurance Form',
        PAYSLIP_1_MONTH: 'Latest 1-Month Payslip',
        PAYSLIP_2_MONTHS: 'Latest 2 Months Payslips',
        PAYSLIP_3_MONTHS: 'Latest 3 Consecutive Months Payslips',
        CERTIFICATE_OF_EMPLOYMENT: 'Certificate of Employment / Appointment',
        LETTER_OF_INTENT: 'Letter of Intent (Purpose of Loan)',
        COMAKER_ID: 'Co-Maker BukSU ID',
        COMAKER_PAYSLIP: 'Co-Maker Latest 1-Month Payslip',
        COMAKER_SIGNATURE: 'Co-Maker Signature',
        SPOUSE_VALID_ID: 'Spouse Valid ID Copy',
        GADGET_QUOTATION: 'Gadget / Appliance Quotation',
        PROOF_OF_ADDRESS: 'Proof of Address',
        BANK_STATEMENT: 'Bank Statement',
        SUPPORTING_DOC: 'Supporting Document',
        OTHER_DOCUMENTS: 'Other Supporting Documents',
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
    APPROVED_FOR_DISBURSEMENT = 'Approved – For Disbursement'
    ACTIVE = 'Active'
    DISBURSED = 'Disbursed'
    PAID = 'Paid'
    CLOSED = 'Closed'

    ACTIVE_STATUSES = [SUBMITTED, VERIFIED, PENDING_CREDIT, APPROVED, APPROVED_FOR_DISBURSEMENT, ACTIVE, DISBURSED]
    TERMINAL_STATUSES = [PAID, CLOSED]
    REOPENABLE_STATUSES = [REJECTED_BOOKKEEPER, REJECTED_CREDIT]
