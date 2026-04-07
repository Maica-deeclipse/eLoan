from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('loans', '0012_add_approved_released_at'),
    ]

    operations = [
        migrations.AddField(
            model_name='faceverification',
            name='ocr_name_extracted',
            field=models.CharField(blank=True, max_length=255, null=True),
        ),
        migrations.AddField(
            model_name='faceverification',
            name='ocr_name_match',
            field=models.BooleanField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='faceverification',
            name='ocr_name_similarity',
            field=models.DecimalField(blank=True, decimal_places=2, max_digits=4, null=True),
        ),
    ]
