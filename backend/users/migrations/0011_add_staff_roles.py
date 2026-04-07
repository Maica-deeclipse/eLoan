from django.db import migrations

STAFF_ROLES = ['Applicant', 'Bookkeeper', 'Treasurer', 'Credit Committee', 'Account Member Officer']


def create_staff_roles(apps, schema_editor):
    Role = apps.get_model('users', 'Role')
    for name in STAFF_ROLES:
        Role.objects.get_or_create(name=name)


def remove_staff_roles(apps, schema_editor):
    Role = apps.get_model('users', 'Role')
    Role.objects.filter(name__in=STAFF_ROLES).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0010_migrate_user_data'),
    ]

    operations = [
        migrations.RunPython(create_staff_roles, remove_staff_roles),
    ]
