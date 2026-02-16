# Django Unfold Admin Setup Guide

Django Unfold is a modern, Tailwind CSS-based admin interface that provides a beautiful and intuitive experience for super administrators.

## Features

- **Modern Design**: Clean, professional Tailwind CSS-based interface
- **Dark Mode**: Automatic dark/light mode support
- **Responsive**: Works perfectly on mobile, tablet, and desktop
- **Custom Branding**: eLoan branding with custom colors (purple theme)
- **Enhanced Navigation**: Organized sidebar with icons and search
- **Advanced Filters**: Better filtering and search capabilities
- **Tab Support**: Quick filters for common queries (Active Users, Suspended, etc.)

## Installation

### Step 1: Install Django Unfold

```bash
cd backend
pip install django-unfold
```

Or install all requirements:
```bash
pip install -r requirements.txt
```

### Step 2: Collect Static Files

Django Unfold uses Tailwind CSS which requires collecting static files:

```bash
python manage.py collectstatic --noinput
```

### Step 3: Run Migrations

```bash
python manage.py migrate
```

### Step 4: Start the Server

```bash
python manage.py runserver
```

## Access the Admin Panel

1. Navigate to: http://127.0.0.1:8000/admin/
2. Login with your superuser credentials
3. You'll see the new modern Unfold interface!

## What's Changed

### Visual Improvements

**Before (Django Default Admin)**:
- Basic blue/gray interface
- Limited customization
- Desktop-focused design

**After (Django Unfold)**:
- Modern purple/pink gradient theme (matching your frontend)
- Clean Tailwind CSS design
- Fully responsive mobile interface
- Dark mode support
- Custom eLoan branding with 💰 icon

### Enhanced Features

1. **Organized Sidebar Navigation**:
   - User Management (Users, Roles)
   - Loan Management
   - Payments
   - Search bar in sidebar

2. **Quick Filter Tabs** (on User list page):
   - All Users
   - Active Users
   - Suspended Users

3. **Better Icons**:
   - Person icon for Users
   - Badge icon for Roles
   - Account Balance icon for Loans
   - Payments icon for Payments

4. **Improved User Experience**:
   - Faster page loads
   - Better mobile experience
   - More intuitive navigation
   - Enhanced search and filtering

## Customization

All customization is in [settings.py](eloan_core/settings.py:199-310) under the `UNFOLD` dictionary.

### Change Site Title

```python
UNFOLD = {
    "SITE_TITLE": "eLoan Administration",
    "SITE_HEADER": "eLoan Super Admin",
    # ...
}
```

### Change Colors

The purple theme is configured in the `COLORS` section:

```python
"COLORS": {
    "primary": {
        "500": "168 85 247",  # Main purple color
        # Adjust these values for different shades
    },
},
```

### Add/Remove Sidebar Items

Modify the `SIDEBAR` > `navigation` section:

```python
"navigation": [
    {
        "title": "User Management",
        "separator": True,
        "items": [
            {
                "title": "Users",
                "icon": "person",
                "link": lambda request: "/admin/users/user/",
            },
            # Add more items here
        ],
    },
],
```

### Available Icons

Django Unfold uses Material Design Icons:
- `person` - User icon
- `badge` - Badge/role icon
- `account_balance` - Money/loan icon
- `payments` - Payment icon
- `settings` - Settings icon
- `dashboard` - Dashboard icon
- `description` - Document icon
- `folder` - Folder icon

Full list: https://fonts.google.com/icons

## Advanced Features

### Custom Dashboard (Optional)

You can create a custom dashboard by setting:

```python
UNFOLD = {
    "DASHBOARD_CALLBACK": "eloan_core.views.dashboard_callback",
    # ...
}
```

Then create `eloan_core/views.py`:

```python
from django.db.models import Count
from users.models import User

def dashboard_callback(request, context):
    context.update({
        "total_users": User.objects.count(),
        "active_users": User.objects.filter(status='active').count(),
        "total_roles": Role.objects.count(),
        # Add more stats
    })
    return context
```

### Custom CSS (Optional)

Add custom styles in `static/css/custom-admin.css`:

```css
/* Custom admin styles */
.custom-class {
    /* Your styles */
}
```

The file is already referenced in settings:
```python
"STYLES": [
    lambda request: "/static/css/custom-admin.css",
],
```

## Troubleshooting

### Static Files Not Loading

**Problem**: Admin looks broken, missing styles

**Solution**:
```bash
python manage.py collectstatic --clear --noinput
python manage.py runserver
```

### Icons Not Showing

**Problem**: Material icons not displaying

**Solution**:
1. Clear browser cache (Ctrl + F5)
2. Run `python manage.py collectstatic` again
3. Check browser console for errors

### Admin Not Using Unfold Theme

**Problem**: Still seeing default Django admin

**Solution**:
1. Check that `unfold` is **before** `django.contrib.admin` in INSTALLED_APPS
2. Restart Django server
3. Clear browser cache

### Database Errors

**Problem**: Migration errors when installing Unfold

**Solution**:
```bash
python manage.py migrate --fake-initial
python manage.py migrate
```

## Production Deployment

### Static Files

In production, configure your web server (Nginx/Apache) to serve static files:

```python
# settings.py
STATIC_ROOT = os.path.join(BASE_DIR, 'staticfiles')
STATIC_URL = '/static/'
```

Then collect static files:
```bash
python manage.py collectstatic --noinput
```

### Performance

Django Unfold is optimized for production:
- Minified Tailwind CSS
- Optimized JavaScript
- Compressed assets
- Fast page loads

## Documentation

- Official Docs: https://unfoldadmin.com/
- GitHub: https://github.com/unfoldadmin/django-unfold
- Changelog: https://unfoldadmin.com/changelog/

## Support

If you encounter issues:
1. Check the official documentation
2. Review the configuration in settings.py
3. Check that all dependencies are installed
4. Ensure static files are collected

## Next Steps

Once Django Unfold is running:
1. Create additional admin users
2. Test the invitation email system
3. Explore the enhanced filters and search
4. Customize the sidebar navigation as needed
5. Add custom dashboard widgets (optional)

---

**Note**: Django Unfold is fully compatible with all your existing admin functionality, including the custom email invitation system and admin actions!
