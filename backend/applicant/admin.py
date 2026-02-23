"""
Applicant Module Admin Configuration
"""

from django.contrib import admin
from unfold.admin import ModelAdmin
from .models import ApplicantProfile, CoMakerInfo, ESignature, LoanTypeCoMakerRequirement


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


@admin.register(ESignature)
class ESignatureAdmin(ModelAdmin):
    list_display = ('loan_application', 'terms_accepted', 'signed_at', 'ip_address')
    list_filter = ('terms_accepted', 'terms_version', 'signed_at')
    search_fields = ('loan_application__user__email',)
    readonly_fields = ('signed_at',)


@admin.register(LoanTypeCoMakerRequirement)
class LoanTypeCoMakerRequirementAdmin(ModelAdmin):
    list_display = ('loan_type', 'required_comakers')
    list_filter = ('required_comakers',)
    search_fields = ('loan_type__loan_name',)
