/**
 * Nexus Browser — Email Module
 * Handles sending emails via Gmail SMTP using nodemailer.
 * Used for welcome emails, password resets, etc.
 */

const nodemailer = require('nodemailer');

const GMAIL_USER = process.env.GMAIL_USER || 'deepakshukla1508.i@gmail.com';
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD || 'luwt oehw akox secn';

console.log('[Email] Configured with user:', GMAIL_USER);

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: GMAIL_USER,
        pass: GMAIL_APP_PASSWORD
    },
    connectionTimeout: 10000,  // 10s to establish connection
    greetingTimeout: 10000,    // 10s for SMTP greeting
    socketTimeout: 15000       // 15s for socket inactivity
});

// Wrapper to prevent hanging if email sending takes too long
function sendWithTimeout(mailOptions, timeoutMs = 20000) {
    return Promise.race([
        transporter.sendMail(mailOptions),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Email send timed out')), timeoutMs))
    ]);
}

/**
 * Send a welcome email to newly registered users.
 */
async function sendWelcomeEmail(toEmail, userName) {
    const mailOptions = {
        from: `"Nexus Browser" <${GMAIL_USER}>`,
        to: toEmail,
        subject: '🚀 Welcome to Nexus Browser!',
        html: `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { margin: 0; padding: 0; background: #0a0a15; font-family: 'Segoe UI', Arial, sans-serif; }
    .container { max-width: 520px; margin: 40px auto; background: linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 100%); border-radius: 18px; border: 1px solid rgba(255,255,255,0.08); overflow: hidden; }
    .header { padding: 40px 36px 20px; text-align: center; }
    .logo { font-size: 42px; font-weight: 700; background: linear-gradient(135deg, #667eea, #764ba2); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
    .body { padding: 0 36px 36px; color: #b0b0c8; font-size: 15px; line-height: 1.7; }
    .body h2 { color: #e0e0f0; font-size: 22px; margin-bottom: 12px; }
    .highlight { color: #667eea; font-weight: 600; }
    .features { list-style: none; padding: 0; margin: 20px 0; }
    .features li { padding: 8px 0; padding-left: 24px; position: relative; }
    .features li::before { content: '✦'; position: absolute; left: 0; color: #764ba2; }
    .footer { padding: 20px 36px; background: rgba(0,0,0,0.2); text-align: center; color: #666; font-size: 12px; }
    .btn { display: inline-block; padding: 12px 32px; background: linear-gradient(135deg, #667eea, #764ba2); color: #fff; text-decoration: none; border-radius: 10px; font-weight: 600; margin-top: 16px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">Nexus</div>
    </div>
    <div class="body">
      <h2>Welcome aboard, <span class="highlight">${userName}</span>! 🎉</h2>
      <p>Your Nexus Browser account is ready. Here's what you can do:</p>
      <ul class="features">
        <li>Browse the web with built-in privacy & security</li>
        <li>Save & sync your passwords securely (AES-256 encrypted)</li>
        <li>Private/Incognito tabs with zero trace</li>
        <li>Built-in notes, tasks & real-time messaging</li>
        <li>Screenshot capture, Find in Page & more</li>
      </ul>
      <p>All your data stays separate and secure under your account.</p>
      <p style="text-align:center;">
        <a href="#" class="btn">Open Nexus Browser</a>
      </p>
    </div>
    <div class="footer">
      &copy; ${new Date().getFullYear()} Nexus Browser &middot; Built with ❤️
    </div>
  </div>
</body>
</html>`
    };

    try {
        await sendWithTimeout(mailOptions);
        console.log(`[Email] Welcome email sent to ${toEmail}`);
    } catch (err) {
        console.error('[Email] Failed to send welcome email:', err.message);
    }
}

/**
 * Send a password-reset email with a 6-digit code.
 */
async function sendPasswordResetEmail(toEmail, userName, resetCode) {
    const mailOptions = {
        from: `"Nexus Browser" <${GMAIL_USER}>`,
        to: toEmail,
        subject: '🔑 Reset Your Nexus Password',
        html: `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { margin: 0; padding: 0; background: #0a0a15; font-family: 'Segoe UI', Arial, sans-serif; }
    .container { max-width: 520px; margin: 40px auto; background: linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 100%); border-radius: 18px; border: 1px solid rgba(255,255,255,0.08); overflow: hidden; }
    .header { padding: 40px 36px 20px; text-align: center; }
    .logo { font-size: 42px; font-weight: 700; background: linear-gradient(135deg, #667eea, #764ba2); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
    .body { padding: 0 36px 36px; color: #b0b0c8; font-size: 15px; line-height: 1.7; }
    .body h2 { color: #e0e0f0; font-size: 22px; margin-bottom: 12px; }
    .code-box { text-align: center; margin: 24px 0; }
    .code { display: inline-block; padding: 16px 40px; background: rgba(102,126,234,0.12); border: 2px dashed #667eea; border-radius: 14px; font-size: 36px; font-weight: 700; letter-spacing: 8px; color: #667eea; font-family: 'Courier New', monospace; }
    .warning { font-size: 13px; color: #888; margin-top: 16px; }
    .footer { padding: 20px 36px; background: rgba(0,0,0,0.2); text-align: center; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">Nexus</div>
    </div>
    <div class="body">
      <h2>Password Reset Request</h2>
      <p>Hi <strong style="color:#e0e0f0">${userName}</strong>, we received a request to reset your Nexus Browser password.</p>
      <p>Use this code to reset your password:</p>
      <div class="code-box">
        <span class="code">${resetCode}</span>
      </div>
      <p class="warning">⏳ This code expires in <strong>15 minutes</strong>.<br>If you didn't request this, you can safely ignore this email.</p>
    </div>
    <div class="footer">
      &copy; ${new Date().getFullYear()} Nexus Browser &middot; Built with ❤️
    </div>
  </div>
</body>
</html>`
    };

    try {
        await sendWithTimeout(mailOptions);
        console.log(`[Email] Password reset email sent to ${toEmail}`);
        return true;
    } catch (err) {
        console.error('[Email] Failed to send reset email:', err.message);
        return false;
    }
}

/**
 * Send a registration OTP email to verify email before account creation.
 */
async function sendRegistrationOTP(toEmail, userName, otpCode) {
    const mailOptions = {
        from: `"Nexus Browser" <${GMAIL_USER}>`,
        to: toEmail,
        subject: '🔐 Verify Your Email — Nexus Browser',
        html: `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { margin: 0; padding: 0; background: #0a0a15; font-family: 'Segoe UI', Arial, sans-serif; }
    .container { max-width: 520px; margin: 40px auto; background: linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 100%); border-radius: 18px; border: 1px solid rgba(255,255,255,0.08); overflow: hidden; }
    .header { padding: 40px 36px 20px; text-align: center; }
    .logo { font-size: 42px; font-weight: 700; background: linear-gradient(135deg, #667eea, #764ba2); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
    .body { padding: 0 36px 36px; color: #b0b0c8; font-size: 15px; line-height: 1.7; }
    .body h2 { color: #e0e0f0; font-size: 22px; margin-bottom: 12px; }
    .code-box { text-align: center; margin: 24px 0; }
    .code { display: inline-block; padding: 16px 40px; background: rgba(102,126,234,0.12); border: 2px dashed #667eea; border-radius: 14px; font-size: 36px; font-weight: 700; letter-spacing: 8px; color: #667eea; font-family: 'Courier New', monospace; }
    .warning { font-size: 13px; color: #888; margin-top: 16px; }
    .footer { padding: 20px 36px; background: rgba(0,0,0,0.2); text-align: center; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">Nexus</div>
    </div>
    <div class="body">
      <h2>Verify Your Email</h2>
      <p>Hi <strong style="color:#e0e0f0">${userName}</strong>, thanks for signing up for Nexus Browser!</p>
      <p>Use this verification code to complete your registration:</p>
      <div class="code-box">
        <span class="code">${otpCode}</span>
      </div>
      <p class="warning">⏳ This code expires in <strong>15 minutes</strong>.<br>If you didn't create an account, you can safely ignore this email.</p>
    </div>
    <div class="footer">
      &copy; ${new Date().getFullYear()} Nexus Browser &middot; Built with ❤️
    </div>
  </div>
</body>
</html>`
    };

    try {
        await sendWithTimeout(mailOptions);
        console.log(`[Email] Registration OTP sent to ${toEmail}`);
        return true;
    } catch (err) {
        console.error('[Email] Failed to send registration OTP:', err.message);
        return false;
    }
}

module.exports = { sendWelcomeEmail, sendPasswordResetEmail, sendRegistrationOTP };
