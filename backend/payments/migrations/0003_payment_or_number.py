from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('payments', '0002_remove_payment_amount_remove_payment_created_at_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='payment',
            name='or_number',
            field=models.CharField(blank=True, help_text='Official Receipt number', max_length=100, null=True),
        ),
    ]
