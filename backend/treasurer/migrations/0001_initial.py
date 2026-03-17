# Generated manually

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import django.utils.timezone


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('loans', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='TreasurerEvaluation',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('net_salary', models.DecimalField(decimal_places=2, help_text='Net monthly salary at time of evaluation', max_digits=12)),
                ('computed_monthly_amortization', models.DecimalField(decimal_places=2, help_text='Monthly amortization from application', max_digits=12)),
                ('dti_ratio', models.DecimalField(decimal_places=2, help_text='Debt-to-Income ratio percentage', max_digits=5)),
                ('recommendation', models.CharField(choices=[('recommend', 'Recommend'), ('not_recommend', 'Not Recommend')], help_text='Treasurer recommendation', max_length=20)),
                ('remarks', models.TextField(blank=True, help_text='Additional remarks or notes', null=True)),
                ('evaluated_at', models.DateTimeField(default=django.utils.timezone.now, help_text='When evaluation was performed')),
                ('ip_address', models.GenericIPAddressField(blank=True, help_text='IP address of evaluator (for audit)', null=True)),
                ('application', models.ForeignKey(help_text='Loan application being evaluated', on_delete=django.db.models.deletion.CASCADE, related_name='treasurer_evaluations', to='loans.loanapplication')),
                ('evaluated_by', models.ForeignKey(help_text='Treasurer who performed the evaluation', on_delete=django.db.models.deletion.PROTECT, related_name='treasurer_evaluations', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'verbose_name': 'Treasurer Evaluation',
                'verbose_name_plural': 'Treasurer Evaluations',
                'ordering': ['-evaluated_at'],
            },
        ),
        migrations.AddIndex(
            model_name='treasurerevaluation',
            index=models.Index(fields=['application', 'evaluated_at'], name='treasurer_t_applica_idx'),
        ),
        migrations.AddIndex(
            model_name='treasurerevaluation',
            index=models.Index(fields=['evaluated_by', 'evaluated_at'], name='treasurer_t_evaluat_idx'),
        ),
    ]
