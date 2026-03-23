from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('bookkeeper', '0004_loanaccountingentry'),
    ]

    operations = [
        migrations.AddField(
            model_name='notification',
            name='is_archived',
            field=models.BooleanField(default=False, help_text='Whether user has archived this notification'),
        ),
        migrations.AddField(
            model_name='notification',
            name='is_deleted',
            field=models.BooleanField(default=False, help_text='Soft delete — hidden from all views'),
        ),
    ]
