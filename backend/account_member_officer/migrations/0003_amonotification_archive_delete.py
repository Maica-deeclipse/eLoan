from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('account_member_officer', '0002_rename_amo_notif_user_isread_idx_account_mem_user_id_327b86_idx'),
    ]

    operations = [
        migrations.AddField(
            model_name='amonotification',
            name='is_archived',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='amonotification',
            name='is_deleted',
            field=models.BooleanField(default=False),
        ),
    ]
