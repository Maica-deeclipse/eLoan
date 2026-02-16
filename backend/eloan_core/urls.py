"""
URL configuration for backend project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/6.0/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

from authentication.login import StaffLoginView, ApplicantLoginView
from authentication.password_reset import (
    SetPasswordView,
    ValidateTokenView,
    ForgotPasswordView
)
from rest_framework_simplejwt.views import TokenRefreshView
from reports.views import reports_dashboard

urlpatterns = [
    path('admin/', admin.site.urls),
    path('admin/reports/dashboard/', reports_dashboard, name='reports_dashboard'),

    # Staff Portal API Modules
    path('api/bookkeeper/', include('bookkeeper.urls', namespace='bookkeeper')),
    path('api/treasurer/', include('treasurer.urls', namespace='treasurer')),

    # Authentication endpoints
    path('api/auth/login/', StaffLoginView.as_view(), name='staff_login'),
    path('api/auth/applicant/login/', ApplicantLoginView.as_view(), name='applicant_login'),
    path('api/auth/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),

    # Password management endpoints
    path('api/auth/forgot-password/', ForgotPasswordView.as_view(), name='forgot_password'),
    path('api/auth/set-password/', SetPasswordView.as_view(), name='set_password'),
    path('api/auth/validate-token/', ValidateTokenView.as_view(), name='validate_token'),

    # Public registration disabled per security requirements
    # Staff users (Bookkeeper, Treasurer, Credit Committee) are created by Super Admin only
    # path('api/auth/register/', RegisterView.as_view(), name='register'),
]

# Serve media files in development
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
