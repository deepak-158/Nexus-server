/**
 * Nexus Browser — Email Module
 * Uses Resend HTTP API for sending emails.
 * Free tier: 100 emails/day, reliable, no SMTP needed.
 */

const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const SENDER_EMAIL = 'onboarding@resend.dev';  // Resend free tier default sender
const SENDER_NAME = 'Nexus Browser';

console.log('[Email] Using Resend HTTP API');
console.log('[Email] RESEND_API_KEY:', RESEND_API_KEY ? 'SET' : 'NOT SET');

/**
 * Send email via Resend HTTP API
 */
async function sendEmail(to, subject, htmlContent) {
    if (!RESEND_API_KEY) {
        console.error('[Email] RESEND_API_KEY not set — cannot send email');
        return false;
    }

    try {
        const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${RESEND_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                from: `${SENDER_NAME} <${SENDER_EMAIL}>`,
                to: [to],
                subject: subject,
                html: htmlContent
            })
        });

        if (response.ok) {
            const data = await response.json();
            console.log(`[Email] Sent to ${to}: ${subject} (id: ${data.id})`);
            return true;
        } else {
            const err = await response.json();
            console.error(`[Email] Resend API error (${response.status}):`, JSON.stringify(err));
            return false;
        }
    } catch (err) {
        console.error('[Email] Failed to send:', err.message);
        return false;
    }
}

// ── Email templates ──────────────────────────────────────

async function sendWelcomeEmail(toEmail, userName) {
    const html = `
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
      <h2>Welcome aboard, <span class="highlight">${userName}</span>!</h2>
      <p>Your Nexus Browser account is ready. Here's what you can do:</p>
      <ul class="features">
        <li>Browse the web with built-in privacy and security</li>
        <li>Save and sync your passwords securely (AES-256 encrypted)</li>
        <li>Private/Incognito tabs with zero trace</li>
        <li>Built-in notes, tasks and real-time messaging</li>
        <li>Screenshot capture, Find in Page and more</li>
      </ul>
      <p>All your data stays separate and secure under your account.</p>
    </div>
    <div class="footer">
      Nexus Browser ${new Date().getFullYear()}
    </div>
  </div>
</body>
</html>`;

    await sendEmail(toEmail, 'Welcome to Nexus Browser!', html);
}

async function sendPasswordResetEmail(toEmail, userName, resetCode) {
    const html = `
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
      <p class="warning">This code expires in 15 minutes. If you didn't request this, you can safely ignore this email.</p>
    </div>
    <div class="footer">
      Nexus Browser ${new Date().getFullYear()}
    </div>
  </div>
</body>
</html>`;

    return await sendEmail(toEmail, 'Reset Your Nexus Password', html);
}

async function sendRegistrationOTP(toEmail, userName, otpCode) {
    const html = `
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
      <p class="warning">This code expires in 15 minutes. If you didn't create an account, you can safely ignore this email.</p>
    </div>
    <div class="footer">
      Nexus Browser ${new Date().getFullYear()}
    </div>
  </div>
</body>
</html>`;

    return await sendEmail(toEmail, 'Verify Your Email - Nexus Browser', html);
}

module.exports = { sendWelcomeEmail, sendPasswordResetEmail, sendRegistrationOTP };
