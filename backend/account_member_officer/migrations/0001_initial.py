from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import django.utils.timezone


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='AMONotification',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('title', models.CharField(max_length=200)),
                ('message', models.TextField()),
                ('notification_type', models.CharField(
                    choices=[
                        ('new_registration', 'New Registration'),
                        ('approval', 'Approval'),
                        ('rejection', 'Rejection'),
                        ('savings_update', 'Savings Update'),
                        ('capital_update', 'Capital Update'),
                        ('action_required', 'Action Required'),
                        ('security_alert', 'Security Alert'),
                        ('info', 'Information'),
                    ],
                    default='info',
                    max_length=20,
                )),
                ('is_read', models.BooleanField(default=False)),
                ('created_at', models.DateTimeField(default=django.utils.timezone.now)),
                ('read_at', models.DateTimeField(blank=True, null=True)),
                ('user', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='amo_notifications',
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={
                'verbose_name': 'AMO Notification',
                'verbose_name_plural': 'AMO Notifications',
                'ordering': ['-created_at'],
            },
        ),
        migrations.AddIndex(
            model_name='amonotification',
            index=models.Index(fields=['user', 'is_read'], name='amo_notif_user_isread_idx'),
        ),
    ]