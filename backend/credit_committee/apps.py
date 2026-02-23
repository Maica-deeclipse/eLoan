from django.apps import AppConfig


class CreditCommitteeConfig(AppConfig):
    """
    Django app configuration for Credit Committee module.
    """
    name = 'credit_committee'
    default_auto_field = 'django.db.models.BigAutoField'
    verbose_name = 'Credit Committee Module'
