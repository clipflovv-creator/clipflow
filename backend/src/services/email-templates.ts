/**
 * Clean, modern, responsive email templates for ClipFlow (by Cliy).
 * Designed with a minimal SaaS visual hierarchy, strong typography,
 * subtle purple accents, and high deliverability across all email clients.
 */

interface BaseLayoutOptions {
  title: string;
  preheader?: string;
  content: string;
}

/**
 * Shared minimal email layout matching modern SaaS design standards.
 * Clean white single-column container, generous whitespace, subtle header & footer.
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
      background-color: #ffffff !important;
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
        padding: 32px 20px !important;
      }
      .otp-digit {
        width: 36px !important;
        height: 46px !important;
        font-size: 22px !important;
      }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #ffffff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; -webkit-font-smoothing: antialiased;">
  ${previewText}
  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #ffffff; min-height: 100vh;">
    <tr>
      <td align="center" style="padding: 40px 16px 60px 16px;">
        
        <!-- Main Single Column Card Container -->
        <table role="presentation" class="email-container" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 540px; background-color: #ffffff;">
          
          <!-- Minimal Brand Header -->
          <tr>
            <td style="padding: 0 0 32px 0;">
              <table role="presentation" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td valign="middle" style="padding-right: 10px;">
                    <div style="width: 30px; height: 30px; background: linear-gradient(135deg, #7c3aed, #6366f1); border-radius: 8px; text-align: center; line-height: 30px;">
                      <span style="color: #ffffff; font-size: 15px; font-weight: 800; font-family: -apple-system, BlinkMacSystemFont, sans-serif;">C</span>
                    </div>
                  </td>
                  <td valign="middle">
                    <span style="font-size: 16px; font-weight: 700; color: #0f172a; letter-spacing: -0.2px;">ClipFlow</span>
                    <span style="font-size: 12px; font-weight: 500; color: #64748b; margin-left: 6px;">by Cliy</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Content Slot -->
          <tr>
            <td style="font-size: 15px; line-height: 1.65; color: #334155;">
              ${content}
            </td>
          </tr>

          <!-- Minimal Footer -->
          <tr>
            <td style="padding: 40px 0 0 0; border-top: 1px solid #f1f5f9; margin-top: 36px;">
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="font-size: 12px; line-height: 1.5; color: #94a3b8;">
                    <p style="margin: 0 0 4px 0;">
                      ClipFlow is a product by Cliy.
                    </p>
                    <p style="margin: 0;">
                      &copy; ${new Date().getFullYear()} Cliy. All rights reserved.
                    </p>
                  </td>
                </tr>
              </table>
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
 * 1. Verification / OTP Email Template
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
  const digits = otpCode.split('');

  const body = `
    <p style="margin: 0 0 20px 0; font-size: 15px; color: #1e293b; font-weight: 500;">
      ${recipientGreeting}
    </p>

    <p style="margin: 0 0 20px 0; font-size: 15px; color: #334155; line-height: 1.6;">
      This is your verification code:
    </p>

    <!-- Prominent OTP Area (Style matching reference otp.webp) -->
    <table role="presentation" border="0" cellspacing="8" cellpadding="0" style="margin: 24px 0;">
      <tr>
        ${digits
          .map(
            (d) => `
          <td class="otp-digit" width="44" height="54" align="center" valign="middle" style="width: 44px; height: 54px; background-color: #faf5ff; border: 1.5px solid #a855f7; border-radius: 10px; font-size: 26px; font-weight: 700; color: #7c3aed; font-family: -apple-system, BlinkMacSystemFont, monospace; text-align: center;">
            ${escapeHtml(d)}
          </td>`
          )
          .join('')}
      </tr>
    </table>

    <p style="margin: 24px 0 20px 0; font-size: 14px; color: #475569; line-height: 1.6;">
      This code will only be valid for the next <strong>24 hours</strong>. If the code does not work, you can use this login verification link:
    </p>

    <!-- Primary CTA Button -->
    <div style="margin: 24px 0 32px 0;">
      <a href="${verificationUrl}" target="_blank" style="display: inline-block; background-color: #7c3aed; color: #ffffff; padding: 12px 28px; border-radius: 8px; font-size: 14px; font-weight: 600; text-decoration: none; box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);">
        Verify email
      </a>
    </div>

    <p style="margin: 0 0 24px 0; font-size: 13px; color: #64748b; line-height: 1.5;">
      If you did not request this code, you can safely ignore this email.
    </p>

    <p style="margin: 0; font-size: 14px; color: #334155; line-height: 1.5;">
      Thanks,<br>
      <strong style="color: #0f172a;">The Cliy Team</strong>
    </p>
  `;

  return emailLayout({
    title: 'Verify your ClipFlow account',
    preheader: 'Your ClipFlow verification code is ready.',
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
  const greeting = name && name.trim() ? `Hi ${name.trim()},` : 'Hello,';

  return `${greeting}

This is your verification code:

${otpCode}

This code will only be valid for the next 24 hours. If the code does not work, you can use this login verification link:
${verificationUrl}

If you did not request this code, you can safely ignore this email.

Thanks,
The Cliy Team

ClipFlow is a product by Cliy.
${frontendUrl}`;
}

/**
 * 2. Password Reset Email Template
 */
export function getPasswordResetEmailHtml(params: {
  otpCode: string;
  rawToken?: string;
  name?: string;
  frontendUrl: string;
}): string {
  const { otpCode, rawToken, name, frontendUrl } = params;
  const resetUrl = rawToken
    ? `${frontendUrl}/reset-password?token=${encodeURIComponent(rawToken)}`
    : `${frontendUrl}/reset-password?code=${encodeURIComponent(otpCode)}`;

  const recipientGreeting = name && name.trim() ? `Hi ${escapeHtml(name.trim())},` : 'Hello,';
  const digits = otpCode.split('');

  const body = `
    <p style="margin: 0 0 20px 0; font-size: 15px; color: #1e293b; font-weight: 500;">
      ${recipientGreeting}
    </p>

    <p style="margin: 0 0 20px 0; font-size: 15px; color: #334155; line-height: 1.6;">
      We received a request to reset your ClipFlow password. Your reset code is:
    </p>

    <!-- Prominent OTP Area (Style matching reference passReset.webp / otp.webp) -->
    <table role="presentation" border="0" cellspacing="8" cellpadding="0" style="margin: 24px 0;">
      <tr>
        ${digits
          .map(
            (d) => `
          <td class="otp-digit" width="44" height="54" align="center" valign="middle" style="width: 44px; height: 54px; background-color: #faf5ff; border: 1.5px solid #a855f7; border-radius: 10px; font-size: 26px; font-weight: 700; color: #7c3aed; font-family: -apple-system, BlinkMacSystemFont, monospace; text-align: center;">
            ${escapeHtml(d)}
          </td>`
          )
          .join('')}
      </tr>
    </table>

    <p style="margin: 24px 0 20px 0; font-size: 14px; color: #475569; line-height: 1.6;">
      This code will only be valid for the next <strong>60 minutes</strong>. You can also reset your password directly using this link:
    </p>

    <!-- Primary CTA Button -->
    <div style="margin: 24px 0 32px 0;">
      <a href="${resetUrl}" target="_blank" style="display: inline-block; background-color: #7c3aed; color: #ffffff; padding: 12px 28px; border-radius: 8px; font-size: 14px; font-weight: 600; text-decoration: none; box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);">
        Reset password
      </a>
    </div>

    <p style="margin: 0 0 24px 0; font-size: 13px; color: #64748b; line-height: 1.5;">
      If you did not request a password reset, you can safely ignore this email. Your password will not be changed unless the reset process is completed.
    </p>

    <p style="margin: 0; font-size: 14px; color: #334155; line-height: 1.5;">
      Thanks,<br>
      <strong style="color: #0f172a;">The Cliy Team</strong>
    </p>
  `;

  return emailLayout({
    title: 'Reset your ClipFlow password',
    preheader: 'Your ClipFlow password reset code is ready.',
    content: body,
  });
}

export function getPasswordResetEmailText(params: {
  otpCode: string;
  rawToken?: string;
  name?: string;
  frontendUrl: string;
}): string {
  const { otpCode, rawToken, name, frontendUrl } = params;
  const resetUrl = rawToken
    ? `${frontendUrl}/reset-password?token=${encodeURIComponent(rawToken)}`
    : `${frontendUrl}/reset-password?code=${encodeURIComponent(otpCode)}`;
  const greeting = name && name.trim() ? `Hi ${name.trim()},` : 'Hello,';

  return `${greeting}

We received a request to reset your ClipFlow password.

Your reset code is:

${otpCode}

This code will only be valid for the next 60 minutes. You can also reset your password directly using this link:
${resetUrl}

If you did not request a password reset, you can safely ignore this email. Your password will not be changed unless the reset process is completed.

Thanks,
The Cliy Team

ClipFlow is a product by Cliy.
${frontendUrl}`;
}

/**
 * 3. Welcome Email Template
 */
export function getWelcomeEmailHtml(params: {
  name?: string;
  email: string;
  frontendUrl: string;
}): string {
  const { name, frontendUrl } = params;
  const recipientGreeting = name && name.trim() ? `Hi ${escapeHtml(name.trim())},` : 'Hello,';

  const body = `
    <p style="margin: 0 0 18px 0; font-size: 15px; color: #1e293b; font-weight: 500;">
      ${recipientGreeting}
    </p>

    <p style="margin: 0 0 16px 0; font-size: 15px; color: #334155; line-height: 1.65;">
      Welcome to ClipFlow. Thank you for joining us.
    </p>

    <p style="margin: 0 0 20px 0; font-size: 15px; color: #334155; line-height: 1.65;">
      ClipFlow is part of Cliy, where we build and deliver video editing and content creation tools for creators around the world.
    </p>

    <p style="margin: 0 0 12px 0; font-size: 14px; font-weight: 600; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px;">
      What you can do with ClipFlow
    </p>

    <ul style="margin: 0 0 28px 0; padding-left: 20px; font-size: 14px; color: #475569; line-height: 1.7;">
      <li style="margin-bottom: 6px;"><strong>Video trimming &amp; clipping:</strong> Fast precision clipping from long-form content.</li>
      <li style="margin-bottom: 6px;"><strong>Smart aspect ratios:</strong> Instant 9:16 Shorts/Reels, 1:1 Square, and 4:5 Portrait framing.</li>
      <li style="margin-bottom: 6px;"><strong>Captions &amp; subtitles:</strong> Synchronized subtitles in SRT, VTT, and plain text.</li>
      <li style="margin-bottom: 6px;"><strong>Multi-platform workflows:</strong> Extract and repurpose from YouTube, Twitch, Instagram, and X.</li>
      <li style="margin-bottom: 6px;"><strong>Cloud &amp; local companion:</strong> Direct Google Drive integration and local hardware acceleration.</li>
    </ul>

    <!-- Primary CTA Button (Style matching reference welcome.webp) -->
    <div style="margin: 28px 0 32px 0;">
      <a href="${frontendUrl}" target="_blank" style="display: inline-block; background-color: #7c3aed; color: #ffffff; padding: 12px 28px; border-radius: 8px; font-size: 14px; font-weight: 600; text-decoration: none; box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);">
        Launch ClipFlow
      </a>
    </div>

    <p style="margin: 0 0 24px 0; font-size: 14px; color: #475569; line-height: 1.65;">
      We'd love to have you with us as we build the next generation of creator tools.
    </p>

    <p style="margin: 0; font-size: 14px; color: #334155; line-height: 1.5;">
      Thanks,<br>
      <strong style="color: #0f172a;">The Cliy Team</strong>
    </p>
  `;

  return emailLayout({
    title: 'Welcome to ClipFlow from Cliy',
    preheader: "Welcome to ClipFlow. We're excited to have you with us.",
    content: body,
  });
}

export function getWelcomeEmailText(params: {
  name?: string;
  email: string;
  frontendUrl: string;
}): string {
  const { name, frontendUrl } = params;
  const greeting = name && name.trim() ? `Hi ${name.trim()},` : 'Hello,';

  return `${greeting}

Welcome to ClipFlow. Thank you for joining us.

ClipFlow is part of Cliy, where we build and deliver video editing and content creation tools for creators around the world.

What you can do with ClipFlow:
- Video trimming & clipping: Fast precision clipping from long-form content.
- Smart aspect ratios: Instant 9:16 Shorts/Reels, 1:1 Square, and 4:5 Portrait framing.
- Captions & subtitles: Synchronized subtitles in SRT, VTT, and plain text.
- Multi-platform workflows: Extract and repurpose from YouTube, Twitch, Instagram, and X.
- Cloud & local companion: Direct Google Drive integration and local hardware acceleration.

Launch ClipFlow:
${frontendUrl}

We'd love to have you with us as we build the next generation of creator tools.

Thanks,
The Cliy Team

ClipFlow is a product by Cliy.
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
