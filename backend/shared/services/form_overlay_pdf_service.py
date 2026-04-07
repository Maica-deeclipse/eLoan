"""
Form Overlay PDF Service
========================
Fills applicant data onto the original physical form templates stored in
  backend/media/forms/

Strategy
--------
1. Open the template PDF (the cooperative's original paper form).
2. For every page that needs data, create a matching ReportLab overlay canvas
   containing only the field values, drawn at pre-defined (x, y) coordinates.
3. Merge the overlay page on top of the corresponding template page using pypdf.
4. Return the merged buffer.

Coordinate system
-----------------
  • PDF points  — 72 pt = 1 inch
  • Origin      — bottom-left corner of the page
  • A4 portrait — width = 595 pt, height = 842 pt
  • A4 landscape — width = 842 pt, height = 595 pt

Calibration
-----------
Set DEBUG_COORDS = True below to render a small red dot at every field
coordinate.  Compare the dot positions against the template and adjust x/y.
The dot is drawn BEFORE the text so it is always visible.
"""

from __future__ import annotations

import io
import logging
import os
from dataclasses import dataclass, field
from typing import Callable, Optional

from django.conf import settings
from reportlab.pdfgen import canvas as rl_canvas
from reportlab.lib.pagesizes import A4

try:
    from pypdf import PdfReader, PdfWriter
    PYPDF_AVAILABLE = True
except ImportError:
    PYPDF_AVAILABLE = False

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Toggle to True to see red anchor dots for every field — useful for calibration
# ---------------------------------------------------------------------------
DEBUG_COORDS = False

# ---------------------------------------------------------------------------
# Directory that holds the original form PDFs
# ---------------------------------------------------------------------------
FORMS_DIR = os.path.join(settings.MEDIA_ROOT, 'forms')

# Maps LoanType.loan_name → filename inside FORMS_DIR
TEMPLATE_FILES: dict[str, str] = {
    'Calamity Loan':         'Calamity-Loan-Form.pdf',
    'Emergency Loan':        'Emergency Loan Form.pdf',
    'Enhanced Regular Loan': 'Enhanced-Loan-Form.New.pdf',
    'Financing Loan':        'Financing Loan Form.pdf',
    'Gadget/Appliance Loan': 'Gadget-Appliance-Loan-Form.New.pdf',
    'Grace Loan':            'Grace-Loan.New.pdf',
    'Grocery Loan':          'Grocery Loan Form.New.pdf',
    'Loan Against Deposit':  'LAD-Loan-Form.docx.pdf',
    'Pamasahe Loan':         'Pamasahe Loan.pdf',
    'Petty Cash':            'Petty-Cash-Loan-Form.New.pdf',
    'Regular Loan':          'Regular-Loan-Form.New.pdf',
    'Rice Loan':             'Rice-Loan-Form.New.pdf',
}


# ---------------------------------------------------------------------------
# Field definition
# ---------------------------------------------------------------------------

@dataclass
class FieldDef:
    """One text value to draw on the overlay."""
    key: str                       # Identifier (for debug / logging only)
    page: int                      # 0-based template page index
    x: float                       # x from left edge, in PDF points
    y: float                       # y from bottom edge, in PDF points
    font: str = 'Helvetica'
    size: float = 8.5
    max_width: Optional[float] = None   # clip text to this width (pt); None = no clip
    bold: bool = False


# ---------------------------------------------------------------------------
# Helpers for extracting values from the application object
# ---------------------------------------------------------------------------

def _v(v, fallback='') -> str:
    if v is None:
        return fallback
    s = str(v).strip()
    return s if s else fallback


def _money(v, fallback='') -> str:
    try:
        return f"{float(v):,.2f}"
    except (TypeError, ValueError):
        return fallback


def _date(dt, fmt='%m/%d/%Y', fallback='') -> str:
    if not dt:
        return fallback
    try:
        return dt.strftime(fmt)
    except Exception:
        return fallback


def _checked(condition: bool) -> str:
    """Return '✓' or '' depending on condition."""
    return '✓' if condition else ''


# ---------------------------------------------------------------------------
# Application data extractor
# ---------------------------------------------------------------------------

def extract_data(app) -> dict:
    """
    Build a flat dict of every field needed across all 13 loan form templates.
    Keys match the FieldDef.key values used in FIELD_MAPS below.
    """
    user    = app.user
    profile = getattr(user, 'applicant_profile', None)
    lt      = app.loan_type

    # ---- borrower basics ---------------------------------------------------
    full_name  = f"{_v(user.firstname)} {_v(user.lastname)}".strip()
    address    = _v(profile.full_address if profile else None) or \
                 _v(profile.address_line1 if profile else None)

    civil_status = _v(getattr(profile, 'civil_status', None))
    dob          = _date(getattr(profile, 'date_of_birth', None))
    tin          = _v(getattr(profile, 'tin', None))
    emp_status   = _v(getattr(profile, 'employment_status', None))
    net_pay      = _money(getattr(profile, 'net_take_home_pay', None) or
                          getattr(profile, 'monthly_income', None))

    # ---- loan basics -------------------------------------------------------
    inst_type  = _v(getattr(app, 'installment_type', 'monthly'))
    loan_form  = getattr(app, 'loan_form_data', None) or {}

    # ---- committee / staff info -------------------------------------------
    from loans.models import StatusChangeLog
    def reviewer(role):
        log = (StatusChangeLog.objects
               .filter(application=app, changed_by_role=role)
               .order_by('-changed_at').first())
        if log and log.changed_by:
            return (f"{log.changed_by.firstname} {log.changed_by.lastname}",
                    _date(log.changed_at))
        return ('', '')

    bk_name, bk_date = reviewer('Bookkeeper')
    tr_name, tr_date = reviewer('Treasurer')
    cc_name, cc_date = reviewer('Credit Committee')

    # ---- credit committee decision -----------------------------------------
    try:
        from credit_committee.models import CreditCommitteeDecision
        cc_dec = CreditCommitteeDecision.objects.filter(application=app).order_by('-created_at').first()
        cc_action     = _v(getattr(cc_dec, 'decision', None))
        cc_date_meet  = _date(getattr(cc_dec, 'meeting_date', None))
        cc_remarks    = _v(getattr(cc_dec, 'remarks', None))
    except Exception:
        cc_action = cc_date_meet = cc_remarks = ''

    # ---- co-makers ---------------------------------------------------------
    comakers = list(app.comakers.all())
    def cm(idx: int, attr: str, fallback='') -> str:
        if idx >= len(comakers):
            return fallback
        info = getattr(comakers[idx], 'detailed_info', None)
        if info:
            return _v(getattr(info, attr, None)) or fallback
        cm_user = comakers[idx].user
        if attr == 'full_name':
            return f"{_v(cm_user.firstname)} {_v(cm_user.lastname)}"
        return fallback

    # ---- loan_form_data extras (LAD / Gadget) --------------------------------
    share_capital  = _money(loan_form.get('share_capital_amount'))
    sc_date        = _v(loan_form.get('share_capital_as_of_date'))
    passbook_no    = _v(loan_form.get('passbook_no'))
    savings_dep    = _money(loan_form.get('savings_deposit_amount'))
    loan_balance   = _money(loan_form.get('loan_balance_amount'))
    lb_date        = _v(loan_form.get('loan_balance_as_of_date'))
    gadget_type    = _v(loan_form.get('type_of_gadget_or_appliance'))

    return {
        # Application header
        'date':             _date(app.application_date, '%B %d, %Y'),
        'loan_no':          f"APP-{app.id:06d}",
        'app_no':           f"APP-{app.id:06d}",
        'status':           _v(app.current_status.status_name if app.current_status else None),

        # Borrower
        'borrower_name':    full_name,
        'complete_address': address,
        'contact_no':       _v(profile.contact_number if profile else None),
        'net_take_home_pay': net_pay,
        'civil_status':     civil_status.title(),
        'date_of_birth':    dob,
        'birthday':         dob,
        'tin':              tin,
        'age':              _v(loan_form.get('age')),

        # Employment status checkboxes (✓ in the right box)
        'emp_permanent':    _checked(emp_status == 'permanent'),
        'emp_temporary':    _checked(emp_status == 'temporary'),
        'emp_casual':       _checked(emp_status == 'casual'),
        'emp_part_time':    _checked(emp_status == 'part_time'),
        'emp_job_order':    _checked(emp_status == 'job_order'),
        'emp_regular':      _checked(emp_status == 'permanent'),  # some forms use "regular"

        # Loan details
        'amount_applied':   _money(app.amount_requested),
        'amount_in_words':  _v(loan_form.get('amount_in_words')),
        'term_months':      _v(app.term_months),
        'loan_purpose':     _v(app.purpose),
        'installment_monthly':    _checked(inst_type == 'monthly'),
        'installment_semi':       _checked(inst_type == 'semi_monthly'),
        'first_installment_date': _date(getattr(app, 'first_installment_date', None)),

        # Purpose checkboxes
        'purpose_enrolment':       _checked('enrol' in _v(app.purpose).lower()),
        'purpose_house':           _checked('house' in _v(app.purpose).lower() or 'home' in _v(app.purpose).lower()),
        'purpose_hospital':        _checked('hospital' in _v(app.purpose).lower() or 'medical' in _v(app.purpose).lower()),
        'purpose_other':           _checked('other' in _v(app.purpose).lower()),

        # Gadget/Appliance
        'gadget_type': gadget_type,

        # Promissory note computation
        'promissory_amount':       _money(app.amount_requested),
        'date_granted':            _date(app.application_date),
        'amortization':            _money(app.monthly_amortization),
        'installment_due_every':   f"{'15th & 30th' if inst_type == 'semi_monthly' else '30th'} of the month",
        'interest_amount':         _money(
            float(app.total_payable or 0) - float(app.amount_requested or 0)
            if app.total_payable and app.amount_requested else None
        ),
        'maturity_date':           _v(loan_form.get('maturity_date')),
        'interest_rate':           f"{_v(lt.interest_rate if lt else None)}%" ,
        'number_of_installments':  _v(app.term_months),
        'installment_amount':      _money(app.monthly_amortization),
        'net_proceeds':            _money(app.amount_requested),
        'total_deduction':         _money(
            float(app.total_payable or 0) - float(app.amount_requested or 0)
            if app.total_payable and app.amount_requested else None
        ),

        # Co-makers
        'co_maker_1_name':    cm(0, 'full_name'),
        'co_maker_1_contact': cm(0, 'contact_number'),
        'co_maker_1_address': cm(0, 'address'),
        'co_maker_2_name':    cm(1, 'full_name'),
        'co_maker_2_contact': cm(1, 'contact_number'),
        'co_maker_2_address': cm(1, 'address'),

        # Committee / Office use
        'committee_meeting_date':    cc_date_meet,
        'committee_action':          cc_action,
        'remarks_conditions':        cc_remarks,
        'approver_1_name':           bk_name,
        'approver_2_name':           tr_name,
        'approver_3_name':           cc_name,
        'share_capital_amount':      share_capital,
        'share_capital_as_of_date':  sc_date,
        'passbook_no':               passbook_no,
        'savings_deposit_amount':    savings_dep,
        'loan_balance_amount':       loan_balance,
        'loan_balance_as_of_date':   lb_date,

        # Disclosure statement
        'kind_of_loan':     _v(lt.loan_name if lt else None),
        'loan_granted':     _money(app.amount_requested),
        'term':             f"{_v(app.term_months)} months",
        'due_date':         _v(loan_form.get('due_date')),
        'prepared_by':      bk_name,

        # Timestamps / notarization
        'generated_date': datetime.now().strftime('%B %d, %Y'),
        'generated_time': datetime.now().strftime('%I:%M %p'),
    }


# ---------------------------------------------------------------------------
# Per-loan-type field coordinate maps
# ---------------------------------------------------------------------------
# Layout assumptions (A4 portrait, 595 × 842 pt):
#   Left margin ≈ 45 pt    Right margin ≈ 550 pt
#   Top of form content  ≈ 790 pt (just below header)
#   Each line spacing    ≈ 18-22 pt
#
# CALIBRATION TIP:  Set DEBUG_COORDS = True, generate a PDF, compare red dots
# against the printed form, then adjust x/y values here.
# ---------------------------------------------------------------------------

FIELD_MAPS: dict[str, list[FieldDef]] = {}

# ── Helper to register a map ──────────────────────────────────────────────

def _reg(loan_name: str, fields: list[FieldDef]):
    FIELD_MAPS[loan_name] = fields


# ── Calamity Loan ─────────────────────────────────────────────────────────
_reg('Calamity Loan', [
    FieldDef('date',            0, 445, 751, size=8.5),
    FieldDef('loan_no',         0, 155, 751, size=8.5),
    FieldDef('amount_in_words', 0,  90, 728, size=8.5, max_width=310),
    FieldDef('amount_applied',  0, 440, 728, size=8.5),
    FieldDef('term_months',     0, 155, 705, size=8.5),
    FieldDef('first_installment_date', 0, 340, 705, size=8.5),
    FieldDef('borrower_name',       0,  90, 675, size=8.5, max_width=250),
    FieldDef('net_take_home_pay',   0, 390, 675, size=8.5),
    FieldDef('complete_address',    0,  90, 653, size=8.5, max_width=350),
    FieldDef('contact_no',          0, 450, 653, size=8.5),
    FieldDef('emp_regular',   0,  90, 630, size=9, font='Helvetica-Bold'),
    FieldDef('emp_casual',    0, 185, 630, size=9, font='Helvetica-Bold'),
    FieldDef('emp_part_time', 0, 270, 630, size=9, font='Helvetica-Bold'),
    FieldDef('emp_job_order', 0, 360, 630, size=9, font='Helvetica-Bold'),
    FieldDef('date_of_birth', 0, 110, 608, size=8.5),
    FieldDef('age',           0, 280, 608, size=8.5),
    FieldDef('civil_status',  0, 370, 608, size=8.5),
    FieldDef('tin',           0, 490, 608, size=8.5),
    # Promissory note (page 1)
    FieldDef('promissory_amount',     1,  90, 720, size=8.5),
    FieldDef('date_granted',          1, 300, 720, size=8.5),
    FieldDef('amortization',          1,  90, 698, size=8.5),
    FieldDef('installment_due_every', 1, 300, 698, size=8.5),
    FieldDef('interest_amount',       1,  90, 676, size=8.5),
    FieldDef('maturity_date',         1, 300, 676, size=8.5),
    FieldDef('interest_rate',         1,  90, 654, size=8.5),
    FieldDef('number_of_installments',1, 300, 654, size=8.5),
    FieldDef('installment_amount',    1,  90, 632, size=8.5),
    FieldDef('borrower_name',         1,  90, 200, size=8.5, max_width=200),
    FieldDef('generated_date',        1, 400, 200, size=8.5),
])

# ── Emergency Loan ────────────────────────────────────────────────────────
_reg('Emergency Loan', [
    FieldDef('date',    0, 445, 751, size=8.5),
    FieldDef('loan_no', 0, 155, 751, size=8.5),
    FieldDef('borrower_name',     0,  90, 720, size=8.5, max_width=260),
    FieldDef('amount_applied',    0, 380, 720, size=8.5),
    FieldDef('complete_address',  0,  90, 698, size=8.5, max_width=350),
    FieldDef('contact_no',        0, 450, 698, size=8.5),
    FieldDef('emp_regular',   0,  90, 675, size=9, font='Helvetica-Bold'),
    FieldDef('emp_permanent', 0, 185, 675, size=9, font='Helvetica-Bold'),
    FieldDef('emp_casual',    0, 275, 675, size=9, font='Helvetica-Bold'),
    FieldDef('emp_part_time', 0, 360, 675, size=9, font='Helvetica-Bold'),
    FieldDef('emp_job_order', 0, 450, 675, size=9, font='Helvetica-Bold'),
    FieldDef('age',          0, 110, 653, size=8.5),
    FieldDef('birthday',     0, 220, 653, size=8.5),
    FieldDef('civil_status', 0, 370, 653, size=8.5),
    FieldDef('tin',          0, 490, 653, size=8.5),
    FieldDef('net_take_home_pay', 0, 300, 630, size=8.5),
    # Promissory note (page 1)
    FieldDef('promissory_amount',     1,  90, 720, size=8.5),
    FieldDef('date_granted',          1, 300, 720, size=8.5),
    FieldDef('amortization',          1,  90, 698, size=8.5),
    FieldDef('installment_due_every', 1, 300, 698, size=8.5),
    FieldDef('interest_amount',       1,  90, 676, size=8.5),
    FieldDef('maturity_date',         1, 300, 676, size=8.5),
    FieldDef('interest_rate',         1,  90, 654, size=8.5),
    FieldDef('number_of_installments',1, 300, 654, size=8.5),
    FieldDef('installment_amount',    1,  90, 632, size=8.5),
    FieldDef('borrower_name',         1,  90, 200, size=8.5, max_width=200),
    FieldDef('generated_date',        1, 400, 200, size=8.5),
    # Disclosure statement (page 2)
    FieldDef('kind_of_loan',    2, 200, 700, size=8.5),
    FieldDef('loan_granted',    2, 200, 678, size=8.5),
    FieldDef('term',            2, 200, 656, size=8.5),
    FieldDef('interest_rate',   2, 200, 634, size=8.5),
    FieldDef('interest_amount', 2, 200, 612, size=8.5),
    FieldDef('total_deduction', 2, 200, 568, size=8.5),
    FieldDef('net_proceeds',    2, 200, 546, size=8.5),
    FieldDef('prepared_by',     2, 200, 480, size=8.5),
    FieldDef('borrower_name',   2,  90, 420, size=8.5, max_width=200),
])

# ── Enhanced Regular Loan ─────────────────────────────────────────────────
_reg('Enhanced Regular Loan', [
    FieldDef('date',            0, 445, 751, size=8.5),
    FieldDef('loan_no',         0, 155, 751, size=8.5),
    FieldDef('amount_in_words', 0,  90, 728, size=8.5, max_width=310),
    FieldDef('amount_applied',  0, 440, 728, size=8.5),
    FieldDef('term_months',     0, 155, 705, size=8.5),
    FieldDef('first_installment_date', 0, 340, 705, size=8.5),
    FieldDef('purpose_enrolment', 0,  90, 682, size=9, font='Helvetica-Bold'),
    FieldDef('purpose_house',     0, 200, 682, size=9, font='Helvetica-Bold'),
    FieldDef('purpose_hospital',  0, 310, 682, size=9, font='Helvetica-Bold'),
    FieldDef('purpose_other',     0, 420, 682, size=9, font='Helvetica-Bold'),
    FieldDef('borrower_name',       0,  90, 655, size=8.5, max_width=250),
    FieldDef('net_take_home_pay',   0, 390, 655, size=8.5),
    FieldDef('complete_address',    0,  90, 633, size=8.5, max_width=350),
    FieldDef('contact_no',          0, 450, 633, size=8.5),
    FieldDef('emp_permanent', 0,  90, 610, size=9, font='Helvetica-Bold'),
    FieldDef('emp_temporary', 0, 175, 610, size=9, font='Helvetica-Bold'),
    FieldDef('emp_casual',    0, 260, 610, size=9, font='Helvetica-Bold'),
    FieldDef('emp_part_time', 0, 345, 610, size=9, font='Helvetica-Bold'),
    FieldDef('emp_job_order', 0, 430, 610, size=9, font='Helvetica-Bold'),
    FieldDef('date_of_birth', 0, 110, 588, size=8.5),
    FieldDef('age',           0, 280, 588, size=8.5),
    FieldDef('civil_status',  0, 370, 588, size=8.5),
    FieldDef('tin',           0, 490, 588, size=8.5),
    # Page 1 – Committee
    FieldDef('committee_meeting_date', 1, 250, 720, size=8.5),
    FieldDef('remarks_conditions',     1, 100, 650, size=8.5, max_width=400),
    FieldDef('approver_1_name',        1, 100, 580, size=8.5),
    FieldDef('approver_2_name',        1, 240, 580, size=8.5),
    FieldDef('approver_3_name',        1, 390, 580, size=8.5),
    FieldDef('share_capital_as_of_date',  1, 300, 520, size=8.5),
    FieldDef('share_capital_amount',      1, 450, 520, size=8.5),
    FieldDef('savings_deposit_amount',    1, 450, 498, size=8.5),
    FieldDef('loan_balance_as_of_date',   1, 300, 476, size=8.5),
    FieldDef('loan_balance_amount',       1, 450, 476, size=8.5),
    FieldDef('passbook_no',               1, 300, 454, size=8.5),
    # Page 2 – Promissory Note
    FieldDef('promissory_amount',      2,  90, 720, size=8.5),
    FieldDef('date_granted',           2, 300, 720, size=8.5),
    FieldDef('amortization',           2,  90, 698, size=8.5),
    FieldDef('installment_due_every',  2, 300, 698, size=8.5),
    FieldDef('interest_amount',        2,  90, 676, size=8.5),
    FieldDef('maturity_date',          2, 300, 676, size=8.5),
    FieldDef('interest_rate',          2,  90, 654, size=8.5),
    FieldDef('number_of_installments', 2, 300, 654, size=8.5),
    FieldDef('installment_amount',     2,  90, 632, size=8.5),
    FieldDef('borrower_name',          2,  90, 200, size=8.5, max_width=150),
    FieldDef('co_maker_1_name',        2, 250, 200, size=8.5, max_width=130),
    FieldDef('co_maker_2_name',        2, 400, 200, size=8.5, max_width=130),
    FieldDef('generated_date',         2, 430, 170, size=8.5),
    # Page 3 – Disclosure Statement
    FieldDef('kind_of_loan',    3, 200, 700, size=8.5),
    FieldDef('loan_granted',    3, 200, 678, size=8.5),
    FieldDef('term',            3, 200, 656, size=8.5),
    FieldDef('interest_rate',   3, 200, 634, size=8.5),
    FieldDef('interest_amount', 3, 200, 612, size=8.5),
    FieldDef('total_deduction', 3, 200, 568, size=8.5),
    FieldDef('net_proceeds',    3, 200, 546, size=8.5),
    FieldDef('prepared_by',     3, 200, 480, size=8.5),
    FieldDef('borrower_name',   3,  90, 420, size=8.5, max_width=200),
])

# ── Financing Loan ────────────────────────────────────────────────────────
_reg('Financing Loan', [
    FieldDef('date',            0, 445, 751, size=8.5),
    FieldDef('loan_no',         0, 155, 751, size=8.5),
    FieldDef('amount_in_words', 0,  90, 728, size=8.5, max_width=310),
    FieldDef('amount_applied',  0, 440, 728, size=8.5),
    FieldDef('term_months',     0, 155, 705, size=8.5),
    FieldDef('first_installment_date', 0, 340, 705, size=8.5),
    FieldDef('loan_purpose',          0,  90, 682, size=8.5, max_width=400),
    FieldDef('borrower_name',         0,  90, 655, size=8.5, max_width=250),
    FieldDef('net_take_home_pay',     0, 390, 655, size=8.5),
    FieldDef('complete_address',      0,  90, 633, size=8.5, max_width=350),
    FieldDef('contact_no',            0, 450, 633, size=8.5),
    FieldDef('emp_regular',   0,  90, 610, size=9, font='Helvetica-Bold'),
    FieldDef('emp_casual',    0, 185, 610, size=9, font='Helvetica-Bold'),
    FieldDef('emp_part_time', 0, 270, 610, size=9, font='Helvetica-Bold'),
    FieldDef('emp_job_order', 0, 360, 610, size=9, font='Helvetica-Bold'),
    # Promissory note (page 1)
    FieldDef('promissory_amount',     1,  90, 720, size=8.5),
    FieldDef('date_granted',          1, 300, 720, size=8.5),
    FieldDef('amortization',          1,  90, 698, size=8.5),
    FieldDef('installment_due_every', 1, 300, 698, size=8.5),
    FieldDef('interest_amount',       1,  90, 676, size=8.5),
    FieldDef('maturity_date',         1, 300, 676, size=8.5),
    FieldDef('interest_rate',         1,  90, 654, size=8.5),
    FieldDef('number_of_installments',1, 300, 654, size=8.5),
    FieldDef('installment_amount',    1,  90, 632, size=8.5),
    FieldDef('borrower_name',         1,  90, 200, size=8.5, max_width=200),
    FieldDef('generated_date',        1, 400, 200, size=8.5),
    # Disclosure (page 2)
    FieldDef('kind_of_loan',    2, 200, 700, size=8.5),
    FieldDef('loan_granted',    2, 200, 678, size=8.5),
    FieldDef('term',            2, 200, 656, size=8.5),
    FieldDef('interest_rate',   2, 200, 634, size=8.5),
    FieldDef('interest_amount', 2, 200, 612, size=8.5),
    FieldDef('total_deduction', 2, 200, 568, size=8.5),
    FieldDef('net_proceeds',    2, 200, 546, size=8.5),
    FieldDef('prepared_by',     2, 200, 480, size=8.5),
])

# ── Gadget/Appliance Loan ─────────────────────────────────────────────────
_reg('Gadget/Appliance Loan', [
    FieldDef('date',            0, 445, 751, size=8.5),
    FieldDef('loan_no',         0, 155, 751, size=8.5),
    FieldDef('gadget_type',     0,  90, 728, size=8.5, max_width=310),
    FieldDef('amount_in_words', 0,  90, 705, size=8.5, max_width=310),
    FieldDef('amount_applied',  0, 440, 705, size=8.5),
    FieldDef('term_months',     0, 155, 682, size=8.5),
    FieldDef('first_installment_date', 0, 340, 682, size=8.5),
    FieldDef('borrower_name',       0,  90, 655, size=8.5, max_width=250),
    FieldDef('net_take_home_pay',   0, 390, 655, size=8.5),
    FieldDef('complete_address',    0,  90, 633, size=8.5, max_width=350),
    FieldDef('contact_no',          0, 450, 633, size=8.5),
    FieldDef('emp_permanent', 0,  90, 610, size=9, font='Helvetica-Bold'),
    FieldDef('emp_temporary', 0, 175, 610, size=9, font='Helvetica-Bold'),
    FieldDef('emp_casual',    0, 260, 610, size=9, font='Helvetica-Bold'),
    FieldDef('emp_part_time', 0, 345, 610, size=9, font='Helvetica-Bold'),
    FieldDef('emp_job_order', 0, 430, 610, size=9, font='Helvetica-Bold'),
    FieldDef('age',           0, 110, 588, size=8.5),
    FieldDef('birthday',      0, 220, 588, size=8.5),
    FieldDef('civil_status',  0, 370, 588, size=8.5),
    FieldDef('tin',           0, 490, 588, size=8.5),
    # Page 1 – Committee / approval
    FieldDef('committee_meeting_date', 1, 250, 720, size=8.5),
    FieldDef('remarks_conditions',     1, 100, 650, size=8.5, max_width=400),
    FieldDef('approver_1_name',        1, 100, 580, size=8.5),
    FieldDef('approver_2_name',        1, 240, 580, size=8.5),
    FieldDef('approver_3_name',        1, 390, 580, size=8.5),
    # Page 2 – Promissory Note
    FieldDef('promissory_amount',      2,  90, 720, size=8.5),
    FieldDef('date_granted',           2, 300, 720, size=8.5),
    FieldDef('amortization',           2,  90, 698, size=8.5),
    FieldDef('installment_due_every',  2, 300, 698, size=8.5),
    FieldDef('interest_amount',        2,  90, 676, size=8.5),
    FieldDef('maturity_date',          2, 300, 676, size=8.5),
    FieldDef('interest_rate',          2,  90, 654, size=8.5),
    FieldDef('number_of_installments', 2, 300, 654, size=8.5),
    FieldDef('installment_amount',     2,  90, 632, size=8.5),
    FieldDef('borrower_name',          2,  90, 200, size=8.5, max_width=150),
    FieldDef('co_maker_1_name',        2, 250, 200, size=8.5, max_width=130),
    FieldDef('co_maker_2_name',        2, 400, 200, size=8.5, max_width=130),
    # Page 3 – Disclosure
    FieldDef('kind_of_loan',    3, 200, 700, size=8.5),
    FieldDef('loan_granted',    3, 200, 678, size=8.5),
    FieldDef('term',            3, 200, 656, size=8.5),
    FieldDef('interest_rate',   3, 200, 634, size=8.5),
    FieldDef('total_deduction', 3, 200, 568, size=8.5),
    FieldDef('net_proceeds',    3, 200, 546, size=8.5),
    FieldDef('prepared_by',     3, 200, 480, size=8.5),
])

# ── Grace Loan ────────────────────────────────────────────────────────────
_reg('Grace Loan', [
    FieldDef('date',            0, 445, 751, size=8.5),
    FieldDef('loan_no',         0, 155, 751, size=8.5),
    FieldDef('amount_in_words', 0,  90, 728, size=8.5, max_width=310),
    FieldDef('amount_applied',  0, 440, 728, size=8.5),
    FieldDef('term_months',     0, 155, 705, size=8.5),
    FieldDef('first_installment_date', 0, 340, 705, size=8.5),
    FieldDef('loan_purpose',    0,  90, 682, size=8.5, max_width=400),
    FieldDef('borrower_name',     0,  90, 655, size=8.5, max_width=250),
    FieldDef('net_take_home_pay', 0, 390, 655, size=8.5),
    FieldDef('complete_address',  0,  90, 633, size=8.5, max_width=350),
    FieldDef('contact_no',        0, 450, 633, size=8.5),
    FieldDef('emp_permanent', 0,  90, 610, size=9, font='Helvetica-Bold'),
    FieldDef('emp_temporary', 0, 175, 610, size=9, font='Helvetica-Bold'),
    FieldDef('emp_casual',    0, 260, 610, size=9, font='Helvetica-Bold'),
    FieldDef('emp_part_time', 0, 345, 610, size=9, font='Helvetica-Bold'),
    FieldDef('emp_job_order', 0, 430, 610, size=9, font='Helvetica-Bold'),
    FieldDef('date_of_birth', 0, 110, 588, size=8.5),
    FieldDef('age',           0, 280, 588, size=8.5),
    FieldDef('civil_status',  0, 370, 588, size=8.5),
    FieldDef('tin',           0, 490, 588, size=8.5),
    # Page 1 – Committee
    FieldDef('committee_meeting_date', 1, 250, 720, size=8.5),
    FieldDef('remarks_conditions',     1, 100, 650, size=8.5, max_width=400),
    FieldDef('approver_1_name',        1, 100, 580, size=8.5),
    FieldDef('approver_2_name',        1, 240, 580, size=8.5),
    FieldDef('approver_3_name',        1, 390, 580, size=8.5),
    FieldDef('share_capital_as_of_date', 1, 300, 520, size=8.5),
    FieldDef('share_capital_amount',     1, 450, 520, size=8.5),
    FieldDef('savings_deposit_amount',   1, 450, 498, size=8.5),
    FieldDef('loan_balance_as_of_date',  1, 300, 476, size=8.5),
    FieldDef('loan_balance_amount',      1, 450, 476, size=8.5),
    FieldDef('passbook_no',              1, 300, 454, size=8.5),
    # Page 2 – Promissory Note
    FieldDef('promissory_amount',      2,  90, 720, size=8.5),
    FieldDef('date_granted',           2, 300, 720, size=8.5),
    FieldDef('amortization',           2,  90, 698, size=8.5),
    FieldDef('installment_due_every',  2, 300, 698, size=8.5),
    FieldDef('interest_amount',        2,  90, 676, size=8.5),
    FieldDef('maturity_date',          2, 300, 676, size=8.5),
    FieldDef('interest_rate',          2,  90, 654, size=8.5),
    FieldDef('number_of_installments', 2, 300, 654, size=8.5),
    FieldDef('installment_amount',     2,  90, 632, size=8.5),
    FieldDef('borrower_name',          2,  90, 200, size=8.5, max_width=150),
    FieldDef('co_maker_1_name',        2, 250, 200, size=8.5, max_width=130),
    FieldDef('co_maker_2_name',        2, 400, 200, size=8.5, max_width=130),
    # Page 3 – Disclosure
    FieldDef('kind_of_loan',    3, 200, 700, size=8.5),
    FieldDef('loan_granted',    3, 200, 678, size=8.5),
    FieldDef('term',            3, 200, 656, size=8.5),
    FieldDef('interest_rate',   3, 200, 634, size=8.5),
    FieldDef('total_deduction', 3, 200, 568, size=8.5),
    FieldDef('net_proceeds',    3, 200, 546, size=8.5),
    FieldDef('prepared_by',     3, 200, 480, size=8.5),
])

# ── Grocery Loan ──────────────────────────────────────────────────────────
_reg('Grocery Loan', [
    FieldDef('date',            0, 445, 751, size=8.5),
    FieldDef('loan_no',         0, 155, 751, size=8.5),
    FieldDef('amount_in_words', 0,  90, 728, size=8.5, max_width=310),
    FieldDef('amount_applied',  0, 440, 728, size=8.5),
    FieldDef('term_months',     0, 155, 705, size=8.5),
    FieldDef('first_installment_date', 0, 340, 705, size=8.5),
    FieldDef('loan_purpose',    0,  90, 682, size=8.5, max_width=400),
    FieldDef('borrower_name',     0,  90, 655, size=8.5, max_width=250),
    FieldDef('net_take_home_pay', 0, 390, 655, size=8.5),
    FieldDef('complete_address',  0,  90, 633, size=8.5, max_width=350),
    FieldDef('contact_no',        0, 450, 633, size=8.5),
    FieldDef('emp_regular',   0,  90, 610, size=9, font='Helvetica-Bold'),
    FieldDef('emp_casual',    0, 185, 610, size=9, font='Helvetica-Bold'),
    FieldDef('emp_part_time', 0, 270, 610, size=9, font='Helvetica-Bold'),
    FieldDef('emp_job_order', 0, 360, 610, size=9, font='Helvetica-Bold'),
    # Promissory (page 1)
    FieldDef('promissory_amount',     1,  90, 720, size=8.5),
    FieldDef('date_granted',          1, 300, 720, size=8.5),
    FieldDef('amortization',          1,  90, 698, size=8.5),
    FieldDef('installment_due_every', 1, 300, 698, size=8.5),
    FieldDef('interest_amount',       1,  90, 676, size=8.5),
    FieldDef('maturity_date',         1, 300, 676, size=8.5),
    FieldDef('interest_rate',         1,  90, 654, size=8.5),
    FieldDef('number_of_installments',1, 300, 654, size=8.5),
    FieldDef('installment_amount',    1,  90, 632, size=8.5),
    FieldDef('borrower_name',         1,  90, 200, size=8.5, max_width=200),
    FieldDef('generated_date',        1, 400, 200, size=8.5),
    # Disclosure (page 2)
    FieldDef('kind_of_loan',    2, 200, 700, size=8.5),
    FieldDef('loan_granted',    2, 200, 678, size=8.5),
    FieldDef('term',            2, 200, 656, size=8.5),
    FieldDef('interest_rate',   2, 200, 634, size=8.5),
    FieldDef('total_deduction', 2, 200, 568, size=8.5),
    FieldDef('net_proceeds',    2, 200, 546, size=8.5),
    FieldDef('prepared_by',     2, 200, 480, size=8.5),
])

# ── Loan Against Deposit (LAD) ────────────────────────────────────────────
_reg('Loan Against Deposit', [
    FieldDef('date',    0, 445, 751, size=8.5),
    FieldDef('loan_no', 0, 155, 751, size=8.5),
    FieldDef('borrower_name',     0,  90, 720, size=8.5, max_width=260),
    FieldDef('amount_applied',    0, 380, 720, size=8.5),
    FieldDef('complete_address',  0,  90, 698, size=8.5, max_width=350),
    FieldDef('contact_no',        0, 450, 698, size=8.5),
    FieldDef('emp_regular',   0,  90, 675, size=9, font='Helvetica-Bold'),
    FieldDef('emp_casual',    0, 185, 675, size=9, font='Helvetica-Bold'),
    FieldDef('emp_part_time', 0, 270, 675, size=9, font='Helvetica-Bold'),
    FieldDef('emp_job_order', 0, 360, 675, size=9, font='Helvetica-Bold'),
    FieldDef('age',           0, 110, 653, size=8.5),
    FieldDef('birthday',      0, 220, 653, size=8.5),
    FieldDef('civil_status',  0, 370, 653, size=8.5),
    FieldDef('tin',           0, 490, 653, size=8.5),
    FieldDef('net_take_home_pay',  0, 300, 630, size=8.5),
    FieldDef('savings_deposit_amount', 0, 450, 608, size=8.5),
    # Promissory (page 1)
    FieldDef('promissory_amount',     1,  90, 720, size=8.5),
    FieldDef('date_granted',          1, 300, 720, size=8.5),
    FieldDef('amortization',          1,  90, 698, size=8.5),
    FieldDef('installment_due_every', 1, 300, 698, size=8.5),
    FieldDef('interest_amount',       1,  90, 676, size=8.5),
    FieldDef('maturity_date',         1, 300, 676, size=8.5),
    FieldDef('interest_rate',         1,  90, 654, size=8.5),
    FieldDef('number_of_installments',1, 300, 654, size=8.5),
    FieldDef('installment_amount',    1,  90, 632, size=8.5),
    FieldDef('borrower_name',         1,  90, 200, size=8.5, max_width=200),
    FieldDef('generated_date',        1, 400, 200, size=8.5),
])

# ── Pamasahe Loan ─────────────────────────────────────────────────────────
_reg('Pamasahe Loan', [
    FieldDef('date',            0, 445, 751, size=8.5),
    FieldDef('loan_no',         0, 155, 751, size=8.5),
    FieldDef('amount_in_words', 0,  90, 728, size=8.5, max_width=310),
    FieldDef('amount_applied',  0, 440, 728, size=8.5),
    FieldDef('term_months',     0, 155, 705, size=8.5),
    FieldDef('first_installment_date', 0, 340, 705, size=8.5),
    FieldDef('loan_purpose',    0,  90, 682, size=8.5, max_width=400),
    FieldDef('borrower_name',     0,  90, 655, size=8.5, max_width=250),
    FieldDef('net_take_home_pay', 0, 390, 655, size=8.5),
    FieldDef('complete_address',  0,  90, 633, size=8.5, max_width=350),
    FieldDef('contact_no',        0, 450, 633, size=8.5),
    FieldDef('emp_regular',   0,  90, 610, size=9, font='Helvetica-Bold'),
    FieldDef('emp_casual',    0, 185, 610, size=9, font='Helvetica-Bold'),
    FieldDef('emp_part_time', 0, 270, 610, size=9, font='Helvetica-Bold'),
    FieldDef('emp_job_order', 0, 360, 610, size=9, font='Helvetica-Bold'),
    # Promissory (page 1)
    FieldDef('promissory_amount',     1,  90, 720, size=8.5),
    FieldDef('date_granted',          1, 300, 720, size=8.5),
    FieldDef('amortization',          1,  90, 698, size=8.5),
    FieldDef('installment_due_every', 1, 300, 698, size=8.5),
    FieldDef('maturity_date',         1, 300, 676, size=8.5),
    FieldDef('interest_rate',         1,  90, 654, size=8.5),
    FieldDef('installment_amount',    1,  90, 632, size=8.5),
    FieldDef('borrower_name',         1,  90, 200, size=8.5, max_width=200),
    FieldDef('generated_date',        1, 400, 200, size=8.5),
    # Disclosure (page 2)
    FieldDef('kind_of_loan',    2, 200, 700, size=8.5),
    FieldDef('loan_granted',    2, 200, 678, size=8.5),
    FieldDef('term',            2, 200, 656, size=8.5),
    FieldDef('net_proceeds',    2, 200, 546, size=8.5),
    FieldDef('prepared_by',     2, 200, 480, size=8.5),
])

# ── Petty Cash ────────────────────────────────────────────────────────────
_reg('Petty Cash', [
    FieldDef('date',            0, 445, 751, size=8.5),
    FieldDef('loan_no',         0, 155, 751, size=8.5),
    FieldDef('amount_in_words', 0,  90, 728, size=8.5, max_width=310),
    FieldDef('amount_applied',  0, 440, 728, size=8.5),
    FieldDef('term_months',     0, 155, 705, size=8.5),
    FieldDef('first_installment_date', 0, 340, 705, size=8.5),
    FieldDef('loan_purpose',    0,  90, 682, size=8.5, max_width=400),
    FieldDef('borrower_name',     0,  90, 655, size=8.5, max_width=250),
    FieldDef('net_take_home_pay', 0, 390, 655, size=8.5),
    FieldDef('complete_address',  0,  90, 633, size=8.5, max_width=350),
    FieldDef('contact_no',        0, 450, 633, size=8.5),
    FieldDef('emp_permanent', 0,  90, 610, size=9, font='Helvetica-Bold'),
    FieldDef('emp_temporary', 0, 175, 610, size=9, font='Helvetica-Bold'),
    FieldDef('emp_casual',    0, 260, 610, size=9, font='Helvetica-Bold'),
    FieldDef('emp_part_time', 0, 345, 610, size=9, font='Helvetica-Bold'),
    FieldDef('emp_job_order', 0, 430, 610, size=9, font='Helvetica-Bold'),
    FieldDef('date_of_birth', 0, 110, 588, size=8.5),
    FieldDef('age',           0, 280, 588, size=8.5),
    FieldDef('civil_status',  0, 370, 588, size=8.5),
    FieldDef('tin',           0, 490, 588, size=8.5),
    # Promissory (page 1)
    FieldDef('promissory_amount',     1,  90, 720, size=8.5),
    FieldDef('date_granted',          1, 300, 720, size=8.5),
    FieldDef('amortization',          1,  90, 698, size=8.5),
    FieldDef('installment_due_every', 1, 300, 698, size=8.5),
    FieldDef('interest_amount',       1,  90, 676, size=8.5),
    FieldDef('maturity_date',         1, 300, 676, size=8.5),
    FieldDef('interest_rate',         1,  90, 654, size=8.5),
    FieldDef('number_of_installments',1, 300, 654, size=8.5),
    FieldDef('installment_amount',    1,  90, 632, size=8.5),
    FieldDef('borrower_name',         1,  90, 200, size=8.5, max_width=200),
    FieldDef('generated_date',        1, 400, 200, size=8.5),
])

# ── Regular Loan ──────────────────────────────────────────────────────────
_reg('Regular Loan', [
    FieldDef('date',            0, 445, 751, size=8.5),
    FieldDef('loan_no',         0, 155, 751, size=8.5),
    FieldDef('amount_in_words', 0,  90, 728, size=8.5, max_width=310),
    FieldDef('amount_applied',  0, 440, 728, size=8.5),
    FieldDef('term_months',     0, 155, 705, size=8.5),
    FieldDef('first_installment_date', 0, 340, 705, size=8.5),
    FieldDef('purpose_enrolment', 0,  90, 682, size=9, font='Helvetica-Bold'),
    FieldDef('purpose_house',     0, 200, 682, size=9, font='Helvetica-Bold'),
    FieldDef('purpose_hospital',  0, 310, 682, size=9, font='Helvetica-Bold'),
    FieldDef('purpose_other',     0, 420, 682, size=9, font='Helvetica-Bold'),
    FieldDef('borrower_name',       0,  90, 655, size=8.5, max_width=250),
    FieldDef('net_take_home_pay',   0, 390, 655, size=8.5),
    FieldDef('complete_address',    0,  90, 633, size=8.5, max_width=350),
    FieldDef('contact_no',          0, 450, 633, size=8.5),
    FieldDef('emp_permanent', 0,  90, 610, size=9, font='Helvetica-Bold'),
    FieldDef('emp_temporary', 0, 175, 610, size=9, font='Helvetica-Bold'),
    FieldDef('emp_casual',    0, 260, 610, size=9, font='Helvetica-Bold'),
    FieldDef('emp_part_time', 0, 345, 610, size=9, font='Helvetica-Bold'),
    FieldDef('emp_job_order', 0, 430, 610, size=9, font='Helvetica-Bold'),
    FieldDef('date_of_birth', 0, 110, 588, size=8.5),
    FieldDef('age',           0, 280, 588, size=8.5),
    FieldDef('civil_status',  0, 370, 588, size=8.5),
    FieldDef('tin',           0, 490, 588, size=8.5),
    # Page 1 – Committee
    FieldDef('committee_meeting_date', 1, 250, 720, size=8.5),
    FieldDef('remarks_conditions',     1, 100, 650, size=8.5, max_width=400),
    FieldDef('approver_1_name',        1, 100, 580, size=8.5),
    FieldDef('approver_2_name',        1, 240, 580, size=8.5),
    FieldDef('approver_3_name',        1, 390, 580, size=8.5),
    FieldDef('share_capital_as_of_date', 1, 300, 520, size=8.5),
    FieldDef('share_capital_amount',     1, 450, 520, size=8.5),
    FieldDef('savings_deposit_amount',   1, 450, 498, size=8.5),
    FieldDef('loan_balance_as_of_date',  1, 300, 476, size=8.5),
    FieldDef('loan_balance_amount',      1, 450, 476, size=8.5),
    FieldDef('passbook_no',              1, 300, 454, size=8.5),
    # Page 2 – Promissory Note
    FieldDef('promissory_amount',      2,  90, 720, size=8.5),
    FieldDef('date_granted',           2, 300, 720, size=8.5),
    FieldDef('amortization',           2,  90, 698, size=8.5),
    FieldDef('installment_due_every',  2, 300, 698, size=8.5),
    FieldDef('interest_amount',        2,  90, 676, size=8.5),
    FieldDef('maturity_date',          2, 300, 676, size=8.5),
    FieldDef('interest_rate',          2,  90, 654, size=8.5),
    FieldDef('number_of_installments', 2, 300, 654, size=8.5),
    FieldDef('installment_amount',     2,  90, 632, size=8.5),
    FieldDef('borrower_name',          2,  90, 200, size=8.5, max_width=150),
    FieldDef('co_maker_1_name',        2, 250, 200, size=8.5, max_width=130),
    FieldDef('co_maker_2_name',        2, 400, 200, size=8.5, max_width=130),
    FieldDef('generated_date',         2, 430, 170, size=8.5),
    # Page 3 – Disclosure
    FieldDef('kind_of_loan',    3, 200, 700, size=8.5),
    FieldDef('loan_granted',    3, 200, 678, size=8.5),
    FieldDef('term',            3, 200, 656, size=8.5),
    FieldDef('interest_rate',   3, 200, 634, size=8.5),
    FieldDef('interest_amount', 3, 200, 612, size=8.5),
    FieldDef('total_deduction', 3, 200, 568, size=8.5),
    FieldDef('net_proceeds',    3, 200, 546, size=8.5),
    FieldDef('prepared_by',     3, 200, 480, size=8.5),
    FieldDef('borrower_name',   3,  90, 420, size=8.5, max_width=200),
])

# ── Rice Loan ─────────────────────────────────────────────────────────────
_reg('Rice Loan', [
    FieldDef('date',            0, 445, 751, size=8.5),
    FieldDef('loan_no',         0, 155, 751, size=8.5),
    FieldDef('amount_in_words', 0,  90, 728, size=8.5, max_width=310),
    FieldDef('amount_applied',  0, 440, 728, size=8.5),
    FieldDef('term_months',     0, 155, 705, size=8.5),
    FieldDef('first_installment_date', 0, 340, 705, size=8.5),
    FieldDef('loan_purpose',    0,  90, 682, size=8.5, max_width=400),
    FieldDef('borrower_name',     0,  90, 655, size=8.5, max_width=250),
    FieldDef('net_take_home_pay', 0, 390, 655, size=8.5),
    FieldDef('complete_address',  0,  90, 633, size=8.5, max_width=350),
    FieldDef('contact_no',        0, 450, 633, size=8.5),
    FieldDef('emp_regular',   0,  90, 610, size=9, font='Helvetica-Bold'),
    FieldDef('emp_casual',    0, 185, 610, size=9, font='Helvetica-Bold'),
    FieldDef('emp_part_time', 0, 270, 610, size=9, font='Helvetica-Bold'),
    FieldDef('emp_job_order', 0, 360, 610, size=9, font='Helvetica-Bold'),
    # Promissory (page 1)
    FieldDef('promissory_amount',     1,  90, 720, size=8.5),
    FieldDef('date_granted',          1, 300, 720, size=8.5),
    FieldDef('amortization',          1,  90, 698, size=8.5),
    FieldDef('installment_due_every', 1, 300, 698, size=8.5),
    FieldDef('maturity_date',         1, 300, 676, size=8.5),
    FieldDef('interest_rate',         1,  90, 654, size=8.5),
    FieldDef('installment_amount',    1,  90, 632, size=8.5),
    FieldDef('borrower_name',         1,  90, 200, size=8.5, max_width=200),
    FieldDef('co_maker_1_name',       1, 270, 200, size=8.5, max_width=180),
    FieldDef('generated_date',        1, 400, 170, size=8.5),
    # Disclosure (page 2)
    FieldDef('kind_of_loan',    2, 200, 700, size=8.5),
    FieldDef('loan_granted',    2, 200, 678, size=8.5),
    FieldDef('term',            2, 200, 656, size=8.5),
    FieldDef('net_proceeds',    2, 200, 546, size=8.5),
    FieldDef('prepared_by',     2, 200, 480, size=8.5),
])


# ---------------------------------------------------------------------------
# Core overlay engine
# ---------------------------------------------------------------------------

def _build_overlay(fields_for_page: list[FieldDef], data: dict,
                   page_width: float, page_height: float) -> io.BytesIO:
    """
    Render a single transparent overlay page using ReportLab.
    Returns a BytesIO containing a single-page PDF.
    """
    buf = io.BytesIO()
    c = rl_canvas.Canvas(buf, pagesize=(page_width, page_height))
    c.setFillColorRGB(0, 0, 0)  # black text

    for fdef in fields_for_page:
        value = data.get(fdef.key, '')
        if not value:
            continue

        if DEBUG_COORDS:
            # Draw a small red anchor dot so you can calibrate positions
            c.setFillColorRGB(1, 0, 0)
            c.circle(fdef.x, fdef.y, 2, fill=1, stroke=0)
            c.setFillColorRGB(0, 0, 0)

        font_name = fdef.font
        c.setFont(font_name, fdef.size)

        text = str(value)
        if fdef.max_width:
            # Trim text to fit within max_width
            while text and c.stringWidth(text, font_name, fdef.size) > fdef.max_width:
                text = text[:-1]

        c.drawString(fdef.x, fdef.y, text)

    c.save()
    buf.seek(0)
    return buf


class FormOverlayPDFService:
    """
    Generates the final loan application PDF by overlaying filled data
    onto the cooperative's original physical form template.
    """

    @classmethod
    def has_template(cls, loan_name: str) -> bool:
        """Return True if a template PDF exists for this loan type."""
        if not PYPDF_AVAILABLE:
            return False
        fname = TEMPLATE_FILES.get(loan_name)
        if not fname:
            return False
        return os.path.isfile(os.path.join(FORMS_DIR, fname))

    @classmethod
    def generate_pdf(cls, application) -> io.BytesIO:
        """
        Overlay application data onto the original form template.
        Returns a BytesIO of the merged PDF.
        Raises ValueError if no template is available.
        """
        if not PYPDF_AVAILABLE:
            raise RuntimeError("pypdf is not installed.  Run: pip install pypdf>=4.0.0")

        loan_name = application.loan_type.loan_name if application.loan_type else ''
        template_file = TEMPLATE_FILES.get(loan_name)
        if not template_file:
            raise ValueError(f"No template configured for loan type: {loan_name!r}")

        template_path = os.path.join(FORMS_DIR, template_file)
        if not os.path.isfile(template_path):
            raise FileNotFoundError(f"Template not found: {template_path}")

        # Extract all field values from the application
        data = extract_data(application)

        # Group FieldDefs by page index
        field_map = FIELD_MAPS.get(loan_name, [])
        pages_needed: dict[int, list[FieldDef]] = {}
        for fdef in field_map:
            pages_needed.setdefault(fdef.page, []).append(fdef)

        # Read the template
        template_reader = PdfReader(template_path)
        writer = PdfWriter()

        for page_idx, template_page in enumerate(template_reader.pages):
            # Get page dimensions from the template
            media_box = template_page.mediabox
            pw = float(media_box.width)
            ph = float(media_box.height)

            if page_idx in pages_needed:
                # Build transparent overlay and merge onto template page
                overlay_buf = _build_overlay(pages_needed[page_idx], data, pw, ph)
                overlay_reader = PdfReader(overlay_buf)
                overlay_page = overlay_reader.pages[0]
                template_page.merge_page(overlay_page)

            writer.add_page(template_page)

        # Add a generated-on stamp to the last page
        cls._stamp_last_page(writer, application)

        out = io.BytesIO()
        writer.write(out)
        out.seek(0)
        return out

    # -----------------------------------------------------------------------

    @classmethod
    def _stamp_last_page(cls, writer: 'PdfWriter', application) -> None:
        """Append a small stamp line to the last page."""
        try:
            last_page = writer.pages[-1]
            media_box = last_page.mediabox
            pw = float(media_box.width)

            stamp_buf = io.BytesIO()
            c = rl_canvas.Canvas(stamp_buf, pagesize=(pw, float(media_box.height)))
            c.setFont('Helvetica', 6.5)
            c.setFillColorRGB(0.4, 0.4, 0.4)
            stamp = (
                f"APP-{application.id:06d}  |  "
                f"Generated: {datetime.now().strftime('%B %d, %Y  %I:%M %p')}  |  "
                "Computer-generated document"
            )
            c.drawString(28, 18, stamp)
            c.save()
            stamp_buf.seek(0)

            stamp_reader = PdfReader(stamp_buf)
            last_page.merge_page(stamp_reader.pages[0])
        except Exception as exc:
            logger.warning("Could not stamp last page: %s", exc)
