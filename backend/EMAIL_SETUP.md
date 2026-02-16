# Gmail Email Setup Guide

This guide will help you configure Gmail to send real invitation emails from the eLoan system.

## Step 1: Install Required Package

First, install the `python-decouple` package:

```bash
cd backend
pip install python-decouple
```

Or install all requirements:
```bash
pip install -r requirements.txt
```

## Step 2: Generate Gmail App Password

You need a special "App Password" (not your regular Gmail password):

### Enable 2-Step Verification
1. Go to https://myaccount.google.com/security
2. Under "How you sign in to Google", click **2-Step Verification**
3. Follow the steps to enable it (if not already enabled)

### Generate App Password
1. Go to https://myaccount.google.com/apppasswords
2. Select **Mail** for the app type
3. Select **Other (Custom name)** for the device
4. Enter `eLoan Django` as the custom name
5. Click **Generate**
6. **Copy the 16-character password** shown (spaces don't matter)
   - Example: `abcd efgh ijkl mnop`
7. Save it somewhere secure - you won't see it again!

**Important:** This is NOT your regular Gmail password. It's a special password just for this app.

## Step 3: Create .env File

Create a file named `.env` in the `backend` directory (same folder as `manage.py`):

```bash
# In backend directory
# Copy the example file
cp .env.example .env
```

Or create it manually with this content:

```env
# Email Configuration
EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USE_TLS=True

# Replace with YOUR Gmail address
EMAIL_HOST_USER=your-email@gmail.com

# Replace with the 16-character App Password you just generated
EMAIL_HOST_PASSWORD=abcd efgh ijkl mnop

# From address (usually same as EMAIL_HOST_USER)
DEFAULT_FROM_EMAIL=your-email@gmail.com

# Frontend URL
FRONTEND_URL=http://localhost:3000
```

**Replace:**
- `your-email@gmail.com` with your actual Gmail address
- `abcd efgh ijkl mnop` with the app password you generated

## Step 4: Update .gitignore

Make sure `.env` is in your `.gitignore` file so you don't commit your credentials:

```bash
# Add to backend/.gitignore
.env
*.env
```

## Step 5: Test Email Sending

### Start Django Server
```bash
cd backend
python manage.py runserver
```

### Test with Admin Action
1. Go to http://127.0.0.1:8000/admin/
2. Login as superuser
3. Navigate to Users
4. From Actions dropdown, select "📧 Send test email (check console)"
5. Click "Go"
6. Check your Django terminal for output

**Expected output:**
```
================================================================================
📧 SENDING TEST EMAIL
================================================================================
This is a test to verify your email configuration.
================================================================================

✅ Test email sent successfully! Check console output above.
```

**If you see this, emails are working!** The test email was sent to `test@example.com`, so you won't receive it, but it confirms SMTP is configured correctly.

### Create a Real User
1. In Django Admin, go to Users → Add User
2. Fill in:
   - Email: **Use a real email address you can access**
   - First name: Test
   - Last name: User
   - Role: Bookkeeper (or any role)
3. Click "Save"

**Check your terminal for:**
```
================================================================================
📧 SENDING INVITATION EMAIL
================================================================================
To: test@real-email.com
From: your-email@gmail.com
Subject: Welcome to eLoan - Set Your Password

Password Reset Link:
http://localhost:3000/set-password/...
================================================================================

✅ SUCCESS: Invitation email sent to test@real-email.com
```

**Check your email inbox** (the address you entered) for the invitation email!

## Troubleshooting

### Error: "SMTPAuthenticationError"
**Problem:** Gmail rejected your credentials

**Solutions:**
1. Double-check your App Password (16 characters, remove spaces)
2. Make sure you're using an App Password, NOT your regular Gmail password
3. Verify 2-Step Verification is enabled
4. Try generating a new App Password

### Error: "SMTPServerDisconnected" or "Connection timeout"
**Problem:** Can't connect to Gmail's SMTP server

**Solutions:**
1. Check your internet connection
2. Make sure port 587 is not blocked by your firewall
3. Try using port 465 with `EMAIL_USE_SSL=True` instead:
   ```env
   EMAIL_PORT=465
   EMAIL_USE_SSL=True
   EMAIL_USE_TLS=False
   ```

### Error: Module 'decouple' not found
**Problem:** python-decouple not installed

**Solution:**
```bash
pip install python-decouple
```

### Emails not being sent
**Problem:** Still using console backend

**Solutions:**
1. Verify `.env` file exists in `backend` directory (same folder as `manage.py`)
2. Check `EMAIL_BACKEND` in `.env` is set to `django.core.mail.backends.smtp.EmailBackend`
3. Restart your Django server after changing `.env`

### Gmail blocking sign-in
**Problem:** Gmail security blocking access

**Solutions:**
1. Make sure you're using App Password, not regular password
2. Check https://myaccount.google.com/notifications for security alerts
3. You may need to allow the sign-in attempt

## Development vs Production

### Development (Current Setup)
- Uses Gmail SMTP
- Emails sent from your Gmail account
- Good for testing with small number of emails
- Free

### Production (Future)
For production, consider:
- **SendGrid**: 100 emails/day free, professional email service
- **Mailgun**: 5,000 emails/month free
- **Amazon SES**: Very cheap, highly scalable
- **Company Email Server**: If your organization has one

## Security Best Practices

1. ✅ **Never commit `.env` file to git** - It contains your password!
2. ✅ **Use App Passwords** - More secure than regular password
3. ✅ **Rotate passwords** - Change App Password if compromised
4. ✅ **Limit permissions** - App Password only has email access
5. ✅ **Monitor usage** - Check Gmail sent folder for unexpected emails

## Next Steps

Once email is working:
1. Test creating multiple users
2. Test password reset flow
3. Test resend invitation action
4. Verify users receive emails correctly
5. Test the entire authentication flow

## Support

If you continue having issues:
1. Check Django console for error messages
2. Verify all settings in `.env` file
3. Test with the "Send test email" admin action first
4. Make sure your Gmail account has 2-Step Verification enabled
