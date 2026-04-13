"""
Custom DRF exception handler — normalises all API error responses to:

    { "error": "<human-readable message>", "details": {...} }

`details` is only present for validation errors that carry field-level info.
This gives the mobile app and web frontend a single, predictable error shape.
"""

from rest_framework.views import exception_handler
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response


def eloan_exception_handler(exc, context):
    """Wrap DRF's default handler output into a consistent error envelope."""
    response = exception_handler(exc, context)

    if response is None:
        # Non-DRF exception — let Django's 500 handling take over.
        return None

    data = response.data

    # Already in our format (views that manually return {'error': ...})
    if isinstance(data, dict) and 'error' in data and len(data) <= 2:
        return response

    # DRF default: {'detail': ErrorDetail(...)}
    if isinstance(data, dict) and 'detail' in data and len(data) == 1:
        response.data = {'error': str(data['detail'])}
        return response

    # Validation errors — may be field-level or non-field
    if isinstance(exc, ValidationError):
        if isinstance(data, dict):
            # Check for a top-level 'error' key wrapping a string (our serialiser pattern)
            if 'error' in data and isinstance(data['error'], str):
                return response  # already well-formed

            # Field-level: {'email': ['...'], 'password': ['...']}
            # Flatten to a readable summary + keep details for the frontend
            non_field = data.pop('non_field_errors', [])
            summary_parts = []
            if non_field:
                summary_parts.extend([str(m) for m in non_field])
            for field, messages in data.items():
                if field == 'error':
                    summary_parts.append(str(messages) if isinstance(messages, str) else str(messages[0]))
                elif isinstance(messages, list):
                    summary_parts.append(str(messages[0]))
                else:
                    summary_parts.append(str(messages))

            summary = summary_parts[0] if summary_parts else 'Validation error.'
            details = {k: [str(m) for m in v] if isinstance(v, list) else str(v)
                       for k, v in data.items()}
            response.data = {'error': summary, **(({'details': details}) if details else {})}
            return response

        if isinstance(data, list):
            # Non-field validation errors returned as a list
            response.data = {'error': str(data[0]) if data else 'Validation error.'}
            return response

    # Fallback — stringify whatever DRF returned
    response.data = {'error': str(data)}
    return response
