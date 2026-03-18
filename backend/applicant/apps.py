from django.apps import AppConfig


class ApplicantConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'applicant'
    verbose_name = 'Applicant Module'

    def ready(self):
        """Warm up DeepFace/TensorFlow model on server startup to avoid first-request timeout."""
        import threading

        def warmup():
            try:
                import logging
                logger = logging.getLogger('face_verification')
                logger.info('[ApplicantConfig] Warming up DeepFace ArcFace model...')
                from deepface import DeepFace
                import numpy as np
                dummy = np.zeros((112, 112, 3), dtype=np.uint8)
                DeepFace.represent(dummy, model_name='ArcFace', detector_backend='skip', enforce_detection=False)
                logger.info('[ApplicantConfig] DeepFace ArcFace model warm-up complete.')
            except Exception as e:
                import logging
                logging.getLogger('face_verification').warning(f'[ApplicantConfig] DeepFace warm-up failed (non-fatal): {e}')

        threading.Thread(target=warmup, daemon=True).start()
