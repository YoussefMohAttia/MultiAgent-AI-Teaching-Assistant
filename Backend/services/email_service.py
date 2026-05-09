"""
Email service for sending OTP codes to users.
Uses SMTP for email delivery.
"""
import asyncio
import smtplib
import ssl
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from Core.config import settings


async def send_otp_email(email: str, otp_code: str) -> bool:
    """
    Send OTP code to user email.
    
    Args:
        email: User's email address
        otp_code: 6-digit OTP code
        
    Returns:
        bool: True if sent successfully, False otherwise
    """
    if not settings.SMTP_USER or not settings.SMTP_PASSWORD or not settings.SENDER_EMAIL:
        print("⚠️  Email service not configured. Set SMTP_USER, SMTP_PASSWORD, and SENDER_EMAIL in Backend/.env.")
        return False
    
    try:
        # Run SMTP in thread pool to avoid blocking
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(
            None,
            _send_smtp_email,
            email,
            otp_code
        )
    except Exception as e:
        print(f"❌ Failed to send OTP email: {e}")
        return False


def _send_smtp_email(email: str, otp_code: str) -> bool:
    """Send email via SMTP (blocking operation)."""
    try:
        # Create message
        msg = MIMEMultipart("alternative")
        msg["Subject"] = "Your SQUEE Learn Email Verification Code"
        msg["From"] = settings.SENDER_EMAIL
        msg["To"] = email
        
        # HTML content
        html = f"""\
        <html>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
              <h2 style="color: #1f2937;">Email Verification</h2>
              <p>Hello,</p>
              <p>Your verification code is:</p>
              <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0;">
                <h1 style="letter-spacing: 2px; color: #000; margin: 0;">{otp_code}</h1>
              </div>
              <p style="color: #6b7280; font-size: 14px;">This code expires in {settings.OTP_EXPIRATION_MINUTES} minutes.</p>
              <p style="color: #6b7280; font-size: 14px;">If you didn't request this code, you can safely ignore this email.</p>
              <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
              <p style="color: #9ca3af; font-size: 12px;">SQUEE Learn - AI Teaching Assistant</p>
            </div>
          </body>
        </html>
        """
        
        # Plain text fallback
        text = f"""\
        Email Verification
        
        Your verification code is: {otp_code}
        
        This code expires in {settings.OTP_EXPIRATION_MINUTES} minutes.
        
        If you didn't request this code, you can safely ignore this email.
        """
        
        msg.attach(MIMEText(text, "plain"))
        msg.attach(MIMEText(html, "html"))
        
        context = ssl.create_default_context()

        # Send email
        if settings.SMTP_PORT == 465:
            with smtplib.SMTP_SSL(settings.SMTP_SERVER, settings.SMTP_PORT, context=context) as server:
                server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
                server.send_message(msg)
        else:
            with smtplib.SMTP(settings.SMTP_SERVER, settings.SMTP_PORT) as server:
                server.ehlo()
                server.starttls(context=context)
                server.ehlo()
                server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
                server.send_message(msg)
        
        return True
    except Exception as e:
        print(f"❌ SMTP error: {e}")
        return False
