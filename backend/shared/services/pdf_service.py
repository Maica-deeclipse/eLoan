"""
PDF Generation Service – Loan Application Form

Generates a pre-filled loan application form that mirrors the paper format.
Uses ReportLab to lay out every section exactly as it appears on the physical form.

Downloadable from "Submitted" status onwards so applicants can print/share
a copy of their completed application.
"""

import io
import logging
from datetime import datetime

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch, cm
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    HRFlowable, KeepTogether
)
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT, TA_JUSTIFY

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Colours (tweak to match your coop's branding)
# ---------------------------------------------------------------------------
C_DARK_BLUE   = colors.HexColor('#1a3a5c')
C_MID_BLUE    = colors.HexColor('#2e6da4')
C_LIGHT_BLUE  = colors.HexColor('#d6e8f7')
C_LIGHT_GRAY  = colors.HexColor('#f5f5f5')
C_BORDER      = colors.HexColor('#b0b0b0')
C_SECTION_BG  = colors.HexColor('#e8f0f8')
C_WHITE       = colors.white
C_BLACK       = colors.black


def _val(v, fallback='N/A'):
    """Return a printable string or fallback if value is None/empty."""
    if v is None:
        return fallback
    s = str(v).strip()
    return s if s else fallback


def _money(v, fallback='N/A'):
    """Format a Decimal/float as Philippine Peso string."""
    try:
        return f"PHP {float(v):,.2f}"
    except (TypeError, ValueError):
        return fallback


class LoanApplicationPDFService:
    """
    Generates a pre-filled loan application form PDF.

    Usage:
        if LoanApplicationPDFService.can_download(application):
            buf  = LoanApplicationPDFService.generate_pdf(application)
            name = LoanApplicationPDFService.get_filename(application)
    """

    # Allow download once the application has been submitted
    DOWNLOADABLE_STATUSES = [
        'Submitted',
        'Verified by Bookkeeper',
        'Pending Treasurer Review',
        'Recommended by Treasurer',
        'Pending Credit Committee',
        'Approved by Credit Committee',
        'Disbursed',
        'Paid',
    ]

    # -----------------------------------------------------------------------
    # Public API
    # -----------------------------------------------------------------------

    @classmethod
    def can_download(cls, application):
        if not application.current_status:
            return False
        return application.current_status.status_name in cls.DOWNLOADABLE_STATUSES

    @classmethod
    def get_filename(cls, application):
        date_str = datetime.now().strftime('%Y%m%d')
        return f"LoanApplication_APP-{application.id:06d}_{date_str}.pdf"

    @classmethod
    def generate_pdf(cls, application):
        """Return a BytesIO containing the filled loan application form PDF.

        Attempts to use the template-overlay service first (copies the original
        physical form layout). Falls back to the generic branded layout when no
        template PDF is available for the loan type.
        """
        loan_name = application.loan_type.loan_name if application.loan_type else ''
        try:
            from shared.services.form_overlay_pdf_service import FormOverlayPDFService
            if FormOverlayPDFService.has_template(loan_name):
                return FormOverlayPDFService.generate_pdf(application)
        except Exception as exc:
            logger.warning(
                "Overlay PDF failed for loan type '%s' (app %s), falling back to generic layout: %s",
                loan_name, application.id, exc,
            )

        # --- Generic branded fallback ---
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            rightMargin=0.65 * inch,
            leftMargin=0.65 * inch,
            topMargin=0.6 * inch,
            bottomMargin=0.6 * inch,
        )

        styles = cls._styles()
        story  = []

        story += cls._header(application, styles)
        story += cls._section_loan_info(application, styles)
        story += cls._section_personal_info(application, styles)
        story += cls._section_employment(application, styles)
        story += cls._section_emergency_contact(application, styles)
        if application.comakers.exists():
            story += cls._section_comakers(application, styles)
        story += cls._section_loan_computation(application, styles)
        story += cls._section_declaration(application, styles)
        story += cls._section_office_use(application, styles)
        story += cls._footer(application, styles)

        doc.build(story)
        buffer.seek(0)
        return buffer

    # -----------------------------------------------------------------------
    # Styles
    # -----------------------------------------------------------------------

    @classmethod
    def _styles(cls):
        base = getSampleStyleSheet()

        def add(name, parent='Normal', **kw):
            base.add(ParagraphStyle(name=name, parent=base[parent], **kw))

        add('CoopName',  parent='Normal',
            fontSize=14, fontName='Helvetica-Bold',
            alignment=TA_CENTER, textColor=C_DARK_BLUE, spaceAfter=1)
        add('CoopSub',   parent='Normal',
            fontSize=9,  fontName='Helvetica',
            alignment=TA_CENTER, textColor=C_MID_BLUE, spaceAfter=2)
        add('FormTitle', parent='Normal',
            fontSize=13, fontName='Helvetica-Bold',
            alignment=TA_CENTER, textColor=C_WHITE, spaceAfter=0)
        add('SectionHdr', parent='Normal',
            fontSize=9,  fontName='Helvetica-Bold',
            textColor=C_WHITE, spaceBefore=0, spaceAfter=0)
        add('FieldLbl',  parent='Normal',
            fontSize=7.5, fontName='Helvetica', textColor=colors.HexColor('#555'))
        add('FieldVal',  parent='Normal',
            fontSize=9.5, fontName='Helvetica-Bold', textColor=C_BLACK)
        add('SmallNote', parent='Normal',
            fontSize=7.5, fontName='Helvetica', textColor=colors.grey)
        add('FooterTxt', parent='Normal',
            fontSize=7,  fontName='Helvetica',
            alignment=TA_CENTER, textColor=colors.grey)
        add('Justify',   parent='Normal',
            fontSize=8.5, fontName='Helvetica',
            alignment=TA_JUSTIFY, leading=13)

        return base

    # -----------------------------------------------------------------------
    # Header / Letterhead
    # -----------------------------------------------------------------------

    @classmethod
    def _header(cls, app, s):
        els = []

        # Coop letterhead
        els.append(Paragraph("BUKSU EMPLOYEES MULTI-PURPOSE COOPERATIVE", s['CoopName']))
        els.append(Paragraph("Bukidnon State University, Malaybalay City, Bukidnon", s['CoopSub']))
        els.append(Paragraph("Tel. No.: (088) 813-5661 | Email: buksuempco@buksu.edu.ph", s['CoopSub']))
        els.append(Spacer(1, 4))
        els.append(HRFlowable(width="100%", thickness=1.5, color=C_DARK_BLUE))
        els.append(Spacer(1, 3))

        # Coloured title bar
        title_tbl = Table(
            [[Paragraph("LOAN APPLICATION FORM", s['FormTitle'])]],
            colWidths=['100%'],
        )
        title_tbl.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), C_DARK_BLUE),
            ('TOPPADDING',    (0, 0), (-1, -1), 7),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 7),
        ]))
        els.append(title_tbl)
        els.append(Spacer(1, 6))

        # App number / date row
        app_no   = f"APP-{app.id:06d}"
        app_date = app.application_date.strftime('%B %d, %Y') if app.application_date else 'N/A'
        status   = _val(app.current_status.status_name if app.current_status else None)

        meta = Table(
            [
                [
                    Paragraph(f"<b>Application No.:</b> {app_no}", s['FieldVal']),
                    Paragraph(f"<b>Date:</b> {app_date}", s['FieldVal']),
                    Paragraph(f"<b>Status:</b> {status}", s['FieldVal']),
                ]
            ],
            colWidths=[2.3*inch, 2.3*inch, 2.3*inch],
        )
        meta.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), C_LIGHT_BLUE),
            ('BOX',        (0, 0), (-1, -1), 0.5, C_BORDER),
            ('INNERGRID',  (0, 0), (-1, -1), 0.5, C_BORDER),
            ('PADDING',    (0, 0), (-1, -1), 5),
        ]))
        els.append(meta)
        els.append(Spacer(1, 8))

        return els

    # -----------------------------------------------------------------------
    # Section helpers
    # -----------------------------------------------------------------------

    @classmethod
    def _section_header_row(cls, title, s):
        """Returns a single-row Table that acts as a section heading bar."""
        t = Table(
            [[Paragraph(f"  {title}", s['SectionHdr'])]],
            colWidths=['100%'],
        )
        t.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), C_DARK_BLUE),
            ('TOPPADDING',    (0, 0), (-1, -1), 5),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ]))
        return t

    @classmethod
    def _field_row(cls, label, value, s):
        """Return [label_paragraph, value_paragraph] for use inside a table cell."""
        return [
            Paragraph(label, s['FieldLbl']),
            Paragraph(_val(value), s['FieldVal']),
        ]

    @classmethod
    def _two_col_table(cls, rows_left, rows_right, s, col_label=1.4*inch, col_val=1.5*inch):
        """
        Build a bordered 4-column table: [lbl | val | lbl | val]
        rows_left / rows_right are lists of (label, value) tuples.
        Pairs are zipped; if one side is shorter the row is left blank.
        """
        max_rows = max(len(rows_left), len(rows_right))
        data = []
        for i in range(max_rows):
            ll, lv = rows_left[i]  if i < len(rows_left)  else ('', '')
            rl, rv = rows_right[i] if i < len(rows_right) else ('', '')
            data.append([
                Paragraph(ll, s['FieldLbl']),
                Paragraph(_val(lv), s['FieldVal']),
                Paragraph(rl, s['FieldLbl']),
                Paragraph(_val(rv), s['FieldVal']),
            ])

        w = col_label
        v = col_val
        tbl = Table(data, colWidths=[w, v, w, v])
        tbl.setStyle(TableStyle([
            ('BOX',       (0, 0), (-1, -1), 0.5, C_BORDER),
            ('INNERGRID', (0, 0), (-1, -1), 0.3, C_BORDER),
            ('PADDING',   (0, 0), (-1, -1), 4),
            ('VALIGN',    (0, 0), (-1, -1), 'TOP'),
            ('ROWBACKGROUNDS', (0, 0), (-1, -1), [C_WHITE, C_LIGHT_GRAY]),
        ]))
        return tbl

    @classmethod
    def _one_col_table(cls, rows, s, lbl_w=1.8*inch):
        """Build a two-column [label | value] table."""
        data = [
            [Paragraph(lbl, s['FieldLbl']), Paragraph(_val(val), s['FieldVal'])]
            for lbl, val in rows
        ]
        avail = 6.9 * inch
        tbl = Table(data, colWidths=[lbl_w, avail - lbl_w])
        tbl.setStyle(TableStyle([
            ('BOX',       (0, 0), (-1, -1), 0.5, C_BORDER),
            ('INNERGRID', (0, 0), (-1, -1), 0.3, C_BORDER),
            ('PADDING',   (0, 0), (-1, -1), 4),
            ('VALIGN',    (0, 0), (-1, -1), 'TOP'),
            ('ROWBACKGROUNDS', (0, 0), (-1, -1), [C_WHITE, C_LIGHT_GRAY]),
        ]))
        return tbl

    # -----------------------------------------------------------------------
    # Section 1 – Loan Information
    # -----------------------------------------------------------------------

    @classmethod
    def _section_loan_info(cls, app, s):
        loan_type = _val(app.loan_type.loan_name if app.loan_type else None)
        amount    = _money(app.amount_requested)
        term      = f"{app.term_months} months" if app.term_months else 'N/A'
        purpose   = _val(app.purpose)
        interest  = (f"{app.loan_type.interest_rate}% p.a."
                     if app.loan_type and app.loan_type.interest_rate else 'N/A')

        left  = [('Loan Type:',   loan_type), ('Amount Requested:', amount), ('Interest Rate:', interest)]
        right = [('Term (months):', term),    ('Purpose:', purpose),         ('', '')]

        return [
            cls._section_header_row('I.  LOAN INFORMATION', s),
            cls._two_col_table(left, right, s, col_label=1.5*inch, col_val=1.95*inch),
            Spacer(1, 6),
        ]

    # -----------------------------------------------------------------------
    # Section 2 – Personal Information
    # -----------------------------------------------------------------------

    @classmethod
    def _section_personal_info(cls, app, s):
        user    = app.user
        profile = getattr(user, 'applicant_profile', None)

        full_name  = f"{_val(user.firstname)} {_val(user.lastname)}"
        emp_id     = _val(user.employee_id)
        email      = _val(user.email)
        contact    = _val(profile.contact_number    if profile else None)
        sec_contact= _val(profile.secondary_contact if profile else None)
        addr1      = _val(profile.address_line1     if profile else None)
        addr2      = _val(profile.address_line2     if profile else None)
        city       = _val(profile.city              if profile else None)
        province   = _val(profile.province          if profile else None)
        zip_code   = _val(profile.zip_code          if profile else None)
        full_addr  = _val(profile.full_address       if profile else None)

        left  = [
            ('Full Name:',       full_name),
            ('Email Address:',   email),
            ('Address Line 1:',  addr1),
            ('City / Municipality:', city),
        ]
        right = [
            ('Employee / Member No.:', emp_id),
            ('Contact No.:',      contact),
            ('Address Line 2:',   addr2),
            ('Province:',         province),
        ]

        rows = [
            ('Secondary Contact:', sec_contact),
            ('ZIP Code:',          zip_code),
            ('Complete Address:',  full_addr),
        ]

        return KeepTogether([
            cls._section_header_row('II.  PERSONAL INFORMATION', s),
            cls._two_col_table(left, right, s, col_label=1.55*inch, col_val=1.9*inch),
            cls._one_col_table(rows, s),
            Spacer(1, 6),
        ]),

    # -----------------------------------------------------------------------
    # Section 3 – Employment Information
    # -----------------------------------------------------------------------

    @classmethod
    def _section_employment(cls, app, s):
        profile = getattr(app.user, 'applicant_profile', None)

        employer    = _val(profile.employer_name    if profile else None)
        emp_addr    = _val(profile.employer_address if profile else None)
        position    = _val(profile.position         if profile else None)
        years       = _val(profile.years_employed   if profile else None)
        gross       = _money(profile.monthly_income if profile else None)
        net_sal     = _money(app.net_salary)

        left  = [('Employer / Agency:', employer), ('Position / Designation:', position), ('Monthly Gross Income:', gross)]
        right = [('Employer Address:',  emp_addr),  ('Years in Service:',       years),   ('Net Monthly Income:',  net_sal)]

        return KeepTogether([
            cls._section_header_row('III.  EMPLOYMENT INFORMATION', s),
            cls._two_col_table(left, right, s, col_label=1.7*inch, col_val=1.75*inch),
            Spacer(1, 6),
        ]),

    # -----------------------------------------------------------------------
    # Section 4 – Emergency Contact
    # -----------------------------------------------------------------------

    @classmethod
    def _section_emergency_contact(cls, app, s):
        profile = getattr(app.user, 'applicant_profile', None)

        name     = _val(profile.emergency_contact_name         if profile else None)
        contact  = _val(profile.emergency_contact_number       if profile else None)
        relation = _val(profile.emergency_contact_relationship if profile else None)

        left  = [('Emergency Contact Name:', name),    ('Relationship:', relation)]
        right = [('Contact Number:',          contact), ('',             '')]

        return KeepTogether([
            cls._section_header_row('IV.  EMERGENCY CONTACT', s),
            cls._two_col_table(left, right, s, col_label=1.7*inch, col_val=1.75*inch),
            Spacer(1, 6),
        ]),

    # -----------------------------------------------------------------------
    # Section 5 – Co-Makers
    # -----------------------------------------------------------------------

    @classmethod
    def _section_comakers(cls, app, s):
        header = [
            Paragraph('No.',        s['SectionHdr']),
            Paragraph('Full Name',  s['SectionHdr']),
            Paragraph('Relationship', s['SectionHdr']),
            Paragraph('Contact',    s['SectionHdr']),
            Paragraph('Employer',   s['SectionHdr']),
            Paragraph('Monthly Income', s['SectionHdr']),
        ]
        data = [header]

        for i, comaker in enumerate(app.comakers.all(), 1):
            info = getattr(comaker, 'detailed_info', None)
            if info:
                name     = _val(info.full_name)
                rel      = _val(info.relationship_to_applicant)
                contact  = _val(info.contact_number)
                employer = _val(info.employer_name)
                income   = _money(info.monthly_income)
            else:
                name     = f"{comaker.user.firstname} {comaker.user.lastname}"
                rel      = 'N/A'
                contact  = 'N/A'
                employer = 'N/A'
                income   = 'N/A'

            data.append([
                Paragraph(str(i), s['FieldVal']),
                Paragraph(name,     s['FieldVal']),
                Paragraph(rel,      s['FieldVal']),
                Paragraph(contact,  s['FieldVal']),
                Paragraph(employer, s['FieldVal']),
                Paragraph(income,   s['FieldVal']),
            ])

        tbl = Table(data, colWidths=[0.35*inch, 1.6*inch, 1.1*inch, 1.1*inch, 1.4*inch, 1.35*inch])
        tbl.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), C_DARK_BLUE),
            ('TEXTCOLOR',  (0, 0), (-1, 0), C_WHITE),
            ('BOX',        (0, 0), (-1, -1), 0.5, C_BORDER),
            ('INNERGRID',  (0, 0), (-1, -1), 0.3, C_BORDER),
            ('PADDING',    (0, 0), (-1, -1), 4),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [C_WHITE, C_LIGHT_GRAY]),
            ('ALIGN',      (0, 0), (0, -1), 'CENTER'),
        ]))

        return KeepTogether([
            cls._section_header_row('V.  CO-MAKER INFORMATION', s),
            tbl,
            Spacer(1, 6),
        ]),

    # -----------------------------------------------------------------------
    # Section 6 – Loan Computation Summary
    # -----------------------------------------------------------------------

    @classmethod
    def _section_loan_computation(cls, app, s):
        principal   = _money(app.amount_requested)
        interest    = (f"{app.loan_type.interest_rate}% per annum"
                       if app.loan_type and app.loan_type.interest_rate else 'N/A')
        term        = f"{app.term_months} months" if app.term_months else 'N/A'
        monthly     = _money(app.monthly_amortization)
        total_int   = 'N/A'
        if app.total_payable and app.amount_requested:
            try:
                total_int = _money(float(app.total_payable) - float(app.amount_requested))
            except Exception:
                pass
        total_pay   = _money(app.total_payable)

        rows = [
            ('Principal Amount:',    principal),
            ('Interest Rate:',       interest),
            ('Loan Term:',           term),
            ('Monthly Amortization:', monthly),
            ('Total Interest:',      total_int),
            ('Total Amount Payable:', total_pay),
        ]

        # Split into two visual columns
        mid = len(rows) // 2
        left  = [(l, v) for l, v in rows[:mid]]
        right = [(l, v) for l, v in rows[mid:]]

        return KeepTogether([
            cls._section_header_row('VI.  LOAN COMPUTATION', s),
            cls._two_col_table(left, right, s, col_label=1.75*inch, col_val=1.7*inch),
            Spacer(1, 6),
        ]),

    # -----------------------------------------------------------------------
    # Section 7 – Declaration / Certification
    # -----------------------------------------------------------------------

    @classmethod
    def _section_declaration(cls, app, s):
        user = app.user
        name = f"{user.firstname} {user.lastname}".upper()

        declaration = (
            f"I, <b>{name}</b>, hereby declare that all the information provided in this "
            "application is true, correct, and complete to the best of my knowledge. "
            "I authorize the Cooperative to verify any information herein, including "
            "my employment status and credit standing, for the purpose of evaluating "
            "this loan application. I agree to abide by the rules and regulations of "
            "the Cooperative and to repay the loan according to the agreed terms."
        )

        sig_row = Table(
            [
                [
                    Paragraph("Applicant's Signature over Printed Name:", s['FieldLbl']),
                    Paragraph("Date:", s['FieldLbl']),
                ],
                [
                    Paragraph(" " * 80 + "\n" + ("_" * 52), s['FieldVal']),
                    Paragraph("\n" + ("_" * 22), s['FieldVal']),
                ],
            ],
            colWidths=[4.5*inch, 2.4*inch],
        )
        sig_row.setStyle(TableStyle([
            ('PADDING',   (0, 0), (-1, -1), 6),
            ('BOX',       (0, 0), (-1, -1), 0.5, C_BORDER),
            ('INNERGRID', (0, 0), (-1, -1), 0.3, C_BORDER),
            ('BACKGROUND', (0, 0), (-1, -1), C_LIGHT_GRAY),
        ]))

        return KeepTogether([
            cls._section_header_row('VII.  DECLARATION OF APPLICANT', s),
            Paragraph(declaration, s['Justify']),
            Spacer(1, 8),
            sig_row,
            Spacer(1, 8),
        ]),

    # -----------------------------------------------------------------------
    # Section 8 – For Office Use Only
    # -----------------------------------------------------------------------

    @classmethod
    def _section_office_use(cls, app, s):
        # Pull staff review info from status change logs
        def get_reviewer(role_label):
            """Try to find who set the relevant status."""
            from loans.models import StatusChangeLog
            log = StatusChangeLog.objects.filter(
                application=app,
                changed_by_role=role_label,
            ).order_by('-changed_at').first()
            if log and log.changed_by:
                full = f"{log.changed_by.firstname} {log.changed_by.lastname}"
                date = log.changed_at.strftime('%m/%d/%Y')
                return full, date
            return '', ''

        bk_name, bk_date = get_reviewer('Bookkeeper')
        tr_name, tr_date = get_reviewer('Treasurer')
        cc_name, cc_date = get_reviewer('Credit Committee')

        def officer_block(title, name, date):
            return [
                Paragraph(title, s['FieldLbl']),
                Paragraph(_val(name), s['FieldVal']),
                Paragraph("Date: " + _val(date), s['SmallNote']),
                Paragraph("\n" + "_" * 28, s['SmallNote']),
                Paragraph("Signature over Printed Name", s['SmallNote']),
            ]

        office_data = [
            [
                [Table([[Paragraph("BOOKKEEPER VERIFICATION", s['FieldLbl'])]], colWidths=['100%'])] +
                [Paragraph(f"Name: {_val(bk_name)}", s['FieldVal'])] +
                [Paragraph(f"Date: {_val(bk_date)}", s['SmallNote'])] +
                [Spacer(0, 8)] +
                [Paragraph("__________________________", s['SmallNote'])] +
                [Paragraph("Signature / Stamp", s['SmallNote'])],

                [Table([[Paragraph("TREASURER EVALUATION", s['FieldLbl'])]], colWidths=['100%'])] +
                [Paragraph(f"Name: {_val(tr_name)}", s['FieldVal'])] +
                [Paragraph(f"Date: {_val(tr_date)}", s['SmallNote'])] +
                [Spacer(0, 8)] +
                [Paragraph("__________________________", s['SmallNote'])] +
                [Paragraph("Signature / Stamp", s['SmallNote'])],

                [Table([[Paragraph("CREDIT COMMITTEE DECISION", s['FieldLbl'])]], colWidths=['100%'])] +
                [Paragraph(f"Name: {_val(cc_name)}", s['FieldVal'])] +
                [Paragraph(f"Date: {_val(cc_date)}", s['SmallNote'])] +
                [Spacer(0, 8)] +
                [Paragraph("__________________________", s['SmallNote'])] +
                [Paragraph("Signature / Stamp", s['SmallNote'])],
            ]
        ]

        office_tbl = Table(office_data, colWidths=[2.3*inch, 2.3*inch, 2.3*inch])
        office_tbl.setStyle(TableStyle([
            ('BOX',       (0, 0), (-1, -1), 0.5, C_BORDER),
            ('INNERGRID', (0, 0), (-1, -1), 0.5, C_BORDER),
            ('PADDING',   (0, 0), (-1, -1), 8),
            ('VALIGN',    (0, 0), (-1, -1), 'TOP'),
            ('BACKGROUND', (0, 0), (-1, -1), C_LIGHT_GRAY),
        ]))

        return KeepTogether([
            cls._section_header_row('VIII.  FOR OFFICE USE ONLY', s),
            office_tbl,
            Spacer(1, 6),
        ]),

    # -----------------------------------------------------------------------
    # Footer
    # -----------------------------------------------------------------------

    @classmethod
    def _footer(cls, app, s):
        app_no  = f"APP-{app.id:06d}"
        gen_str = datetime.now().strftime('%B %d, %Y  %I:%M %p')

        return [
            HRFlowable(width="100%", thickness=0.8, color=C_BORDER),
            Spacer(1, 3),
            Paragraph(
                f"Application No.: {app_no}  |  Document generated on {gen_str}  |  "
                "This is a computer-generated document.",
                s['FooterTxt'],
            ),
        ]
