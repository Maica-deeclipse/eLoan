from django.contrib import admin
from unfold.admin import ModelAdmin
from unfold.decorators import display

from .models import Violation, DisciplinaryAction, TerminationRecord


@admin.register(Violation)
class ViolationAdmin(ModelAdmin):
    list_display = ('member', 'violation_type_display', 'severity_display', 'status_display', 'date_of_violation', 'logged_at')
    list_filter = ('violation_type', 'severity', 'status')
    search_fields = ('member__user__email', 'member__user__firstname', 'member__user__lastname', 'description')
    date_hierarchy = 'logged_at'
    readonly_fields = ('logged_at', 'logged_by')

    @display(description='Type', label=True)
    def violation_type_display(self, obj):
        return obj.get_violation_type_display()

    @display(description='Severity', label={
        'minor':    'info',
        'moderate': 'warning',
        'severe':   'danger',
    })
    def severity_display(self, obj):
        return obj.severity

    @display(description='Status', label={
        'open':      'warning',
        'escalated': 'danger',
        'resolved':  'success',
    })
    def status_display(self, obj):
        return obj.status


@admin.register(DisciplinaryAction)
class DisciplinaryActionAdmin(ModelAdmin):
    list_display = ('member', 'action_type_display', 'effective_date', 'decided_by', 'decided_at')
    list_filter = ('action_type',)
    search_fields = ('member__user__email', 'member__user__firstname', 'reason')
    date_hierarchy = 'decided_at'
    readonly_fields = ('decided_at', 'decided_by')

    @display(description='Action', label={
        'warning':       'warning',
        'suspension':    'danger',
        'termination':   'danger',
        'reinstatement': 'success',
    })
    def action_type_display(self, obj):
        return obj.action_type


@admin.register(TerminationRecord)
class TerminationRecordAdmin(ModelAdmin):
    list_display = ('member', 'termination_type_display', 'effective_date', 'processed_by', 'processed_at')
    list_filter = ('termination_type',)
    search_fields = ('member__user__email', 'reason')
    readonly_fields = ('processed_at', 'processed_by')

    @display(description='Type', label={
        'disciplinary': 'danger',
        'voluntary':    'info',
        'deceased':     'warning',
    })
    def termination_type_display(self, obj):
        return obj.termination_type
