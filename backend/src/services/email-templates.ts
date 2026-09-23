/**
 * Premium responsive HTML and Plain-Text email templates for ClipFlow.
 * Designed with modern dark theme, high-contrast typography, gradient accents,
 * and high deliverability across email providers (Gmail, Apple Mail, Outlook).
 */

interface BaseLayoutOptions {
  title: string;
  preheader?: string;
  content: string;
}

/**
 * Universal HTML Email Wrapper with MSO & WebKit support.
 * Clean, modern light-neutral container with high deliverability score.
 */
function emailLayout({ title, preheader, content }: BaseLayoutOptions): string {
  const previewText = preheader
    ? `<div style="display: none; max-height: 0px; overflow: hidden; mso-hide: all; font-size: 1px; line-height: 1px; max-width: 0px; opacity: 0;">
        ${escapeHtml(preheader)}
        &nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;
      </div>`
    : '';

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="x-apple-disable-message-reformatting">
  <title>${escapeHtml(title)}</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <style type="text/css">
    body, table, td, p, a, span { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif !important; }
  </style>
  <![endif]-->
  <style type="text/css">
    body {
      margin: 0 !important;
      padding: 0 !important;
      -webkit-text-size-adjust: 100% !important;
      -ms-text-size-adjust: 100% !important;
      background-color: #f8fafc !important;
    }
    table, td {
      border-collapse: collapse !important;
      mso-table-lspace: 0pt !important;
      mso-table-rspace: 0pt !important;
    }
    img {
      border: 0 !important;
      outline: none !important;
      text-decoration: none !important;
      -ms-interpolation-mode: bicubic !important;
    }
    a {
      text-decoration: none;
    }
    @media only screen and (max-width: 600px) {
      .email-container {
        width: 100% !important;
        max-width: 100% !important;
      }
      .content-padding {
        padding: 28px 20px !important;
      }
      .otp-code {
        font-size: 28px !important;
        letter-spacing: 5px !important;
      }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0f172a; -webkit-font-smoothing: antialiased;">
  ${previewText}
  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; min-height: 100vh;">
    <tr>
      <td align="center" style="padding: 48px 16px;">
        
        <!-- Main Card Container -->
        <table role="presentation" class="email-container" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 560px; background-color: #ffffff; border-radius: 8px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);">
          
          <!-- Top Header Brand Bar -->
          <tr>
            <td style="padding: 28px 36px 20px 36px; border-bottom: 1px solid #f1f5f9;">
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td>
                    <span style="font-size: 15px; font-weight: 700; letter-spacing: 0.5px; color: #0f172a;">CLIPFLOW</span>
                  </td>
                  <td align="right">
                    <span style="font-size: 11px; font-weight: 600; color: #64748b; letter-spacing: 0.5px; text-transform: uppercase;">Workspace</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body Content Slot -->
          <tr>
            <td class="content-padding" style="padding: 36px 36px 32px 36px;">
              ${content}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 36px 32px 36px; background-color: #0b0c13; border-top: 1px solid #1c1e2d; text-align: center;">
              <p style="margin: 0 0 8px 0; font-size: 11px; color: #64748b; line-height: 1.5;">
                This email was sent by <strong>ClipFlow</strong> &bull; AI Video Studio & Content Repurposing Engine.
              </p>
              <p style="margin: 0; font-size: 11px; color: #475569;">
                If you did not request this, you can safely ignore this email.
              </p>
              <p style="margin: 0; font-size: 11px; color: #94a3b8;">
                ClipFlow Technologies Inc. &bull; All rights reserved.
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

  const recipientGreeting = name && name.trim() ? `Hi ${escapeHtml(name.trim())},` : 'Hello,';

  const body = `
    <h1 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 600; color: #0f172a; letter-spacing: -0.02em; line-height: 1.3;">
      Confirm your email address
    </h1>
    <p style="margin: 0 0 20px 0; font-size: 14px; color: #475569; line-height: 1.6;">
      ${recipientGreeting}
    </p>
    <p style="margin: 0 0 28px 0; font-size: 14px; color: #475569; line-height: 1.6;">
      Please use the following verification code to confirm your email address and access your ClipFlow workspace.
    </p>

    <!-- OTP Display Box -->
    <div style="background-color: #090a10; border: 1px solid #312e81; border-radius: 14px; padding: 24px; text-align: center; margin: 26px 0; box-shadow: inset 0 2px 8px rgba(0, 0, 0, 0.4);">
      <p style="margin: 0 0 8px 0; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: #a855f7;">
        Your 6-Digit Verification Code
      </p>
      <div style="font-family: 'Courier New', Courier, monospace; font-size: 34px; font-weight: 800; letter-spacing: 8px; color: #ffffff; text-shadow: 0 0 18px rgba(168, 85, 247, 0.45); padding: 4px 0;">
        ${otpCode}
      </div>
      <p style="margin: 10px 0 0 0; font-size: 12px; color: #64748b;">
        Valid for <strong>24 hours</strong>. Do not share this code.
      </p>
    </div>

    <!-- Direct 1-Click Verification Button -->
    <div style="text-align: center; margin: 28px 0;">
      <a href="${verificationUrl}" target="_blank" style="display: inline-block; background: linear-gradient(135deg, #9333ea, #6366f1); color: #ffffff; padding: 13px 32px; border-radius: 10px; font-size: 13px; font-weight: 700; text-decoration: none; letter-spacing: 0.3px; box-shadow: 0 6px 20px -3px rgba(147, 51, 234, 0.5);">
        Verify Email Address &rarr;
      </a>
    </div>

    <div style="border-top: 1px solid #f1f5f9; padding-top: 20px; margin-top: 28px;">
      <p style="margin: 0 0 6px 0; font-size: 12px; color: #64748b; line-height: 1.5;">
        Alternatively, copy and paste this verification URL into your browser:
      </p>
      <a href="${verificationUrl}" target="_blank" style="font-size: 12px; color: #475569; word-break: break-all; text-decoration: underline;">
        ${verificationUrl}
      </a>
    </div>
  `;

  return emailLayout({
    title: 'Confirm your email address - ClipFlow',
    preheader: `Your verification code is ${otpCode}. Valid for 24 hours.`,
    content: body,
  });
}

export function getVerificationEmailText(params: {
  otpCode: string;
  rawToken?: string;
  name?: string;
  frontendUrl: string;
}): string {
  const { otpCode, rawToken, name, frontendUrl } = params;
  const verificationUrl = rawToken
    ? `${frontendUrl}/verify-email?token=${encodeURIComponent(rawToken)}`
    : `${frontendUrl}/verify-email?code=${encodeURIComponent(otpCode)}`;
  const greeting = name ? `Hey ${name},` : 'Hello,';

  return `${greeting}

Welcome to ClipFlow!

Your 6-Digit Verification Code is: ${otpCode}

Enter this code in your browser or visit this link to verify your email:
${verificationUrl}

This code is valid for 24 hours. If you did not request this, you can safely ignore this email.

The ClipFlow Team
${frontendUrl}`;
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
        Valid for <strong>60 minutes</strong>.
      </p>
    </div>

    <!-- Reset Password CTA -->
    <div style="text-align: center; margin: 28px 0;">
      <a href="${resetUrl}" target="_blank" style="display: inline-block; background: linear-gradient(135deg, #f97316, #ef4444); color: #ffffff; padding: 13px 32px; border-radius: 10px; font-size: 13px; font-weight: 700; text-decoration: none; letter-spacing: 0.3px; box-shadow: 0 6px 20px -3px rgba(239, 68, 68, 0.45);">
        Choose New Password &rarr;
      </a>
    </div>

    <div style="border-top: 1px solid #f1f5f9; padding-top: 20px; margin-top: 28px;">
      <p style="margin: 0; font-size: 12px; color: #64748b; line-height: 1.5;">
        If you did not initiate this request, no action is required and your account remains secure.
      </p>
    </div>
  `;

  return emailLayout({
    title: 'Reset your password - ClipFlow',
    preheader: `Your reset code is ${otpCode}. Valid for 60 minutes.`,
    content: body,
  });
}

export function getPasswordResetEmailText(params: {
  otpCode: string;
  rawToken?: string;
  frontendUrl: string;
}): string {
  const { otpCode, rawToken, frontendUrl } = params;
  const resetUrl = rawToken
    ? `${frontendUrl}/reset-password?token=${encodeURIComponent(rawToken)}`
    : `${frontendUrl}/reset-password?code=${encodeURIComponent(otpCode)}`;

  return `ClipFlow Password Reset

We received a request to reset your password.

Your 6-Digit Reset Code is: ${otpCode}

Or reset your password directly using this link:
${resetUrl}

This code is valid for 60 minutes. If you did not request this, please ignore this email.

The ClipFlow Team
${frontendUrl}`;
}

/**
 * 3. Minimalist Executive Welcome Email Template
 */
export function getWelcomeEmailHtml(params: {
  name?: string;
  email: string;
  frontendUrl: string;
}): string {
  const { name, frontendUrl } = params;
  const recipientGreeting = name && name.trim() ? `Hi ${escapeHtml(name.trim())},` : 'Hello,';
  const studioUrl = `${frontendUrl}/editor/storage`;

  const body = `
    <!-- Hero Banner -->
    <div style="text-align: center; margin-bottom: 28px;">
      <div style="display: inline-block; background: linear-gradient(135deg, rgba(168, 85, 247, 0.2), rgba(56, 189, 248, 0.2)); border: 1px solid rgba(168, 85, 247, 0.35); border-radius: 12px; padding: 10px 18px; margin-bottom: 14px;">
        <span style="font-size: 13px; font-weight: 700; color: #c084fc; text-transform: uppercase; letter-spacing: 1px;">Account Verified &amp; Active</span>
      </div>
      <h1 style="margin: 0 0 10px 0; font-size: 24px; font-weight: 800; color: #ffffff; letter-spacing: -0.4px;">
        ${greeting}
      </h1>
      <p style="margin: 0; font-size: 14px; color: #cbd5e1; line-height: 1.6;">
        Thank you for joining <strong>ClipFlow</strong>. Your email is verified and your studio workspace is ready to export high-performance video clips.
      </p>
    </div>

    <!-- Product Highlights Section -->
    <div style="margin: 28px 0;">
      <p style="margin: 0 0 16px 0; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #a855f7; text-align: center;">
        What You Can Do With ClipFlow
      </p>

      <!-- Grid Cards -->
      <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
        <tr>
          <td style="padding-bottom: 12px;">
            <div style="background-color: #0b0c14; border: 1px solid #1f2337; border-radius: 12px; padding: 14px 16px;">
              <div style="font-size: 13px; font-weight: 700; color: #ffffff; margin-bottom: 3px;">
                Smart Ratios &amp; Crop Framing
              </div>
              <div style="font-size: 12px; color: #94a3b8; line-height: 1.4;">
                Transform videos into 9:16 Shorts/Reels, 1:1 Square, and 4:5 Portrait with interactive live crop and fit modes.
              </div>
            </div>
          </td>
        </tr>
        <tr>
          <td style="padding-bottom: 12px;">
            <div style="background-color: #0b0c14; border: 1px solid #1f2337; border-radius: 12px; padding: 14px 16px;">
              <div style="font-size: 13px; font-weight: 700; color: #ffffff; margin-bottom: 3px;">
                Multi-Platform Repurposing
              </div>
              <div style="font-size: 12px; color: #94a3b8; line-height: 1.4;">
                Clip directly from YouTube, Twitch VODs/streams, Instagram reels, and X videos with instant audio/video extraction.
              </div>
            </div>
          </td>
        </tr>
        <tr>
          <td style="padding-bottom: 12px;">
            <div style="background-color: #0b0c14; border: 1px solid #1f2337; border-radius: 12px; padding: 14px 16px;">
              <div style="font-size: 13px; font-weight: 700; color: #ffffff; margin-bottom: 3px;">
                AI Subtitles &amp; Captions
              </div>
              <div style="font-size: 12px; color: #94a3b8; line-height: 1.4;">
                Generate synchronized subtitles and export in SRT, VTT, or plain text formats in multiple languages.
              </div>
            </div>
          </td>
        </tr>
        <tr>
          <td style="padding-bottom: 4px;">
            <div style="background-color: #0b0c14; border: 1px solid #1f2337; border-radius: 12px; padding: 14px 16px;">
              <div style="font-size: 13px; font-weight: 700; color: #ffffff; margin-bottom: 3px;">
                Cloud Storage &amp; Companion Engine
              </div>
              <div style="font-size: 12px; color: #94a3b8; line-height: 1.4;">
                Direct Google Drive integration and ultra-fast local hardware acceleration companion for unlimited exports.
              </div>
            </div>
          </td>
        </tr>
      </table>
    </div>

    <!-- CTA Button -->
    <div style="text-align: center; margin: 32px 0 16px 0;">
      <a href="${frontendUrl}" target="_blank" style="display: inline-block; background: linear-gradient(135deg, #9333ea, #6366f1); color: #ffffff; padding: 14px 36px; border-radius: 12px; font-size: 14px; font-weight: 800; text-decoration: none; letter-spacing: 0.3px; box-shadow: 0 8px 25px -4px rgba(147, 51, 234, 0.55);">
        Launch ClipFlow Studio &rarr;
      </a>
    </div>
  `;

  return emailLayout('Welcome to ClipFlow Studio', body);
}

export function getWelcomeEmailText(params: {
  name?: string;
  email: string;
  frontendUrl: string;
}): string {
  const { name, frontendUrl } = params;
  const greeting = name ? `Welcome aboard, ${name}!` : 'Welcome to ClipFlow Studio!';

  return `${greeting}

Thank you for joining ClipFlow! Your email is verified and your studio workspace is ready.

With ClipFlow you can:
- Smart Ratios & Crop: Transform videos into 9:16 Shorts/Reels, 1:1 Square, 4:5 Portrait.
- Multi-Platform: Clip from YouTube, Twitch, Instagram, and X with instant extraction.
- AI Subtitles: Generate synchronized captions in SRT, VTT, or plain text.
- Cloud Storage: Google Drive sync & local companion acceleration for fast exports.

Launch ClipFlow Studio:
${frontendUrl}

The ClipFlow Team
${frontendUrl}`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
