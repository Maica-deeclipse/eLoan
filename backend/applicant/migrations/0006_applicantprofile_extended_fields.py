# Generated migration for extended ApplicantProfile fields and ApplicantBeneficiary model

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('applicant', '0005_applicantprofile_coe_document_and_more'),
    ]

    operations = [
        # New personal info fields
        migrations.AddField(
            model_name='applicantprofile',
            name='middle_name',
            field=models.CharField(blank=True, max_length=50, null=True),
        ),
        migrations.AddField(
            model_name='applicantprofile',
            name='gender',
            field=models.CharField(blank=True, choices=[('male', 'Male'), ('female', 'Female')], max_length=10, null=True),
        ),
        migrations.AddField(
            model_name='applicantprofile',
            name='citizenship',
            field=models.CharField(blank=True, default='Filipino', max_length=50, null=True),
        ),
        migrations.AddField(
            model_name='applicantprofile',
            name='spouse_name',
            field=models.CharField(blank=True, max_length=100, null=True),
        ),
        migrations.AddField(
            model_name='applicantprofile',
            name='sss_number',
            field=models.CharField(blank=True, help_text='SSS Number', max_length=30, null=True),
        ),
        migrations.AddField(
            model_name='applicantprofile',
            name='highest_education',
            field=models.CharField(
                blank=True,
                choices=[
                    ('elementary', 'Elementary'),
                    ('high_school', 'High School'),
                    ('vocational', 'Vocational/Technical'),
                    ('college', 'College'),
                    ('post_graduate', 'Post-Graduate'),
                ],
                max_length=20,
                null=True,
            ),
        ),
        # Permanent address fields
        migrations.AddField(
            model_name='applicantprofile',
            name='permanent_address_line1',
            field=models.CharField(blank=True, max_length=255, null=True),
        ),
        migrations.AddField(
            model_name='applicantprofile',
            name='permanent_address_barangay',
            field=models.CharField(blank=True, max_length=255, null=True),
        ),
        migrations.AddField(
            model_name='applicantprofile',
            name='permanent_city',
            field=models.CharField(blank=True, max_length=100, null=True),
        ),
        migrations.AddField(
            model_name='applicantprofile',
            name='permanent_province',
            field=models.CharField(blank=True, max_length=100, null=True),
        ),
        migrations.AddField(
            model_name='applicantprofile',
            name='permanent_zip_code',
            field=models.CharField(blank=True, max_length=10, null=True),
        ),
        # Employment new fields
        migrations.AddField(
            model_name='applicantprofile',
            name='employment_category',
            field=models.CharField(
                blank=True,
                choices=[
                    ('teaching', 'Teaching'),
                    ('non_teaching', 'Non-Teaching'),
                    ('others', 'Others'),
                ],
                max_length=20,
                null=True,
            ),
        ),
        migrations.AddField(
            model_name='applicantprofile',
            name='buksu_id_number',
            field=models.CharField(blank=True, help_text='BukSU ID Number', max_length=50, null=True),
        ),
        migrations.AddField(
            model_name='applicantprofile',
            name='office',
            field=models.CharField(blank=True, help_text='Office/Department', max_length=100, null=True),
        ),
        # Update employment_status choices (column stays the same, choices are Python-level)
        migrations.AlterField(
            model_name='applicantprofile',
            name='employment_status',
            field=models.CharField(
                blank=True,
                choices=[
                    ('regular', 'Regular'),
                    ('casual', 'Casual'),
                    ('job_order', 'Job Order'),
                    ('part_time', 'Part-time'),
                ],
                max_length=20,
                null=True,
            ),
        ),
        # Parents fields
        migrations.AddField(
            model_name='applicantprofile',
            name='father_name',
            field=models.CharField(blank=True, max_length=100, null=True),
        ),
        migrations.AddField(
            model_name='applicantprofile',
            name='father_occupation',
            field=models.CharField(blank=True, max_length=100, null=True),
        ),
        migrations.AddField(
            model_name='applicantprofile',
            name='father_contact',
            field=models.CharField(blank=True, max_length=20, null=True),
        ),
        migrations.AddField(
            model_name='applicantprofile',
            name='mother_name',
            field=models.CharField(blank=True, max_length=100, null=True),
        ),
        migrations.AddField(
            model_name='applicantprofile',
            name='mother_occupation',
            field=models.CharField(blank=True, max_length=100, null=True),
        ),
        migrations.AddField(
            model_name='applicantprofile',
            name='mother_contact',
            field=models.CharField(blank=True, max_length=20, null=True),
        ),
        # Document fields
        migrations.AddField(
            model_name='applicantprofile',
            name='id_photo',
            field=models.ImageField(blank=True, help_text='2x2 ID photo', null=True, upload_to='applicant_documents/id_photos/'),
        ),
        migrations.AddField(
            model_name='applicantprofile',
            name='payslip',
            field=models.FileField(blank=True, help_text='Payslip as proof of monthly income', null=True, upload_to='applicant_documents/payslips/'),
        ),
        # ApplicantBeneficiary model
        migrations.CreateModel(
            name='ApplicantBeneficiary',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=100)),
                ('relationship', models.CharField(max_length=50)),
                ('date_of_birth', models.DateField(blank=True, null=True)),
                ('contact_number', models.CharField(blank=True, max_length=20, null=True)),
                ('profile', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='beneficiaries',
                    to='applicant.applicantprofile',
                )),
            ],
            options={
                'verbose_name': 'Applicant Beneficiary',
                'verbose_name_plural': 'Applicant Beneficiaries',
            },
        ),
    ]
