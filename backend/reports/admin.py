from django.contrib import admin
from django.urls import path
from django.shortcuts import render
from django.db.models import Sum, Count, Q, Avg
from django.utils import timezone
from datetime import timedelta
from decimal import Decimal
from loans.models import LoanApplication, LoanType, ApplicationStatus
from payments.models import Payment
from users.models import User


class ReportsAdmin(admin.ModelAdmin):
    """Custom Reports Dashboard"""

    def get_urls(self):
        urls = super().get_urls()
        custom_urls = [
            path('dashboard/', self.admin_site.admin_view(self.reports_dashboard), name='reports_dashboard'),
        ]
        return custom_urls + urls

    def reports_dashboard(self, request):
        """Main reports dashboard view"""

        # Date ranges
        today = timezone.now().date()
        thirty_days_ago = today - timedelta(days=30)
        this_month_start = today.replace(day=1)

        # Loan Statistics
        total_loans = LoanApplication.objects.count()
        active_loans = LoanApplication.objects.filter(
            current_status__status_name__icontains='active'
        ).count()
        pending_loans = LoanApplication.objects.filter(
            current_status__status_name__icontains='pending'
        ).count()

        # Amount Statistics
        total_loan_amount = LoanApplication.objects.aggregate(
            total=Sum('amount_requested')
        )['total'] or Decimal('0.00')

        total_disbursed = LoanApplication.objects.filter(
            current_status__status_name__in=['Approved', 'Active', 'Paid']
        ).aggregate(
            total=Sum('amount_requested')
        )['total'] or Decimal('0.00')

        total_collected = Payment.objects.aggregate(
            total=Sum('amount_paid')
        )['total'] or Decimal('0.00')

        # This month's statistics
        this_month_loans = LoanApplication.objects.filter(
            application_date__gte=this_month_start
        ).count()

        this_month_payments = Payment.objects.filter(
            payment_date__gte=this_month_start
        ).aggregate(
            total=Sum('amount_paid')
        )['total'] or Decimal('0.00')

        # Loan Types Breakdown
        loan_types_stats = LoanType.objects.annotate(
            total_applications=Count('loan_applications'),
            total_amount=Sum('loan_applications__amount_requested'),
        ).order_by('-total_applications')

        # Status Breakdown
        status_stats = ApplicationStatus.objects.annotate(
            count=Count('loanapplication')
        ).order_by('-count')

        # Recent Applications (Last 30 days)
        recent_applications = LoanApplication.objects.filter(
            application_date__gte=thirty_days_ago
        ).count()

        # Payment Methods Breakdown
        payment_methods = Payment.objects.values('payment_method').annotate(
            total=Sum('amount_paid'),
            count=Count('id')
        ).order_by('-total')

        # User Statistics
        total_users = User.objects.count()
        active_users = User.objects.filter(status='active').count()

        # Collection Rate
        total_expected = LoanApplication.objects.filter(
            current_status__status_name__in=['Approved', 'Active', 'Paid']
        ).aggregate(
            total=Sum('total_payable')
        )['total'] or Decimal('0.00')

        collection_rate = (total_collected / total_expected * 100) if total_expected > 0 else 0

        # Default Rate (loans with overdue payments - simplified)
        # This is a placeholder calculation
        default_count = 0
        default_rate = 0

        context = {
            'title': 'Reports Dashboard',
            'has_permission': True,
            'site_title': 'eLoan Administration',
            'site_header': 'eLoan Reports',

            # Summary Statistics
            'total_loans': total_loans,
            'active_loans': active_loans,
            'pending_loans': pending_loans,
            'total_users': total_users,
            'active_users': active_users,

            # Financial Statistics
            'total_loan_amount': total_loan_amount,
            'total_disbursed': total_disbursed,
            'total_collected': total_collected,
            'collection_rate': round(collection_rate, 2),

            # This Month
            'this_month_loans': this_month_loans,
            'this_month_payments': this_month_payments,
            'recent_applications': recent_applications,

            # Breakdowns
            'loan_types_stats': loan_types_stats,
            'status_stats': status_stats,
            'payment_methods': payment_methods,

            # Rates
            'default_rate': default_rate,
        }

        return render(request, 'admin/reports/dashboard.html', context)


# No model registration needed - Reports is accessed via custom URL
