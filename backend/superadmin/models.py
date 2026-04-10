"""
Superadmin Module Models

Handles termination and disciplinary system based on cooperative by-laws:
- Violation tracking
- Disciplinary actions (warning, suspension, termination)
- Case history logs
"""

from django.db import models
from django.conf import settings
from django.utils import timezone


class Violation(models.Model):
    """
    Records violations committed by members.
    Super Admin logs violations; system flags member for review.
    """

    VIOLATION_TYPE_CHOICES = [
        ('failure_to_pay', 'Failure to Pay Obligations'),
        ('not_patronizing', 'Not Patronizing Cooperative Services'),
        ('policy_violation', 'Policy Violation'),
        ('fraud', 'Fraud / Suspicious Activity'),
        ('misconduct', 'Misconduct or Unethical Behavior'),
        ('other', 'Other'),
    ]

    SEVERITY_CHOICES = [
        ('minor', 'Minor'),
        ('moderate', 'Moderate'),
        ('severe', 'Severe'),
    ]

    member = models.ForeignKey(
        'users.Applicant',
        on_delete=models.CASCADE,
        related_name='violations',
    )
    violation_type = models.CharField(max_length=30, choices=VIOLATION_TYPE_CHOICES)
    description = models.TextField()
    date_of_violation = models.DateField()
    severity = models.CharField(max_length=10, choices=SEVERITY_CHOICES, default='minor')

    STATUS_CHOICES = [
        ('open', 'Open'),
        ('resolved', 'Resolved'),
        ('escalated', 'Escalated'),
    ]
    status = models.CharField(max_length=15, choices=STATUS_CHOICES, default='open')

    logged_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='violations_logged'
    )
    logged_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Violation'
        verbose_name_plural = 'Violations'
        ordering = ['-logged_at']

    def __str__(self):
        return f"{self.member.email} - {self.get_violation_type_display()} ({self.get_severity_display()})"

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        # Flag member as Under Review when violation is logged (if currently active)
        member = self.member
        if member.membership_status == 'active':
            member.membership_status = 'under_review'
            member.save(update_fields=['membership_status', 'profile_updated_at'])


class DisciplinaryAction(models.Model):
    """
    Disciplinary action taken by Super Admin based on violation(s).
    Automatically updates member membership_status.
    """

    ACTION_TYPE_CHOICES = [
        ('warning', 'Warning'),
        ('suspension', 'Suspension'),
        ('termination', 'Termination'),
        ('reinstatement', 'Reinstatement'),
    ]

    member = models.ForeignKey(
        'users.Applicant',
        on_delete=models.CASCADE,
        related_name='disciplinary_actions',
    )
    violations = models.ManyToManyField(
        Violation,
        blank=True,
        related_name='disciplinary_actions',
        help_text='Violations that led to this action.'
    )
    action_type = models.CharField(max_length=15, choices=ACTION_TYPE_CHOICES)
    reason = models.TextField(help_text='Reason for this disciplinary action.')
    effective_date = models.DateField(default=timezone.now)
    decided_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='disciplinary_decisions'
    )
    decided_at = models.DateTimeField(auto_now_add=True)

    # For suspension: optional end date
    suspension_end_date = models.DateField(
        null=True, blank=True,
        help_text='End date for suspension (leave blank for indefinite).'
    )
    notes = models.TextField(blank=True, null=True)

    class Meta:
        verbose_name = 'Disciplinary Action'
        verbose_name_plural = 'Disciplinary Actions'
        ordering = ['-decided_at']

    def __str__(self):
        return f"{self.member.email} - {self.get_action_type_display()} on {self.effective_date}"

    def apply(self):
        """Apply the disciplinary action to the member's status."""
        member = self.member
        status_map = {
            'warning': 'warned',
            'suspension': 'suspended',
            'termination': 'terminated',
            'reinstatement': 'active',
        }
        new_status = status_map.get(self.action_type)
        if new_status:
            member.membership_status = new_status
            member.save(update_fields=['membership_status', 'profile_updated_at'])

            # Disable user account for termination/suspension
            if self.action_type == 'termination':
                member.status = 'suspended'
                member.save(update_fields=['status'])
            elif self.action_type == 'reinstatement':
                member.status = 'active'
                member.save(update_fields=['status'])


class TerminationRecord(models.Model):
    """
    Formal termination record when a member's membership is ended.
    Tracks type and disables loan access.
    """

    TERMINATION_TYPE_CHOICES = [
        ('disciplinary', 'Disciplinary Termination'),
        ('voluntary', 'Voluntary Withdrawal'),
        ('deceased', 'Deceased'),
    ]

    member = models.OneToOneField(
        'users.Applicant',
        on_delete=models.CASCADE,
        related_name='termination_record',
    )
    termination_type = models.CharField(max_length=15, choices=TERMINATION_TYPE_CHOICES)
    reason = models.TextField()
    effective_date = models.DateField(default=timezone.now)
    processed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='terminations_processed'
    )
    processed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Termination Record'
        verbose_name_plural = 'Termination Records'
        ordering = ['-processed_at']

    def __str__(self):
        return f"{self.member.email} - {self.get_termination_type_display()}"
