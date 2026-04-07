"""
Custom middleware for eLoan backend.

Includes:
- CORSAndCoopMiddleware: Sets proper CORS and COOP headers for Google OAuth popup flow
"""


class CORSAndCoopMiddleware:
    """
    Middleware to set proper CORS and COOP headers for Google OAuth popup flow.
    
    Allows cross-origin popup windows to communicate with parent window.
    This is necessary for the @react-oauth/google popup flow to work correctly.
    
    Without this:
    - Browser console warning: "Cross-Origin-Opener-Policy policy would block the window.closed call"
    - Google OAuth popup cannot properly communicate with parent window
    
    With this middleware:
    - Popups can check if parent window is still open
    - Secure communication between popup and parent
    - Google OAuth flow completes successfully
    """
    
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        
        # Allow popup windows to access parent (needed for Google OAuth)
        # same-origin-allow-popups: Allow same-origin popups to access parent
        response['Cross-Origin-Opener-Policy'] = 'same-origin-allow-popups'
        
        # require-corp: Require cross-origin resources to explicitly opt-in via CORP header
        response['Cross-Origin-Embedder-Policy'] = 'require-corp'
        
        return response
