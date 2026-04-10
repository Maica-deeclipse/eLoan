"""
Custom middleware for eLoan backend.

Includes:
- CORSAndCoopMiddleware: Sets proper CORS and COOP headers for Google OAuth popup flow
"""

# Origins considered trustworthy by browsers (COOP/COEP only take effect here)
_TRUSTED_HOSTS = {'localhost', '127.0.0.1'}


class CORSAndCoopMiddleware:
    """
    Middleware to set COOP header for Google OAuth popup flow.

    Cross-Origin-Opener-Policy is only applied on trustworthy origins
    (localhost / 127.0.0.1) because browsers silently ignore it — and log a
    console warning — when the page is served over plain HTTP on a LAN IP.

    Cross-Origin-Embedder-Policy (require-corp) is intentionally NOT set: it
    is not required for Google OAuth and would break loading of any cross-origin
    resource that doesn't include an explicit CORP header.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)

        host = request.get_host().split(':')[0]  # strip port
        if host in _TRUSTED_HOSTS:
            # Allow same-origin popup windows to access parent (needed for
            # Google OAuth popup flow).
            response['Cross-Origin-Opener-Policy'] = 'same-origin-allow-popups'

        return response
