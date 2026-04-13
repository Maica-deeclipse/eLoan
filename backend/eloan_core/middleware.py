"""
Custom middleware for eLoan backend.

Includes:
- CORSAndCoopMiddleware: Sets COOP headers for Google OAuth popup flow
  and Content-Security-Policy for all responses.
"""

# Origins considered trustworthy by browsers (COOP/COEP only take effect here)
_TRUSTED_HOSTS = {'localhost', '127.0.0.1'}

# CSP for API responses (JSON only — no scripts, styles, or frames needed).
# Admin panel routes get a relaxed policy to allow Django admin UI assets.
_API_CSP = (
    "default-src 'none'; "
    "frame-ancestors 'none';"
)

_ADMIN_CSP = (
    "default-src 'self'; "
    "script-src 'self' 'unsafe-inline'; "   # Django admin uses inline scripts
    "style-src 'self' 'unsafe-inline'; "    # Django admin uses inline styles
    "img-src 'self' data:; "                # Admin uses data URIs for icons
    "font-src 'self'; "
    "frame-ancestors 'none';"
)


class CORSAndCoopMiddleware:
    """
    Middleware to set COOP and CSP headers.

    Cross-Origin-Opener-Policy is only applied on trustworthy origins
    (localhost / 127.0.0.1) because browsers silently ignore it — and log a
    console warning — when the page is served over plain HTTP on a LAN IP.

    Content-Security-Policy uses a strict 'none' default for API routes and
    a relaxed policy for the Django admin panel which serves HTML.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)

        host = request.get_host().split(':')[0]  # strip port
        if host in _TRUSTED_HOSTS:
            response['Cross-Origin-Opener-Policy'] = 'same-origin-allow-popups'

        # Apply appropriate CSP based on route
        if request.path.startswith('/admin/'):
            response['Content-Security-Policy'] = _ADMIN_CSP
        else:
            response['Content-Security-Policy'] = _API_CSP

        return response
