"""
Data migration: remove 'completed_loan_form' from LoanTypeRequiredDocument.

The PDF overlay system (form_overlay_pdf_service.py) generates the completed
application form automatically from submitted data, so applicants no longer
need to upload a pre-filled form.

Affected loan types: ATM Loan, Enhanced Regular Loan, Gadget/Appliance Loan,
Grace Loan, Regular Loan.
"""
from django.db import migrations


def remove_completed_loan_form(apps, schema_editor):
    LoanTypeRequiredDocument = apps.get_model('loans', 'LoanTypeRequiredDocument')
    deleted_count, _ = LoanTypeRequiredDocument.objects.filter(
        document_key='completed_loan_form'
    ).delete()
    if deleted_count:
        print(f'  Removed {deleted_count} completed_loan_form document requirement(s).')


class Migration(migrations.Migration):

    dependencies = [
        ('loans', '0010_loanapplication_activated_at_and_more'),
    ]

    operations = [
        migrations.RunPython(
            remove_completed_loan_form,
            reverse_code=migrations.RunPython.noop,
        ),
    ]
