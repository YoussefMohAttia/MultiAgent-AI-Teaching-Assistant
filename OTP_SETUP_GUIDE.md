# OTP Email Verification - Setup Guide

## Quick Start

The OTP email verification system is now fully integrated. Here's how to set it up and test it.

## Step 1: Configure Email Settings

Edit your `.env` file in the Backend folder:

```bash
# Gmail SMTP (recommended for testing)
SMTP_SERVER=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-specific-password
SENDER_EMAIL=your-email@gmail.com
OTP_EXPIRATION_MINUTES=10
```

### Setting up Gmail SMTP

1. Go to https://myaccount.google.com/apppasswords
2. Select "Mail" and "Windows Computer" (or your setup)
3. Generate app password (16 characters with spaces)
4. Copy the password (remove spaces) and paste in SMTP_PASSWORD
5. Use your full Gmail address for SMTP_USER and SENDER_EMAIL

### For Development (Without Email)

If you don't configure email, OTP will be printed to the console:
```
⚠️  Email service not configured. OTP will not be sent.
   OTP for user@example.com: 123456
```

This allows you to test the full flow without email setup.

## Step 2: Start Backend

```bash
cd Backend
python main.py
```

The database will automatically create the `otp_verifications` table on startup.

## Step 3: Start Frontend

```bash
cd Frontend
npm run dev
```

## Step 4: Test the Flow

### Create Account with OTP

1. **Go to Sign-In page**
   - Frontend should be at http://localhost:5173

2. **Click "Create account" button**
   - You should see two mode buttons (Create account / Sign in)

3. **Enter your email**
   - Click "Send OTP"
   - Wait for OTP to be sent (or check console for dev mode)

4. **Enter the 6-digit OTP**
   - Check your email inbox (or console if dev mode)
   - Enter the code in the OTP field
   - Click "Verify OTP"

5. **Enter account details**
   - After verification, see green ✓ badge
   - Enter your name and password
   - Click "Create account"

6. **Success!**
   - You should be logged in and redirected to Dashboard

### Test Sign In (No OTP Needed)

After account creation, switch to "Sign in" mode:
- Use same email and password
- No OTP required for existing users

## API Endpoints Reference

### 1. Send OTP
```bash
POST /api/login/send-otp
Content-Type: application/json

{
  "email": "user@example.com"
}

Response (200):
{
  "success": true,
  "message": "OTP sent to email",
  "email": "user@example.com"
}

Response (409):
{
  "detail": "Email already registered"
}
```

### 2. Verify OTP
```bash
POST /api/login/verify-otp
Content-Type: application/json

{
  "email": "user@example.com",
  "otp_code": "123456"
}

Response (200):
{
  "success": true,
  "message": "OTP verified successfully"
}

Response (401):
{
  "detail": "Invalid or expired OTP code"
}
```

### 3. Register with OTP
```bash
POST /api/login/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123",
  "name": "John Doe",
  "otp_code": "123456"
}

Response (200):
{
  "access_token": "eyJ0eXAiOiJKV1QiLCJhbGc..."
}

Response (401):
{
  "detail": "Email not verified. Please verify your email with OTP first."
}

Response (409):
{
  "detail": "An account with this email already exists"
}
```

### 4. Login (No OTP)
```bash
POST /api/login/password
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}

Response (200):
{
  "access_token": "eyJ0eXAiOiJKV1QiLCJhbGc..."
}

Response (401):
{
  "detail": "Invalid email or password"
}
```

## Database Schema

### otp_verifications Table

```sql
CREATE TABLE otp_verifications (
    id INTEGER PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    otp_code VARCHAR(6) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP NOT NULL,
    is_verified INTEGER DEFAULT 0,
    attempts INTEGER DEFAULT 0
);

CREATE INDEX idx_email ON otp_verifications(email);
```

## Troubleshooting

### "Email service not configured"
- **Cause**: SMTP_USER or SMTP_PASSWORD not set
- **Solution**: Set email vars in .env or skip for dev mode

### "Invalid or expired OTP code"
- **Cause**: Code expired (10 min default) or too many attempts (5 max)
- **Solution**: Request new OTP by going back and re-entering email

### "Email already registered"
- **Cause**: Email is already in database (from prior registration)
- **Solution**: Use different email or login instead

### Email not received
- **Cause**: Gmail blocking or app password incorrect
- **Solution**: Check app password (remove spaces), enable "Less secure apps" if using regular password

### Frontend not calling API
- **Cause**: API base URL not set correctly
- **Solution**: Check Frontend/src/services/api.js has correct baseURL

## Database Cleanup

To reset for testing:

```sql
-- Delete OTP records
DELETE FROM otp_verifications;

-- Delete local accounts
DELETE FROM users WHERE auth_provider = 'local';

-- Reset sequences (PostgreSQL)
ALTER SEQUENCE users_id_seq RESTART WITH 1;
ALTER SEQUENCE otp_verifications_id_seq RESTART WITH 1;
```

## Feature Demo

### OTP Resend Logic
- After first OTP sent, "Send OTP" button becomes "Resend"
- 60-second cooldown prevents spam
- Can request new code multiple times

### Attempt Limiting
- Max 5 wrong OTP attempts
- After 5 fails, OTP becomes invalid
- User must request new OTP

### Expiration
- OTP expires after 10 minutes (configurable)
- Expired codes return "Invalid or expired OTP code"
- No cleanup UI - user requests new OTP

### Email Security
- Only verified emails can create accounts
- OTP record deleted after successful registration
- No email reuse without re-verification

## Next Steps

1. ✅ OTP generation and verification
2. ✅ Email sending via SMTP
3. ✅ Frontend OTP UI flow
4. 📋 (Optional) Add SMS OTP option
5. 📋 (Optional) Add Two-Factor Authentication

## Need Help?

Check the implementation guide:
- See `OTP_IMPLEMENTATION.md` for technical details
- Check console logs for OTP codes in dev mode
- Verify `.env` file has all email settings
