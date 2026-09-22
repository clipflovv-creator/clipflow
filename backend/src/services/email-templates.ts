/**
 * Premium responsive HTML email templates for ClipFlow.
 * Designed with modern dark theme, high-contrast OTP codes, gradient accents,
 * and high compatibility across email clients (Gmail, Apple Mail, Outlook, iOS/Android).
 */

/**
 * Base email layout wrapper
 */
function emailLayout(title: string, content: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${title}</title>
  <!--[if mso]>
  <style type="text/css">
    body, table, td {font-family: Arial, Helvetica, sans-serif !important;}
  </style>
  <![endif]-->
</head>
<body style="margin: 0; padding: 0; background-color: #07080c; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; color: #f1f5f9; -webkit-font-smoothing: antialiased; -webkit-text-size-adjust: 100%;">
  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #07080c; min-height: 100vh;">
    <tr>
      <td align="center" style="padding: 36px 16px;">
        <!-- Container Card -->
        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 580px; background-color: #0f111a; border-radius: 18px; border: 1px solid #222538; overflow: hidden; box-shadow: 0 20px 45px -10px rgba(0, 0, 0, 0.7);">
          
          <!-- Top Gradient Accent Line -->
          <tr>
            <td style="height: 4px; background: linear-gradient(90deg, #9333ea, #6366f1, #38bdf8);"></td>
          </tr>

          <!-- Header Logo Bar -->
          <tr>
            <td align="center" style="padding: 32px 32px 20px 32px;">
              <table role="presentation" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center">
                    <div style="display: inline-block; background: linear-gradient(135deg, rgba(147, 51, 234, 0.2), rgba(99, 102, 241, 0.2)); border: 1px solid rgba(147, 51, 234, 0.4); border-radius: 12px; padding: 8px 16px;">
                      <span style="font-size: 17px; font-weight: 800; letter-spacing: 0.5px; color: #ffffff;">
                        <span style="color: #c084fc;">CLIP</span>FLOW
                      </span>
                      <span style="font-size: 11px; font-weight: 600; color: #94a3b8; margin-left: 6px; text-transform: uppercase; letter-spacing: 1px;">STUDIO</span>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Content Slot -->
          <tr>
            <td style="padding: 10px 36px 36px 36px;">
              ${content}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 36px 32px 36px; background-color: #0b0c13; border-top: 1px solid #1c1e2d; text-align: center;">
              <p style="margin: 0 0 8px 0; font-size: 11px; color: #64748b; line-height: 1.5;">
                This email was sent by <strong>ClipFlow</strong> • AI Video Studio & Content Repurposing Engine.
              </p>
              <p style="margin: 0; font-size: 11px; color: #475569;">
                If you did not request this, you can safely ignore this email.
              </p>
              <p style="margin: 12px 0 0 0; font-size: 10px; color: #334155;">
                &copy; ${new Date().getFullYear()} ClipFlow. All rights reserved.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * 1. Verification OTP Email Template
 */
export function getVerificationEmailHtml(params: {
  otpCode: string;
  rawToken?: string;
  name?: string;
  frontendUrl: string;
}): string {
  const { otpCode, rawToken, name, frontendUrl } = params;
  const verificationUrl = rawToken
    ? `${frontendUrl}/verify-email?token=${encodeURIComponent(rawToken)}`
    : `${frontendUrl}/verify-email?code=${encodeURIComponent(otpCode)}`;

  const greeting = name ? `Hey ${escapeHtml(name)},` : 'Hello,';

  const body = `
    <div style="text-align: center; margin-bottom: 24px;">
      <h1 style="margin: 0 0 10px 0; font-size: 22px; font-weight: 800; color: #ffffff; letter-spacing: -0.3px;">
        Verify Your Email Address
      </h1>
      <p style="margin: 0; font-size: 14px; color: #94a3b8; line-height: 1.6;">
        ${greeting} Welcome to ClipFlow! Enter the 6-digit verification code below in your browser to verify your email and activate your account.
      </p>
    </div>

    <!-- OTP Display Box -->
    <div style="background-color: #090a10; border: 1px solid #312e81; border-radius: 14px; padding: 24px; text-align: center; margin: 26px 0; box-shadow: inset 0 2px 8px rgba(0, 0, 0, 0.4);">
      <p style="margin: 0 0 8px 0; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: #a855f7;">
        Your 6-Digit Verification Code
      </p>
      <div style="font-family: 'Courier New', Courier, monospace; font-size: 34px; font-weight: 800; letter-spacing: 8px; color: #ffffff; text-shadow: 0 0 18px rgba(168, 85, 247, 0.45); padding: 4px 0;">
        ${otpCode}
      </div>
      <p style="margin: 10px 0 0 0; font-size: 12px; color: #64748b;">
        ⏱️ Valid for <strong>24 hours</strong>. Do not share this code.
      </p>
    </div>

    <!-- Direct 1-Click Verification Button -->
    <div style="text-align: center; margin: 28px 0;">
      <a href="${verificationUrl}" target="_blank" style="display: inline-block; background: linear-gradient(135deg, #9333ea, #6366f1); color: #ffffff; padding: 13px 32px; border-radius: 10px; font-size: 13px; font-weight: 700; text-decoration: none; letter-spacing: 0.3px; box-shadow: 0 6px 20px -3px rgba(147, 51, 234, 0.5);">
        Verify Email Address →
      </a>
    </div>

    <div style="border-top: 1px solid #1e2235; padding-top: 18px; margin-top: 24px; text-align: center;">
      <p style="margin: 0; font-size: 12px; color: #64748b; line-height: 1.5;">
        Or paste this verification link into your browser:<br>
        <a href="${verificationUrl}" style="color: #a855f7; word-break: break-all; font-size: 11px; text-decoration: underline;">
          ${verificationUrl}
        </a>
      </p>
    </div>
  `;

  return emailLayout('Verify your ClipFlow account', body);
}

/**
 * 2. Password Reset OTP Email Template
 */
export function getPasswordResetEmailHtml(params: {
  otpCode: string;
  rawToken?: string;
  frontendUrl: string;
}): string {
  const { otpCode, rawToken, frontendUrl } = params;
  const resetUrl = rawToken
    ? `${frontendUrl}/reset-password?token=${encodeURIComponent(rawToken)}`
    : `${frontendUrl}/reset-password?code=${encodeURIComponent(otpCode)}`;

  const body = `
    <div style="text-align: center; margin-bottom: 24px;">
      <div style="display: inline-block; background-color: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 50%; padding: 10px; margin-bottom: 12px;">
        <span style="font-size: 20px;">🔒</span>
      </div>
      <h1 style="margin: 0 0 10px 0; font-size: 22px; font-weight: 800; color: #ffffff; letter-spacing: -0.3px;">
        Password Reset Request
      </h1>
      <p style="margin: 0; font-size: 14px; color: #94a3b8; line-height: 1.6;">
        We received a request to reset your password for ClipFlow. Use the 6-digit code below to set a new password.
      </p>
    </div>

    <!-- OTP Display Box -->
    <div style="background-color: #090a10; border: 1px solid #431407; border-radius: 14px; padding: 24px; text-align: center; margin: 26px 0; box-shadow: inset 0 2px 8px rgba(0, 0, 0, 0.4);">
      <p style="margin: 0 0 8px 0; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: #f97316;">
        6-Digit Reset Code
      </p>
      <div style="font-family: 'Courier New', Courier, monospace; font-size: 34px; font-weight: 800; letter-spacing: 8px; color: #ffffff; text-shadow: 0 0 18px rgba(249, 115, 22, 0.45); padding: 4px 0;">
        ${otpCode}
      </div>
      <p style="margin: 10px 0 0 0; font-size: 12px; color: #64748b;">
        ⏱️ Valid for <strong>60 minutes</strong>.
      </p>
    </div>

    <!-- Reset Password CTA -->
    <div style="text-align: center; margin: 28px 0;">
      <a href="${resetUrl}" target="_blank" style="display: inline-block; background: linear-gradient(135deg, #f97316, #ef4444); color: #ffffff; padding: 13px 32px; border-radius: 10px; font-size: 13px; font-weight: 700; text-decoration: none; letter-spacing: 0.3px; box-shadow: 0 6px 20px -3px rgba(239, 68, 68, 0.45);">
        Choose New Password →
      </a>
    </div>

    <div style="border-top: 1px solid #1e2235; padding-top: 18px; margin-top: 24px;">
      <p style="margin: 0; font-size: 12px; color: #64748b; line-height: 1.5; text-align: center;">
        If you did not request a password reset, you can safely ignore this email. Your password will remain unchanged.
      </p>
    </div>
  `;

  return emailLayout('Reset your ClipFlow password', body);
}

/**
 * 3. Feature-Rich Welcome Email Template
 */
export function getWelcomeEmailHtml(params: {
  name?: string;
  email: string;
  frontendUrl: string;
}): string {
  const { name, frontendUrl } = params;
  const greeting = name ? `Welcome aboard, ${escapeHtml(name)}!` : 'Welcome to ClipFlow Studio!';

  const body = `
    <!-- Hero Banner -->
    <div style="text-align: center; margin-bottom: 28px;">
      <div style="display: inline-block; background: linear-gradient(135deg, rgba(168, 85, 247, 0.2), rgba(56, 189, 248, 0.2)); border: 1px solid rgba(168, 85, 247, 0.35); border-radius: 50%; padding: 14px; margin-bottom: 14px;">
        <span style="font-size: 26px;">🎬</span>
      </div>
      <h1 style="margin: 0 0 10px 0; font-size: 24px; font-weight: 800; color: #ffffff; letter-spacing: -0.4px;">
        ${greeting}
      </h1>
      <p style="margin: 0; font-size: 14px; color: #cbd5e1; line-height: 1.6;">
        Thank you for joining <strong>ClipFlow</strong>! We build high-performance, studio-grade video editing and content repurposing tools so creators can turn long-form videos into viral clips in seconds.
      </p>
    </div>

    <!-- Product Highlights Section -->
    <div style="margin: 28px 0;">
      <p style="margin: 0 0 16px 0; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #a855f7; text-align: center;">
        ✨ What You Can Do With ClipFlow
      </p>

      <!-- Grid Cards -->
      <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
        <!-- Feature 1 -->
        <tr>
          <td style="padding-bottom: 12px;">
            <div style="background-color: #0b0c14; border: 1px solid #1f2337; border-radius: 12px; padding: 14px 16px;">
              <table role="presentation" border="0" cellspacing="0" cellpadding="0" width="100%">
                <tr>
                  <td width="36" valign="top" style="font-size: 20px; line-height: 1;">📐</td>
                  <td style="padding-left: 10px;">
                    <div style="font-size: 13px; font-weight: 700; color: #ffffff; margin-bottom: 3px;">
                      Smart Ratios & Crop Framing
                    </div>
                    <div style="font-size: 12px; color: #94a3b8; line-height: 1.4;">
                      Instantly transform videos into 9:16 Shorts/Reels, 1:1 Square, 4:5 Portrait with interactive live crop and fit modes.
                    </div>
                  </td>
                </tr>
              </table>
            </div>
          </td>
        </tr>

        <!-- Feature 2 -->
        <tr>
          <td style="padding-bottom: 12px;">
            <div style="background-color: #0b0c14; border: 1px solid #1f2337; border-radius: 12px; padding: 14px 16px;">
              <table role="presentation" border="0" cellspacing="0" cellpadding="0" width="100%">
                <tr>
                  <td width="36" valign="top" style="font-size: 20px; line-height: 1;">⚡</td>
                  <td style="padding-left: 10px;">
                    <div style="font-size: 13px; font-weight: 700; color: #ffffff; margin-bottom: 3px;">
                      Multi-Platform Repurposing
                    </div>
                    <div style="font-size: 12px; color: #94a3b8; line-height: 1.4;">
                      Clip directly from YouTube, Twitch VODs/streams, Instagram reels, and X/Twitter videos with instant audio/video extraction.
                    </div>
                  </td>
                </tr>
              </table>
            </div>
          </td>
        </tr>

        <!-- Feature 3 -->
        <tr>
          <td style="padding-bottom: 12px;">
            <div style="background-color: #0b0c14; border: 1px solid #1f2337; border-radius: 12px; padding: 14px 16px;">
              <table role="presentation" border="0" cellspacing="0" cellpadding="0" width="100%">
                <tr>
                  <td width="36" valign="top" style="font-size: 20px; line-height: 1;">📝</td>
                  <td style="padding-left: 10px;">
                    <div style="font-size: 13px; font-weight: 700; color: #ffffff; margin-bottom: 3px;">
                      AI Subtitles & Captions
                    </div>
                    <div style="font-size: 12px; color: #94a3b8; line-height: 1.4;">
                      Generate synchronized subtitles and download in SRT, VTT, or plain text formats in multiple languages.
                    </div>
                  </td>
                </tr>
              </table>
            </div>
          </td>
        </tr>

        <!-- Feature 4 -->
        <tr>
          <td style="padding-bottom: 4px;">
            <div style="background-color: #0b0c14; border: 1px solid #1f2337; border-radius: 12px; padding: 14px 16px;">
              <table role="presentation" border="0" cellspacing="0" cellpadding="0" width="100%">
                <tr>
                  <td width="36" valign="top" style="font-size: 20px; line-height: 1;">☁️</td>
                  <td style="padding-left: 10px;">
                    <div style="font-size: 13px; font-weight: 700; color: #ffffff; margin-bottom: 3px;">
                      Cloud Storage & Companion Engine
                    </div>
                    <div style="font-size: 12px; color: #94a3b8; line-height: 1.4;">
                      Direct Google Drive integration and ultra-fast local hardware acceleration companion for unlimited exports.
                    </div>
                  </td>
                </tr>
              </table>
            </div>
          </td>
        </tr>
      </table>
    </div>

    <!-- CTA Button -->
    <div style="text-align: center; margin: 32px 0 16px 0;">
      <a href="${frontendUrl}" target="_blank" style="display: inline-block; background: linear-gradient(135deg, #9333ea, #6366f1); color: #ffffff; padding: 14px 36px; border-radius: 12px; font-size: 14px; font-weight: 800; text-decoration: none; letter-spacing: 0.3px; box-shadow: 0 8px 25px -4px rgba(147, 51, 234, 0.55);">
        Launch ClipFlow Studio →
      </a>
    </div>
  `;

  return emailLayout('Welcome to ClipFlow Studio!', body);
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
