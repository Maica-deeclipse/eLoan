from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('loans', '0014_loancomaker_status_responded_at'),
    ]

    operations = [
        migrations.AddField(
            model_name='loanapplication',
            name='user_application_number',
            field=models.PositiveIntegerField(
                blank=True,
                null=True,
                help_text='Per-user sequential application number (1 = first application by this user)',
            ),
        ),
    ]
