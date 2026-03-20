"""
PDF Generation Service for Loan Applications

Uses ReportLab to generate professional PDF documents.
This service is shared across applicant and bookkeeper modules.
"""

import io
from datetime import datetime

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    HRFlowable
)
from reportlab.lib.enums import TA_CENTER, TA_LEFT


class LoanApplicationPDFService:
    """
    Service for generating PDF documents of loan applications.

    Usage:
        if LoanApplicationPDFService.can_download(application):
            pdf_buffer = LoanApplicationPDFService.generate_pdf(application)
            filename = LoanApplicationPDFService.get_filename(application)
    """

    # Approved statuses that allow PDF download
    APPROVED_STATUSES = ['Approved by Credit Committee', 'Disbursed', 'Paid']

    @classmethod
    def can_download(cls, application):
        """
        Check if application is in an approved status that allows PDF download.

        Args:
            application: LoanApplication instance

        Returns:
            bool: True if PDF can be downloaded
        """
        if not application.current_status:
            return False
        return application.current_status.status_name in cls.APPROVED_STATUSES

    @classmethod
    def generate_pdf(cls, application):
        """
        Generate PDF document for a loan application.

        Args:
            application: LoanApplication instance with related data

        Returns:
            BytesIO: PDF document as bytes buffer
        """
        buffer = io.BytesIO()

        # Create document
        doc = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            rightMargin=0.75*inch,
            leftMargin=0.75*inch,
            topMargin=0.75*inch,
            bottomMargin=0.75*inch
        )

        # Build content
        story = []
        styles = cls._get_styles()

        # Header
        story.extend(cls._build_header(application, styles))

        # Application Summary
        story.extend(cls._build_application_summary(application, styles))

        # Applicant Information
        story.extend(cls._build_applicant_info(application, styles))

        # Loan Purpose
        story.extend(cls._build_loan_purpose(application, styles))

        # Co-Makers (if any)
        if application.comakers.exists():
            story.extend(cls._build_comakers_section(application, styles))

        # Approval Information
        story.extend(cls._build_approval_info(application, styles))

        # Footer
        story.extend(cls._build_footer(styles))

        # Build PDF
        doc.build(story)
        buffer.seek(0)

        return buffer

    @classmethod
    def get_filename(cls, application):
        """
        Generate filename for the PDF.

        Args:
            application: LoanApplication instance

        Returns:
            str: Filename for the PDF
        """
        return f"LoanApplication_APP-{application.id:06d}_{datetime.now().strftime('%Y%m%d')}.pdf"

    @classmethod
    def _get_styles(cls):
        """Get custom paragraph styles."""
        styles = getSampleStyleSheet()

        # Document title
        styles.add(ParagraphStyle(
            name='DocumentTitle',
            parent=styles['Heading1'],
            fontSize=18,
            alignment=TA_CENTER,
            spaceAfter=5
        ))

        # Subtitle
        styles.add(ParagraphStyle(
            name='Subtitle',
            parent=styles['Heading2'],
            fontSize=12,
            alignment=TA_CENTER,
            textColor=colors.HexColor('#4a5568'),
            spaceAfter=20
        ))

        # Section title
        styles.add(ParagraphStyle(
            name='SectionTitle',
            parent=styles['Heading2'],
            fontSize=12,
            textColor=colors.HexColor('#1a365d'),
            spaceBefore=15,
            spaceAfter=10
        ))

        # Field value
        styles.add(ParagraphStyle(
            name='FieldValue',
            parent=styles['Normal'],
            fontSize=10,
            spaceBefore=2,
            spaceAfter=8
        ))

        # Footer
        styles.add(ParagraphStyle(
            name='Footer',
            parent=styles['Normal'],
            fontSize=8,
            textColor=colors.grey,
            alignment=TA_CENTER
        ))

        return styles

    @classmethod
    def _build_header(cls, application, styles):
        """Build PDF header with title and document info."""
        elements = []

        # Organization name
        elements.append(Paragraph("eLoan Cooperative", styles['DocumentTitle']))
        elements.append(Paragraph("Loan Application Approval Document", styles['Subtitle']))

        # Divider
        elements.append(HRFlowable(width="100%", thickness=1, color=colors.grey))
        elements.append(Spacer(1, 0.15*inch))

        # Document info table
        status_name = application.current_status.status_name if application.current_status else 'N/A'
        doc_info = [
            ['Application No:', f'APP-{application.id:06d}'],
            ['Date Generated:', datetime.now().strftime('%B %d, %Y')],
            ['Status:', status_name],
        ]

        info_table = Table(doc_info, colWidths=[1.5*inch, 4*inch])
        info_table.setStyle(TableStyle([
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('TEXTCOLOR', (0, 0), (0, -1), colors.grey),
            ('ALIGN', (0, 0), (0, -1), 'RIGHT'),
            ('ALIGN', (1, 0), (1, -1), 'LEFT'),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ]))
        elements.append(info_table)
        elements.append(Spacer(1, 0.2*inch))

        return elements

    @classmethod
    def _build_application_summary(cls, application, styles):
        """Build application summary section."""
        elements = []

        elements.append(Paragraph("Application Summary", styles['SectionTitle']))

        # Format values safely
        amount = f"PHP {application.amount_requested:,.2f}" if application.amount_requested else "N/A"
        term = f"{application.term_months} months" if application.term_months else "N/A"
        interest = f"{application.loan_type.interest_rate}% per annum" if application.loan_type.interest_rate else "N/A"
        monthly = f"PHP {application.monthly_amortization:,.2f}" if application.monthly_amortization else "N/A"
        total = f"PHP {application.total_payable:,.2f}" if application.total_payable else "N/A"

        summary_data = [
            ['Loan Type', application.loan_type.loan_name],
            ['Amount Requested', amount],
            ['Term', term],
            ['Interest Rate', interest],
            ['Monthly Amortization', monthly],
            ['Total Payable', total],
        ]

        summary_table = Table(summary_data, colWidths=[2*inch, 4*inch])
        summary_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#f7fafc')),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e2e8f0')),
            ('PADDING', (0, 0), (-1, -1), 8),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ]))
        elements.append(summary_table)
        elements.append(Spacer(1, 0.2*inch))

        return elements

    @classmethod
    def _build_applicant_info(cls, application, styles):
        """Build applicant information section."""
        elements = []

        elements.append(Paragraph("Applicant Information", styles['SectionTitle']))

        user = application.user
        profile = getattr(user, 'applicant_profile', None)

        # Build applicant data
        applicant_data = [
            ['Full Name', f'{user.firstname} {user.lastname}'],
            ['Email', user.email],
        ]

        if profile:
            if profile.contact_number:
                applicant_data.append(['Contact Number', profile.contact_number])
            if profile.full_address:
                applicant_data.append(['Address', profile.full_address])
            if profile.employer_name:
                applicant_data.append(['Employer', profile.employer_name])
            if profile.position:
                applicant_data.append(['Position', profile.position])

        applicant_table = Table(applicant_data, colWidths=[2*inch, 4*inch])
        applicant_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#f7fafc')),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e2e8f0')),
            ('PADDING', (0, 0), (-1, -1), 8),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ]))
        elements.append(applicant_table)
        elements.append(Spacer(1, 0.2*inch))

        return elements

    @classmethod
    def _build_loan_purpose(cls, application, styles):
        """Build loan purpose section."""
        elements = []

        elements.append(Paragraph("Loan Purpose", styles['SectionTitle']))
        purpose_text = application.purpose if application.purpose else 'Not specified'
        elements.append(Paragraph(purpose_text, styles['FieldValue']))
        elements.append(Spacer(1, 0.15*inch))

        return elements

    @classmethod
    def _build_comakers_section(cls, application, styles):
        """Build co-makers section."""
        elements = []

        elements.append(Paragraph("Co-Makers", styles['SectionTitle']))

        # Table header
        comaker_data = [['No.', 'Name', 'Relationship', 'Contact']]

        for i, comaker in enumerate(application.comakers.all(), 1):
            # Try to get detailed info
            detailed_info = getattr(comaker, 'detailed_info', None)

            if detailed_info:
                name = detailed_info.full_name
                relationship = detailed_info.relationship_to_applicant
                contact = detailed_info.contact_number
            else:
                name = f'{comaker.user.firstname} {comaker.user.lastname}'
                relationship = 'N/A'
                contact = 'N/A'

            comaker_data.append([str(i), name, relationship, contact])

        comaker_table = Table(comaker_data, colWidths=[0.5*inch, 2.5*inch, 1.5*inch, 1.5*inch])
        comaker_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1a365d')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e2e8f0')),
            ('PADDING', (0, 0), (-1, -1), 6),
            ('ALIGN', (0, 0), (0, -1), 'CENTER'),
        ]))
        elements.append(comaker_table)
        elements.append(Spacer(1, 0.2*inch))

        return elements

    @classmethod
    def _build_approval_info(cls, application, styles):
        """Build approval information section."""
        elements = []

        elements.append(Paragraph("Approval Information", styles['SectionTitle']))

        # Get Credit Committee decision
        cc_decision = None
        if hasattr(application, 'credit_committee_decisions'):
            cc_decision = application.credit_committee_decisions.filter(
                decision='approved'
            ).first()

        status_name = application.current_status.status_name if application.current_status else 'N/A'
        approval_data = [
            ['Application Date', application.application_date.strftime('%B %d, %Y')],
            ['Current Status', status_name],
        ]

        if cc_decision:
            approval_data.extend([
                ['Approval Date', cc_decision.decided_at.strftime('%B %d, %Y')],
                ['Meeting Date', cc_decision.meeting_date.strftime('%B %d, %Y')],
                ['Approved By', f'{cc_decision.decided_by.firstname} {cc_decision.decided_by.lastname}'],
            ])
            if cc_decision.remarks:
                approval_data.append(['Remarks', cc_decision.remarks])

        approval_table = Table(approval_data, colWidths=[2*inch, 4*inch])
        approval_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#f7fafc')),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e2e8f0')),
            ('PADDING', (0, 0), (-1, -1), 8),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ]))
        elements.append(approval_table)
        elements.append(Spacer(1, 0.2*inch))

        return elements

    @classmethod
    def _build_footer(cls, styles):
        """Build document footer."""
        elements = []

        elements.append(HRFlowable(width="100%", thickness=1, color=colors.grey))
        elements.append(Spacer(1, 0.1*inch))
        elements.append(Paragraph(
            "This document is computer-generated and is valid without signature.",
            styles['Footer']
        ))
        elements.append(Paragraph(
            f"Generated on {datetime.now().strftime('%B %d, %Y at %I:%M %p')}",
            styles['Footer']
        ))

        return elements
