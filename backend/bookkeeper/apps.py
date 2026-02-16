from django.apps import AppConfig


class BookkeeperConfig(AppConfig):
    """
    Django app configuration for Bookkeeper module.

    Design Decision:
    - Registers signals on app ready for automatic notification creation
    """
    name = 'bookkeeper'
    default_auto_field = 'django.db.models.BigAutoField'
    verbose_name = 'Bookkeeper Module'

    def ready(self):
        """Import signals when app is ready."""
        import bookkeeper.signals  # noqa
