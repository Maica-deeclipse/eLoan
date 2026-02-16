from django.contrib import admin
from django.utils.html import format_html
from unfold.admin import ModelAdmin
from unfold.decorators import display
from .models import Payment


@admin.register(Payment)
class PaymentAdmin(ModelAdmin):
    list_display = ('id', 'application_info', 'amount_display', 'payment_method_badge', 'payment_date', 'recorded_by')
    list_filter = ('payment_method', 'payment_date', 'recorded_by')
    search_fields = (
        'application__user__email',
        'application__user__firstname',
        'application__user__lastname',
        'application__id',
        'remarks'
    )
    ordering = ('-payment_date',)
    date_hierarchy = 'payment_date'

    fieldsets = (
        ('Payment Information', {
            'fields': ('application', 'amount_paid', 'payment_date', 'payment_method')
        }),
        ('Recording Details', {
            'fields': ('recorded_by', 'remarks')
        }),
    )

    def application_info(self, obj):
        if obj.application:
            user = obj.application.user
            return format_html(
                '<div style="line-height: 1.5;">'
                '<strong>{} {}</strong><br>'
                '<span style="color: #6b7280; font-size: 12px;">Loan #{} - {}</span>'
                '</div>',
                user.firstname,
                user.lastname,
                obj.application.id,
                obj.application.loan_type.loan_name
            )
        return 'N/A'
    application_info.short_description = 'Application'

    @display(description='Amount')
    def amount_display(self, obj):
        return format_html(
            '<span style="font-weight: 700; color: #10b981; font-size: 14px;">₱{:,.2f}</span>',
            obj.amount_paid or 0
        )

    @display(description='Payment Method', label=True)
    def payment_method_badge(self, obj):
        color_map = {
            'Cash': '#10b981',
            'Bank Transfer': '#3b82f6',
            'Payroll Deduction': '#8b5cf6',
            'Other': '#6b7280',
        }
        color = color_map.get(obj.payment_method, '#6b7280')

        return format_html(
            '<span style="background-color: {}22; color: {}; padding: 4px 12px; border-radius: 12px; '
            'font-size: 12px; font-weight: 600;">{}</span>',
            color, color, obj.payment_method or 'N/A'
        )

    def get_readonly_fields(self, request, obj=None):
        if obj:  # Editing existing payment
            return ('application', 'recorded_by')
        return ('recorded_by',)

    def save_model(self, request, obj, form, change):
        if not change:  # Only set recorded_by on creation
            obj.recorded_by = request.user
        super().save_model(request, obj, form, change)
