from django.contrib import admin
from django.utils.html import format_html
from unfold.admin import ModelAdmin, TabularInline
from unfold.decorators import display
from .models import (
    LoanType, ApplicationStatus, LoanApplication,
    LoanCoMaker, LoanDocument, FaceVerification,
    LivenessCheck, AuditLog
)


class LoanCoMakerInline(TabularInline):
    model = LoanCoMaker
    extra = 0
    fields = ('user', 'agreed_at')
    readonly_fields = ('agreed_at',)


class LoanDocumentInline(TabularInline):
    model = LoanDocument
    extra = 0
    fields = ('document_type', 'file_path', 'verified', 'verified_by', 'uploaded_at')
    readonly_fields = ('uploaded_at',)


@admin.register(LoanType)
class LoanTypeAdmin(ModelAdmin):
    list_display = ('loan_name', 'min_amount', 'max_amount', 'interest_rate', 'max_term_months', 'is_active')
    list_filter = ('is_active', 'created_at')
    search_fields = ('loan_name', 'description')
    ordering = ('-created_at',)

    fieldsets = (
        ('Loan Information', {
            'fields': ('loan_name', 'description', 'is_active')
        }),
        ('Amount & Terms', {
            'fields': ('min_amount', 'max_amount', 'interest_rate', 'max_term_months')
        }),
    )


@admin.register(ApplicationStatus)
class ApplicationStatusAdmin(ModelAdmin):
    list_display = ('status_name', 'application_count')
    search_fields = ('status_name',)

    def application_count(self, obj):
        count = obj.loanapplication_set.count()
        return format_html('<span style="font-weight: 600;">{}</span>', count)
    application_count.short_description = 'Applications'


@admin.register(LoanApplication)
class LoanApplicationAdmin(ModelAdmin):
    list_display = ('id', 'user_name', 'loan_type', 'amount_requested', 'term_months', 'status_badge', 'application_date', 'payment_progress')
    list_filter = ('current_status', 'loan_type', 'application_date')
    search_fields = ('user__email', 'user__firstname', 'user__lastname', 'purpose')
    ordering = ('-application_date',)
    date_hierarchy = 'application_date'

    inlines = [LoanCoMakerInline, LoanDocumentInline]

    fieldsets = (
        ('Applicant Information', {
            'fields': ('user',)
        }),
        ('Loan Details', {
            'fields': ('loan_type', 'amount_requested', 'term_months', 'purpose')
        }),
        ('Calculated Amounts', {
            'fields': ('monthly_amortization', 'total_payable')
        }),
        ('Status', {
            'fields': ('current_status', 'application_date')
        }),
    )

    readonly_fields = ('application_date',)

    def user_name(self, obj):
        return f"{obj.user.firstname} {obj.user.lastname}"
    user_name.short_description = 'Applicant'

    @display(description='Status', label=True)
    def status_badge(self, obj):
        if not obj.current_status:
            return format_html(
                '<span class="status-badge pending">Pending</span>'
            )

        status = obj.current_status.status_name.lower()
        badge_class = 'pending'

        if 'approve' in status or 'active' in status:
            badge_class = 'approved'
        elif 'reject' in status or 'denied' in status:
            badge_class = 'rejected'
        elif 'paid' in status or 'completed' in status:
            badge_class = 'paid'

        return format_html(
            '<span class="status-badge {}">{}</span>',
            badge_class,
            obj.current_status.status_name
        )

    def payment_progress(self, obj):
        if not obj.total_payable or obj.total_payable == 0:
            return format_html('<span style="color: #999;">N/A</span>')

        paid = obj.total_paid
        total = obj.total_payable
        percentage = (paid / total * 100) if total > 0 else 0

        color = '#10b981' if percentage >= 100 else '#3b82f6' if percentage >= 50 else '#f59e0b'

        return format_html(
            '<div style="display: flex; align-items: center; gap: 8px;">'
            '<div style="flex: 1; background: #e5e7eb; border-radius: 999px; height: 8px; overflow: hidden;">'
            '<div style="width: {}%; background: {}; height: 100%;"></div>'
            '</div>'
            '<span style="font-size: 12px; font-weight: 600; color: {};">{:.1f}%</span>'
            '</div>',
            min(percentage, 100), color, color, percentage
        )
    payment_progress.short_description = 'Payment Progress'

    actions = ['approve_applications', 'reject_applications']

    def approve_applications(self, request, queryset):
        try:
            approved_status = ApplicationStatus.objects.get(status_name__iexact='Approved')
            updated = queryset.update(current_status=approved_status)
            self.message_user(request, f'{updated} application(s) approved successfully.', level='SUCCESS')
        except ApplicationStatus.DoesNotExist:
            self.message_user(request, 'Approved status not found. Please create it first.', level='ERROR')
    approve_applications.short_description = '✅ Approve selected applications'

    def reject_applications(self, request, queryset):
        try:
            rejected_status = ApplicationStatus.objects.get(status_name__iexact='Rejected')
            updated = queryset.update(current_status=rejected_status)
            self.message_user(request, f'{updated} application(s) rejected.', level='WARNING')
        except ApplicationStatus.DoesNotExist:
            self.message_user(request, 'Rejected status not found. Please create it first.', level='ERROR')
    reject_applications.short_description = '❌ Reject selected applications'


@admin.register(LoanCoMaker)
class LoanCoMakerAdmin(ModelAdmin):
    list_display = ('application', 'user', 'agreed_at')
    list_filter = ('agreed_at',)
    search_fields = ('user__email', 'user__firstname', 'user__lastname', 'application__id')
    ordering = ('-agreed_at',)
    readonly_fields = ('agreed_at',)


@admin.register(LoanDocument)
class LoanDocumentAdmin(ModelAdmin):
    list_display = ('loan_application', 'document_type', 'verification_badge', 'uploaded_at', 'verified_by')
    list_filter = ('verified', 'document_type', 'uploaded_at')
    search_fields = ('loan_application__id', 'document_type')
    ordering = ('-uploaded_at',)
    readonly_fields = ('uploaded_at',)

    @display(description='Verification', label=True)
    def verification_badge(self, obj):
        if obj.verified:
            return format_html(
                '<span class="status-badge approved">✓ Verified</span>'
            )
        return format_html(
            '<span class="status-badge pending">⏳ Pending</span>'
        )

    actions = ['verify_documents']

    def verify_documents(self, request, queryset):
        from django.utils import timezone
        updated = queryset.update(
            verified=True,
            verified_by=request.user,
            verified_at=timezone.now()
        )
        self.message_user(request, f'{updated} document(s) verified.', level='SUCCESS')
    verify_documents.short_description = '✅ Verify selected documents'


@admin.register(FaceVerification)
class FaceVerificationAdmin(ModelAdmin):
    list_display = ('loan_application', 'match_score', 'verification_status', 'verified_by', 'created_at')
    list_filter = ('verification_status', 'created_at')
    search_fields = ('loan_application__id',)
    ordering = ('-created_at',)
    readonly_fields = ('created_at',)


@admin.register(LivenessCheck)
class LivenessCheckAdmin(ModelAdmin):
    list_display = ('loan_application', 'method', 'confidence_score', 'check_status', 'verified_by', 'created_at')
    list_filter = ('check_status', 'method', 'created_at')
    search_fields = ('loan_application__id',)
    ordering = ('-created_at',)
    readonly_fields = ('created_at',)


@admin.register(AuditLog)
class AuditLogAdmin(ModelAdmin):
    list_display = ('user', 'action_preview', 'timestamp', 'ip_address')
    list_filter = ('timestamp',)
    search_fields = ('user__email', 'action', 'ip_address')
    ordering = ('-timestamp',)
    readonly_fields = ('timestamp',)

    def action_preview(self, obj):
        return obj.action[:100] + '...' if len(obj.action) > 100 else obj.action
    action_preview.short_description = 'Action'

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False
