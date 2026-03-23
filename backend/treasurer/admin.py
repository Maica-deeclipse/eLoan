from django.contrib import admin
from unfold.admin import ModelAdmin
from unfold.decorators import display

from .models import TreasurerEvaluation


@admin.register(TreasurerEvaluation)
class TreasurerEvaluationAdmin(ModelAdmin):
    list_display = ('application', 'evaluated_by', 'recommendation_display', 'dti_ratio', 'evaluated_at')
    list_filter = ('recommendation', 'evaluated_at')
    search_fields = ('application__user__email', 'evaluated_by__email')
    readonly_fields = ('evaluated_at', 'ip_address')
    ordering = ('-evaluated_at',)

    @display(description='Recommendation', label={
        'approve': 'success',
        'reject':  'danger',
        'defer':   'warning',
    })
    def recommendation_display(self, obj):
        return obj.recommendation
