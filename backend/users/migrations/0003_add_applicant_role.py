# Generated migration for adding Applicant role

from django.db import migrations


def create_applicant_role(apps, schema_editor):
    """Create Applicant role for loan applicants."""
    Role = apps.get_model('users', 'Role')
    Role.objects.get_or_create(name='Applicant')


def remove_applicant_role(apps, schema_editor):
    """Remove Applicant role (reverse migration)."""
    Role = apps.get_model('users', 'Role')
    Role.objects.filter(name='Applicant').delete()


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0002_alter_user_managers_remove_user_created_at_and_more'),
    ]

    operations = [
        migrations.RunPython(create_applicant_role, remove_applicant_role),
    ]
