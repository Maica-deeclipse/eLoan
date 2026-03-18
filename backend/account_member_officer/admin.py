from django.contrib import admin
from unfold.admin import ModelAdmin
from .models import AMONotification


@admin.register(AMONotification)
class AMONotificationAdmin(ModelAdmin):
    list_display = ('title', 'user', 'notification_type', 'is_read', 'created_at')
    list_filter = ('notification_type', 'is_read')
    search_fields = ('title', 'user__email', 'user__firstname', 'user__lastname')
    readonly_fields = ('created_at', 'read_at')