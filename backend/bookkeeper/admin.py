"""
Bookkeeper Module Admin Configuration

Registers Notification and BookkeeperVerification models
in Django admin for management and debugging.
"""

from django.contrib import admin
from unfold.admin import ModelAdmin
from .models import Notification, BookkeeperVerification


@admin.register(Notification)
class NotificationAdmin(ModelAdmin):
    """Admin configuration for Notification model."""

    list_display = [
        'title',
        'user',
        'notification_type',
        'is_read',
        'created_at',
    ]
    list_filter = [
        'notification_type',
        'is_read',
        'created_at',
    ]
    search_fields = [
        'title',
        'message',
        'user__email',
        'user__firstname',
        'user__lastname',
    ]
    readonly_fields = [
        'created_at',
        'read_at',
    ]
    date_hierarchy = 'created_at'
    ordering = ['-created_at']


@admin.register(BookkeeperVerification)
class BookkeeperVerificationAdmin(ModelAdmin):
    """Admin configuration for BookkeeperVerification model."""

    list_display = [
        'application',
        'verified_by',
        'action',
        'verified_at',
    ]
    list_filter = [
        'action',
        'verified_at',
        'verified_by',
    ]
    search_fields = [
        'application__user__email',
        'application__user__firstname',
        'application__user__lastname',
        'verified_by__email',
        'rejection_reason',
    ]
    readonly_fields = [
        'verified_at',
        'ip_address',
    ]
    date_hierarchy = 'verified_at'
    ordering = ['-verified_at']
