from django.contrib import admin
from .models import TreasurerEvaluation


@admin.register(TreasurerEvaluation)
class TreasurerEvaluationAdmin(admin.ModelAdmin):
    list_display = ('application', 'evaluated_by', 'recommendation', 'dti_ratio', 'evaluated_at')
    list_filter = ('recommendation', 'evaluated_at')
    search_fields = ('application__user__email', 'evaluated_by__email')
    readonly_fields = ('evaluated_at', 'ip_address')
    ordering = ('-evaluated_at',)
