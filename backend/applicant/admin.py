"""
Applicant Module Admin Configuration

Includes:
- ApplicantProfile management
- Co-maker information
- Loan type co-maker requirements
- Member management (membership classification)
- Savings and Shared Capital records
"""

from django.contrib import admin
from unfold.admin import ModelAdmin
from unfold.decorators import display
from .models import (
    ApplicantProfile, CoMakerInfo, LoanTypeCoMakerRequirement,
    Member, Savings, SharedCapital, MembershipApprovalLog
)


@admin.register(ApplicantProfile)
class ApplicantProfileAdmin(ModelAdmin):
    list_display = ('user', 'contact_number', 'city', 'employer_name', 'position', 'updated_at')
    list_filter = ('city', 'province', 'created_at')
    search_fields = ('user__email', 'user__firstname', 'user__lastname', 'contact_number')
    readonly_fields = ('created_at', 'updated_at')

    fieldsets = (
        ('User', {
            'fields': ('user',)
        }),
        ('Contact Information', {
            'fields': ('contact_number', 'secondary_contact')
        }),
        ('Address', {
            'fields': ('address_line1', 'address_line2', 'city', 'province', 'zip_code')
        }),
        ('Employment', {
            'fields': ('employer_name', 'employer_address', 'position', 'monthly_income', 'years_employed')
        }),
        ('Emergency Contact', {
            'fields': ('emergency_contact_name', 'emergency_contact_number', 'emergency_contact_relationship')
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )


@admin.register(CoMakerInfo)
class CoMakerInfoAdmin(ModelAdmin):
    list_display = ('full_name', 'relationship_to_applicant', 'contact_number', 'consent_given', 'created_at')
    list_filter = ('consent_given', 'id_type', 'created_at')
    search_fields = ('full_name', 'email', 'contact_number')
    readonly_fields = ('created_at',)

    fieldsets = (
        ('Co-Maker', {
            'fields': ('loan_comaker',)
        }),
        ('Personal Details', {
            'fields': ('full_name', 'relationship_to_applicant', 'contact_number', 'email', 'address')
        }),
        ('Employment', {
            'fields': ('employer_name', 'position', 'monthly_income')
        }),
        ('Identification', {
            'fields': ('id_type', 'id_number', 'id_image_path')
        }),
        ('Signature', {
            'fields': ('signature_image_path', 'signed_at')
        }),
        ('Consent', {
            'fields': ('consent_given', 'consent_at')
        }),
    )


@admin.register(LoanTypeCoMakerRequirement)
class LoanTypeCoMakerRequirementAdmin(ModelAdmin):
    list_display = ('loan_type', 'required_comakers')
    list_filter = ('required_comakers',)
    search_fields = ('loan_type__loan_name',)


# =============================================================================
# Member Management Admin
# =============================================================================

@admin.register(Member)
class MemberAdmin(ModelAdmin):
    """Read-only view of cooperative members. Management is handled by Account Member Officer."""

    list_display = (
        'user_name',
        'employee_id',
        'email',
        'membership_type_display',
        'total_savings_display',
        'total_shared_capital_display',
        'member_since',
    )
    list_filter = ('membership_type', 'member_since')
    search_fields = (
        'user__email',
        'user__firstname',
        'user__lastname',
        'user__employee_id',
    )
    readonly_fields = (
        'total_savings_display',
        'total_shared_capital_display',
        'calculated_membership_type',
        'max_loan_amount_display',
        'member_since',
        'created_at',
        'updated_at',
    )
    ordering = ['-member_since']

    fieldsets = (
        ('Member Information', {
            'fields': ('user', 'membership_type', 'member_since'),
        }),
        ('Financial Summary (Read-only)', {
            'fields': (
                'total_savings_display',
                'total_shared_capital_display',
                'calculated_membership_type',
                'max_loan_amount_display',
            ),
            'classes': ('collapse',),
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',),
        }),
    )

    def user_name(self, obj):
        return f"{obj.user.firstname} {obj.user.lastname}"
    user_name.short_description = 'Name'

    def employee_id(self, obj):
        return obj.user.employee_id or '-'
    employee_id.short_description = 'Employee ID'

    def email(self, obj):
        return obj.user.email
    email.short_description = 'Email'

    @display(description='Membership', label=True)
    def membership_type_display(self, obj):
        if obj.membership_type == 'regular':
            return 'Regular', 'success'
        return 'Associate', 'warning'

    def total_savings_display(self, obj):
        return f"PHP {obj.total_savings:,.2f}"
    total_savings_display.short_description = 'Total Savings'

    def total_shared_capital_display(self, obj):
        return f"PHP {obj.total_shared_capital:,.2f}"
    total_shared_capital_display.short_description = 'Total Shared Capital'

    def max_loan_amount_display(self, obj):
        max_amount = obj.max_loan_amount
        if max_amount:
            return f"PHP {max_amount:,.2f}"
        return "Per Loan Type Config"
    max_loan_amount_display.short_description = 'Max Loan Amount'

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(Savings)
class SavingsAdmin(ModelAdmin):
    """Read-only view of savings records. Management is handled by Account Member Officer."""

    list_display = (
        'member_name',
        'transaction_type_display',
        'amount_display',
        'reference_number',
        'recorded_by_name',
        'recorded_at',
    )
    list_filter = ('transaction_type', 'recorded_at')
    search_fields = (
        'member__user__email',
        'member__user__firstname',
        'member__user__lastname',
        'reference_number',
    )
    ordering = ['-recorded_at']
    autocomplete_fields = ['member']

    fieldsets = (
        ('Transaction Details', {
            'fields': ('member', 'transaction_type', 'amount', 'reference_number'),
        }),
        ('Notes', {
            'fields': ('remarks',),
        }),
        ('Audit Information (Auto-filled)', {
            'fields': ('recorded_by', 'recorded_at'),
            'classes': ('collapse',),
        }),
    )
    readonly_fields = ('recorded_at',)

    def member_name(self, obj):
        return f"{obj.member.user.firstname} {obj.member.user.lastname}"
    member_name.short_description = 'Member'

    @display(description='Type', label=True)
    def transaction_type_display(self, obj):
        if obj.transaction_type == 'deposit':
            return 'Deposit', 'success'
        return 'Withdrawal', 'danger'

    def amount_display(self, obj):
        prefix = '+' if obj.amount >= 0 else ''
        return f"{prefix}PHP {abs(obj.amount):,.2f}"
    amount_display.short_description = 'Amount'

    def recorded_by_name(self, obj):
        if obj.recorded_by:
            return f"{obj.recorded_by.firstname} {obj.recorded_by.lastname}"
        return '-'
    recorded_by_name.short_description = 'Recorded By'

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(SharedCapital)
class SharedCapitalAdmin(ModelAdmin):
    """Read-only view of shared capital records. Management is handled by Account Member Officer."""

    list_display = (
        'member_name',
        'transaction_type_display',
        'amount_display',
        'reference_number',
        'recorded_by_name',
        'recorded_at',
    )
    list_filter = ('transaction_type', 'recorded_at')
    search_fields = (
        'member__user__email',
        'member__user__firstname',
        'member__user__lastname',
        'reference_number',
    )
    ordering = ['-recorded_at']
    autocomplete_fields = ['member']

    fieldsets = (
        ('Transaction Details', {
            'fields': ('member', 'transaction_type', 'amount', 'reference_number'),
        }),
        ('Notes', {
            'fields': ('remarks',),
        }),
        ('Audit Information (Auto-filled)', {
            'fields': ('recorded_by', 'recorded_at'),
            'classes': ('collapse',),
        }),
    )
    readonly_fields = ('recorded_at',)

    def member_name(self, obj):
        return f"{obj.member.user.firstname} {obj.member.user.lastname}"
    member_name.short_description = 'Member'

    @display(description='Type', label=True)
    def transaction_type_display(self, obj):
        if obj.transaction_type == 'contribution':
            return 'Contribution', 'success'
        return 'Withdrawal', 'danger'

    def amount_display(self, obj):
        prefix = '+' if obj.amount >= 0 else ''
        return f"{prefix}PHP {abs(obj.amount):,.2f}"
    amount_display.short_description = 'Amount'

    def recorded_by_name(self, obj):
        if obj.recorded_by:
            return f"{obj.recorded_by.firstname} {obj.recorded_by.lastname}"
        return '-'
    recorded_by_name.short_description = 'Recorded By'

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(MembershipApprovalLog)
class MembershipApprovalLogAdmin(ModelAdmin):
    """Admin interface for viewing membership approval audit logs."""

    list_display = (
        'user_name',
        'action_display',
        'performed_by_name',
        'performed_at',
        'ip_address',
    )
    list_filter = ('action', 'performed_at')
    search_fields = (
        'user__email',
        'user__firstname',
        'user__lastname',
        'performed_by__email',
    )
    readonly_fields = (
        'user',
        'action',
        'performed_by',
        'rejection_reason',
        'performed_at',
        'ip_address',
    )
    ordering = ['-performed_at']

    def has_add_permission(self, request):
        return False  # Logs are created programmatically only

    def has_change_permission(self, request, obj=None):
        return False  # Logs are immutable

    def user_name(self, obj):
        return f"{obj.user.firstname} {obj.user.lastname}"
    user_name.short_description = 'User'

    @display(description='Action', label=True)
    def action_display(self, obj):
        if obj.action == 'approved':
            return 'Approved', 'success'
        return 'Rejected', 'danger'

    def performed_by_name(self, obj):
        if obj.performed_by:
            return f"{obj.performed_by.firstname} {obj.performed_by.lastname}"
        return '-'
    performed_by_name.short_description = 'Performed By'
