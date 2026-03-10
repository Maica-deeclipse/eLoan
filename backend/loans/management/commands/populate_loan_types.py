"""
Management command to populate loan types with their co-maker requirements.
"""
from django.core.management.base import BaseCommand
from loans.models import LoanType


class Command(BaseCommand):
    help = 'Populate loan types with required co-makers'

    def handle(self, *args, **options):
        loan_types = [
            {
                'loan_name': 'Regular Loan',
                'required_comakers': 2,
                'min_amount': 5000,
                'max_amount': 200000,
                'interest_rate': 12.00,
                'max_term_months': 36,
                'description': 'Standard loan for general purposes with flexible terms.',
            },
            {
                'loan_name': 'Gadget/Appliance Loan',
                'required_comakers': 2,
                'min_amount': 5000,
                'max_amount': 50000,
                'interest_rate': 12.00,
                'max_term_months': 24,
                'description': 'Loan for purchasing gadgets, electronics, or home appliances.',
            },
            {
                'loan_name': 'Enhanced Regular Loan',
                'required_comakers': 2,
                'min_amount': 10000,
                'max_amount': 400000,
                'interest_rate': 10.00,
                'max_term_months': 48,
                'description': 'Higher loan amount with better rates for qualified members.',
            },
            {
                'loan_name': 'Grace Loan',
                'required_comakers': 1,
                'min_amount': 5000,
                'max_amount': 50000,
                'interest_rate': 8.00,
                'max_term_months': 12,
                'description': 'Short-term loan with grace period for first payment.',
            },
            {
                'loan_name': 'Petty Cash',
                'required_comakers': 0,
                'min_amount': 1000,
                'max_amount': 4500,
                'interest_rate': 6.00,
                'max_term_months': 6,
                'description': 'Small emergency loan for immediate cash needs.',
            },
            {
                'loan_name': 'Rice Loan',
                'required_comakers': 0,
                'min_amount': 1000,
                'max_amount': 3000,
                'interest_rate': 0.00,
                'max_term_months': 3,
                'description': 'Interest-free loan for rice and basic food supplies.',
            },
            {
                'loan_name': 'Pamasahe Loan',
                'required_comakers': 0,
                'min_amount': 500,
                'max_amount': 5000,
                'interest_rate': 0.00,
                'max_term_months': 2,
                'description': 'Interest-free transportation allowance loan.',
            },
            {
                'loan_name': 'Loan Against Deposit',
                'required_comakers': 0,
                'min_amount': 1000,
                'max_amount': 500000,
                'interest_rate': 8.00,
                'max_term_months': 12,
                'description': 'Loan secured against your savings deposit.',
            },
            {
                'loan_name': 'Grocery Loan',
                'required_comakers': 0,
                'min_amount': 1000,
                'max_amount': 3000,
                'interest_rate': 0.00,
                'max_term_months': 3,
                'description': 'Interest-free loan for grocery and household needs.',
            },
            {
                'loan_name': 'Calamity Loan',
                'required_comakers': 0,
                'min_amount': 500,
                'max_amount': 5000,
                'interest_rate': 6.00,
                'max_term_months': 24,
                'description': 'Emergency loan for calamity and disaster relief.',
            },
            {
                'loan_name': 'Financing Loan',
                'required_comakers': 0,
                'min_amount': 10000,
                'max_amount': 200000,
                'interest_rate': 10.00,
                'max_term_months': 36,
                'description': 'Business and livelihood financing loan.',
            },
        ]

        created_count = 0
        updated_count = 0

        for loan_data in loan_types:
            loan_type, created = LoanType.objects.update_or_create(
                loan_name=loan_data['loan_name'],
                defaults={
                    'required_comakers': loan_data['required_comakers'],
                    'min_amount': loan_data['min_amount'],
                    'max_amount': loan_data['max_amount'],
                    'interest_rate': loan_data['interest_rate'],
                    'max_term_months': loan_data['max_term_months'],
                    'description': loan_data['description'],
                    'is_active': True,
                }
            )
            if created:
                created_count += 1
                self.stdout.write(self.style.SUCCESS(f'Created: {loan_type.loan_name}'))
            else:
                updated_count += 1
                self.stdout.write(f'Updated: {loan_type.loan_name}')

        self.stdout.write(self.style.SUCCESS(
            f'\nDone! Created: {created_count}, Updated: {updated_count}'
        ))
