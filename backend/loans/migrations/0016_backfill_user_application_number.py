from django.db import migrations


def backfill_user_application_numbers(apps, schema_editor):
    LoanApplication = apps.get_model('loans', 'LoanApplication')
    seen = {}
    for app in LoanApplication.objects.order_by('user_id', 'id'):
        uid = app.user_id
        seen[uid] = seen.get(uid, 0) + 1
        app.user_application_number = seen[uid]
        app.save(update_fields=['user_application_number'])


class Migration(migrations.Migration):

    dependencies = [
        ('loans', '0015_loanapplication_user_application_number'),
    ]

    operations = [
        migrations.RunPython(backfill_user_application_numbers, migrations.RunPython.noop),
    ]
