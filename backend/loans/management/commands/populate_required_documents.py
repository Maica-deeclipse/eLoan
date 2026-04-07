"""
Management command to populate required documents per loan type.
Run after populate_loan_types.
"""
from django.core.management.base import BaseCommand
from loans.models import LoanType, LoanTypeRequiredDocument


# Maps loan_name → list of (document_key, document_label, description, is_required, sort_order)
# Note: buksu_id is no longer required here — it is collected once during registration (Applicant.id_photo)
LOAN_DOCUMENTS = {
    'ATM Loan': [
        ('cisp_insurance_form',    'CISP Insurance Form',                        'Accomplished CISP insurance form',                               True,  1),
        ('payslip_1_month',        'Latest 1-Month Payslip (Borrower)',          'Borrower\'s most recent payslip',                                True,  2),
        ('comaker_payslip',        'Co-Maker Latest 1-Month Payslip',            'Co-maker\'s most recent payslip',                                True,  3),
        ('comaker_id',             'Co-Maker BukSU ID',                          'Co-maker\'s BukSU ID copy',                                      True,  4),
        ('atm_card',               'ATM Card (as Collateral)',                   'ATM card to be used as collateral',                              True,  5),
        ('bank_statement_3_months','Bank Statement (at least 3 months)',         'Bank statement covering at least the last 3 months',             True,  6),
        ('balance_inquiry',        'Updated Balance Inquiry',                    'Latest balance inquiry slip',                                    True,  7),
        ('signed_waiver',          'Signed Waiver',                              'Accomplished and signed waiver form',                            True,  8),
        ('other_documents',        'Other Supporting Documents',                 'Any additional supporting documents',                            False, 9),
    ],
    'Calamity Loan': [
        ('proof_of_income',        'Proof of Income / Latest Payslip',          'Most recent payslip',                                            True,  1),
        ('other_documents',        'Other Supporting Documents',                 'Any additional supporting documents',                            False, 2),
    ],
    'Emergency Loan': [
        ('proof_of_income',        'Proof of Income / Latest Payslip',          'Most recent payslip',                                            True,  1),
        ('other_documents',        'Other Supporting Documents',                 'Any additional supporting documents',                            False, 2),
    ],
    'Enhanced Regular Loan': [
        ('cisp_insurance_form',    'CISP Insurance Form',                        'Accomplished CISP insurance form',                               True,  1),
        ('payslip_3_months',       'Latest 3 Consecutive Months Payslips',       'Borrower\'s three consecutive latest payslips',                  True,  2),
        ('comaker_payslip',        'Co-Maker Latest 1-Month Payslip (each)',     'Each co-maker\'s most recent payslip',                           True,  3),
        ('comaker_id',             'Co-Maker BukSU ID (each)',                   'Each co-maker\'s BukSU ID copy',                                 True,  4),
        ('certificate_of_employment', 'Certificate of Employment / Appointment','CoE or appointment letter; "You Are Hired" letter for new employees', True, 5),
        ('letter_of_intent',       'Letter of Intent (Purpose of Loan)',         'Written letter stating the purpose of the loan',                 True,  6),
        ('spouse_valid_id',        'Spouse Valid ID Copy',                       'Valid ID of the borrower\'s spouse',                             True,  7),
        ('other_documents',        'Other Supporting Documents',                 'Any additional supporting documents',                            False, 8),
    ],
    'Financing Loan': [
        ('proof_of_income',        'Proof of Income / Latest Payslip',          'Most recent payslip',                                            True,  1),
        ('other_documents',        'Other Supporting Documents',                 'Any additional supporting documents',                            False, 2),
    ],
    'Gadget/Appliance Loan': [
        ('cisp_insurance_form',    'CISP Insurance Form',                        'Accomplished CISP insurance form',                               True,  1),
        ('payslip_2_months',       'Latest 2 Months Payslips (Borrower)',        'Borrower\'s two most recent payslips',                           True,  2),
        ('comaker_payslip',        'Co-Maker Latest 1-Month Payslip (each)',     'Each co-maker\'s most recent payslip',                           True,  3),
        ('comaker_id',             'Co-Maker BukSU ID (each)',                   'Each co-maker\'s BukSU ID copy',                                 True,  4),
        ('certificate_of_employment', 'Certificate of Employment / Appointment','CoE or appointment letter; "You Are Hired" for new employees',   True,  5),
        ('gadget_quotation',       'Gadget / Appliance Quotation',               'Quotation for the gadget or appliance to be purchased',          True,  6),
        ('other_documents',        'Other Supporting Documents',                 'Any additional supporting documents',                            False, 7),
    ],
    'Grace Loan': [
        ('cisp_insurance_form',    'CISP Insurance Form',                        'Accomplished CISP insurance form',                               True,  1),
        ('payslip_2_months',       'Latest 2 Months Payslips (Borrower)',        'Borrower\'s two most recent payslips',                           True,  2),
        ('comaker_payslip',        'Co-Maker Latest 1-Month Payslip (each)',     'Each co-maker\'s most recent payslip',                           True,  3),
        ('comaker_id',             'Co-Maker BukSU ID (each)',                   'Each co-maker\'s BukSU ID copy',                                 True,  4),
        ('certificate_of_employment', 'Certificate of Employment / Appointment','CoE or appointment letter; "You Are Hired" for new employees',   True,  5),
        ('other_documents',        'Other Supporting Documents',                 'Any additional supporting documents',                            False, 6),
    ],
    'Grocery Loan': [
        ('proof_of_income',        'Proof of Income / Latest Payslip',          'Most recent payslip',                                            True,  1),
        ('other_documents',        'Other Supporting Documents',                 'Any additional supporting documents',                            False, 2),
    ],
    'Loan Against Deposit': [
        ('proof_of_income',        'Proof of Income / Latest Payslip',          'Most recent payslip',                                            True,  1),
        ('other_documents',        'Other Supporting Documents',                 'Any additional supporting documents',                            False, 2),
    ],
    'Pamasahe Loan': [
        ('proof_of_income',        'Proof of Income / Latest Payslip',          'Most recent payslip',                                            True,  1),
        ('other_documents',        'Other Supporting Documents',                 'Any additional supporting documents',                            False, 2),
    ],
    'Petty Cash': [
        ('proof_of_income',        'Proof of Income / Latest Payslip',          'Most recent payslip',                                            True,  1),
        ('other_documents',        'Other Supporting Documents',                 'Any additional supporting documents',                            False, 2),
    ],
    'Regular Loan': [
        ('cisp_insurance_form',    'CISP Insurance Form',                        'Accomplished CISP insurance form',                               True,  1),
        ('payslip_2_months',       'Latest 2 Months Payslips (Borrower)',        'Borrower\'s two most recent payslips',                           True,  2),
        ('comaker_payslip',        'Co-Maker Latest 1-Month Payslip (each)',     'Each co-maker\'s most recent payslip',                           True,  3),
        ('comaker_id',             'Co-Maker BukSU ID (each)',                   'Each co-maker\'s BukSU ID copy',                                 True,  4),
        ('certificate_of_employment', 'Certificate of Employment / Appointment','CoE or appointment letter; "You Are Hired" for new employees',   True,  5),
        ('other_documents',        'Other Supporting Documents',                 'Any additional supporting documents',                            False, 6),
    ],
    'Rice Loan': [
        ('proof_of_income',        'Proof of Income / Latest Payslip',          'Most recent payslip',                                            True,  1),
        ('comaker_payslip',        'Co-Maker Latest 1-Month Payslip',            'Co-maker\'s most recent payslip',                                True,  2),
        ('comaker_id',             'Co-Maker BukSU ID',                          'Co-maker\'s BukSU ID copy',                                      True,  3),
        ('other_documents',        'Other Supporting Documents',                 'Any additional supporting documents',                            False, 4),
    ],
}


class Command(BaseCommand):
    help = 'Populate required documents per loan type (run after populate_loan_types)'

    def handle(self, *args, **options):
        created_count = 0
        updated_count = 0
        skipped = []

        for loan_name, docs in LOAN_DOCUMENTS.items():
            try:
                loan_type = LoanType.objects.get(loan_name=loan_name)
            except LoanType.DoesNotExist:
                skipped.append(loan_name)
                self.stdout.write(self.style.WARNING(f'Skipped (not found): {loan_name}'))
                continue

            for doc_key, doc_label, description, is_required, sort_order in docs:
                obj, created = LoanTypeRequiredDocument.objects.update_or_create(
                    loan_type=loan_type,
                    document_key=doc_key,
                    defaults={
                        'document_label': doc_label,
                        'description': description,
                        'is_required': is_required,
                        'sort_order': sort_order,
                    }
                )
                if created:
                    created_count += 1
                else:
                    updated_count += 1

            self.stdout.write(f'  {loan_name}: {len(docs)} document(s) configured')

        self.stdout.write(self.style.SUCCESS(
            f'\nDone! Created: {created_count}, Updated: {updated_count}'
        ))
        if skipped:
            self.stdout.write(self.style.WARNING(
                f'Skipped loan types (not in DB): {", ".join(skipped)}'
            ))
