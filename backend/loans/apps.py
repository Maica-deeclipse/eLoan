from django.apps import AppConfig


class LoansConfig(AppConfig):
    name = 'loans'
    default_auto_field = 'django.db.models.BigAutoField'

    def ready(self):
        """Import signals when app is ready."""
        import loans.signals  # noqa: F401
