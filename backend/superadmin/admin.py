from django.contrib import admin
from .models import Violation, DisciplinaryAction, TerminationRecord


@admin.register(Violation)
class ViolationAdmin(admin.ModelAdmin):
    list_display = ('member', 'violation_type', 'severity', 'status', 'date_of_violation', 'logged_at')
    list_filter = ('violation_type', 'severity', 'status')
    search_fields = ('member__user__email', 'member__user__firstname', 'member__user__lastname', 'description')
    date_hierarchy = 'logged_at'


@admin.register(DisciplinaryAction)
class DisciplinaryActionAdmin(admin.ModelAdmin):
    list_display = ('member', 'action_type', 'effective_date', 'decided_by', 'decided_at')
    list_filter = ('action_type',)
    search_fields = ('member__user__email', 'member__user__firstname', 'reason')
    date_hierarchy = 'decided_at'


@admin.register(TerminationRecord)
class TerminationRecordAdmin(admin.ModelAdmin):
    list_display = ('member', 'termination_type', 'effective_date', 'processed_by', 'processed_at')
    list_filter = ('termination_type',)
    search_fields = ('member__user__email', 'reason')
