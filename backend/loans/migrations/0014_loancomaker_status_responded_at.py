from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('loans', '0013_faceverification_name_verification'),
    ]

    operations = [
        migrations.AddField(
            model_name='loancomaker',
            name='status',
            field=models.CharField(
                choices=[('pending', 'Pending'), ('accepted', 'Accepted'), ('rejected', 'Rejected')],
                default='pending',
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name='loancomaker',
            name='responded_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
