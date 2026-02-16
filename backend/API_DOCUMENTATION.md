# eLoan API Documentation

## Authentication & Authorization

### Overview
The eLoan system implements a role-based access control system for staff members. Only authorized staff can access the system.

**Authorized Roles:**
- Super Administrator (full access)
- Bookkeeper (manage transactions, reports)
- Treasurer (approve disbursements, review balances)
- Credit Committee (evaluate loan applications)

---

## API Endpoints

### 1. Staff Login
**Endpoint:** `POST /api/auth/login/`

**Description:** Login for staff members with role validation.

**Request Body:**
```json
{
  "email": "staff@example.com",
  "password": "yourpassword"
}
```

**Success Response (200 OK):**
```json
{
  "message": "Login successful.",
  "user": {
    "id": 1,
    "email": "staff@example.com",
    "firstname": "John",
    "lastname": "Doe",
    "role": "Bookkeeper",
    "status": "active"
  },
  "tokens": {
    "refresh": "eyJ0eXAiOiJKV1QiLCJhbGc...",
    "access": "eyJ0eXAiOiJKV1QiLCJhbGc..."
  }
}
```

**Error Responses:**
- `400 Bad Request` - Invalid credentials
- `400 Bad Request` - Account suspended
- `400 Bad Request` - Unauthorized role

---

### 2. Refresh Token
**Endpoint:** `POST /api/auth/token/refresh/`

**Description:** Get a new access token using refresh token.

**Request Body:**
```json
{
  "refresh": "eyJ0eXAiOiJKV1QiLCJhbGc..."
}
```

**Success Response (200 OK):**
```json
{
  "access": "eyJ0eXAiOiJKV1QiLCJhbGc..."
}
```

---

### 3. Forgot Password
**Endpoint:** `POST /api/auth/forgot-password/`

**Description:** Request a password reset link via email.

**Request Body:**
```json
{
  "email": "staff@example.com"
}
```

**Success Response (200 OK):**
```json
{
  "message": "If an account exists with this email, a password reset link will be sent."
}
```

**Note:** For security, the same message is returned whether the account exists or not.

---

### 4. Validate Reset Token
**Endpoint:** `POST /api/auth/validate-token/`

**Description:** Check if a password reset token is valid.

**Request Body:**
```json
{
  "uid": "encoded-user-id",
  "token": "reset-token"
}
```

**Success Response (200 OK):**
```json
{
  "valid": true,
  "email": "staff@example.com",
  "firstname": "John",
  "lastname": "Doe"
}
```

**Error Response (400 Bad Request):**
```json
{
  "valid": false,
  "message": "This link has expired or is invalid."
}
```

---

### 5. Set Password
**Endpoint:** `POST /api/auth/set-password/`

**Description:** Set a new password using a reset token (for new users or password reset).

**Request Body:**
```json
{
  "uid": "encoded-user-id",
  "token": "reset-token",
  "new_password": "newpassword123",
  "confirm_password": "newpassword123"
}
```

**Success Response (200 OK):**
```json
{
  "message": "Password set successfully. You can now log in.",
  "email": "staff@example.com"
}
```

**Error Responses:**
- `400 Bad Request` - Passwords don't match
- `400 Bad Request` - Invalid token
- `400 Bad Request` - Password too short (minimum 8 characters)

---

## Using Permission Classes

### Available Permission Classes

Import from `authentication.permissions`:

```python
from authentication.permissions import (
    IsStaffMember,
    IsBookkeeper,
    IsTreasurer,
    IsCreditCommittee,
    IsBookkeeperOrTreasurer,
    IsSuperAdministrator
)
```

### Example Usage in Views

```python
from rest_framework.views import APIView
from rest_framework.response import Response
from authentication.permissions import IsBookkeeper

class TransactionListView(APIView):
    permission_classes = [IsBookkeeper]

    def get(self, request):
        # Only Bookkeepers (and Super Admin) can access this
        return Response({"transactions": []})
```

### Example Usage with ViewSets

```python
from rest_framework import viewsets
from authentication.permissions import IsCreditCommittee

class LoanApplicationViewSet(viewsets.ModelViewSet):
    permission_classes = [IsCreditCommittee]
    # Only Credit Committee (and Super Admin) can access
```

---

## Authentication Flow

### For New Users (Invitation-based)

1. **Super Admin creates user account** in Django admin panel
2. **System sends invitation email** with password reset link
3. **User clicks link** and is redirected to frontend set-password page
4. **Frontend validates token** using `/api/auth/validate-token/`
5. **User sets password** using `/api/auth/set-password/`
6. **User logs in** using `/api/auth/login/`

### For Existing Users (Login)

1. **User enters email and password** on login page
2. **Frontend sends request** to `/api/auth/login/`
3. **Backend validates credentials and role**
4. **System returns JWT tokens** (access + refresh)
5. **Frontend stores tokens** and redirects to dashboard
6. **Frontend includes access token** in Authorization header for protected requests

### Forgot Password Flow

1. **User clicks "Forgot Password?"** on login page
2. **User enters email** and submits
3. **Frontend sends request** to `/api/auth/forgot-password/`
4. **System sends reset link via email**
5. **User follows link** and sets new password
6. **User logs in** with new password

---

## Protected API Requests

Include the access token in the Authorization header:

```
Authorization: Bearer <access_token>
```

Example with fetch:
```javascript
fetch('http://localhost:8000/api/some-endpoint/', {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  }
})
```

Example with axios:
```javascript
axios.get('http://localhost:8000/api/some-endpoint/', {
  headers: {
    'Authorization': `Bearer ${accessToken}`
  }
})
```

---

## Token Expiration

- **Access Token:** 60 minutes
- **Refresh Token:** 1 day

When access token expires, use the refresh token endpoint to get a new one.

---

## Security Features

1. **No Public Registration:** Only Super Admin can create accounts
2. **Role Validation:** Login validates authorized staff roles
3. **Account Status Check:** Suspended accounts cannot log in
4. **Secure Password Reset:** Token-based with expiration
5. **JWT Authentication:** Stateless, secure token system
6. **CORS Protection:** Only allowed origins can access API

---

## Development Setup

1. Ensure email backend is configured in settings.py
2. For development, emails print to console
3. For production, configure SMTP settings via environment variables

---

## Error Handling

All endpoints return appropriate HTTP status codes:

- `200 OK` - Success
- `400 Bad Request` - Invalid input or validation error
- `401 Unauthorized` - Missing or invalid authentication
- `403 Forbidden` - Insufficient permissions
- `500 Internal Server Error` - Server error
