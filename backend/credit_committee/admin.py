from django.contrib import admin
from unfold.admin import ModelAdmin
from .models import CreditCommitteeDecision


@admin.register(CreditCommitteeDecision)
class CreditCommitteeDecisionAdmin(ModelAdmin):
    list_display = ('application', 'decided_by', 'decision', 'meeting_date', 'decided_at')
    list_filter = ('decision', 'meeting_date', 'decided_at')
    search_fields = ('application__user__email', 'decided_by__email', 'remarks')
    readonly_fields = ('decided_at', 'ip_address')
    ordering = ('-decided_at',)
    date_hierarchy = 'decided_at'

    fieldsets = (
        ('Application', {
            'fields': ('application',)
        }),
        ('Decision', {
            'fields': ('decision', 'remarks', 'meeting_date', 'decided_by')
        }),
        ('Audit', {
            'fields': ('decided_at', 'ip_address'),
            'classes': ('collapse',)
        }),
    )
