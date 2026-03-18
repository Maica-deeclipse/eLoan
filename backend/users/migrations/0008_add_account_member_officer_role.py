from django.db import migrations


def create_amo_role(apps, schema_editor):
    Role = apps.get_model('users', 'Role')
    Role.objects.get_or_create(name='Account Member Officer')


def remove_amo_role(apps, schema_editor):
    Role = apps.get_model('users', 'Role')
    Role.objects.filter(name='Account Member Officer').delete()


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0007_user_account_status_user_approved_at_and_more'),
    ]

    operations = [
        migrations.RunPython(create_amo_role, remove_amo_role),
    ]