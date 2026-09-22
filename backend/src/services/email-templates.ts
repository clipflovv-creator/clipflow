/**
 * Executive-tier HTML email templates for ClipFlow.
 * Designed with a clean, minimalist, high-contrast aesthetic modeled after Stripe and Linear.
 * Zero emojis, clean typography, neutral color palette, and bulletproof Outlook (MSO) table support.
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
            <td style="padding: 24px 36px; background-color: #fafafa; border-top: 1px solid #f1f5f9; text-align: left;">
              <p style="margin: 0 0 6px 0; font-size: 12px; color: #64748b; line-height: 1.5;">
                This message was sent by ClipFlow. If you did not make this request, you can safely ignore this email.
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

    <!-- OTP Code Container -->
    <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin: 20px 0 28px 0;">
      <tr>
        <td align="center" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 22px 16px;">
          <div style="font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; color: #64748b; margin-bottom: 8px;">
            Verification Code
          </div>
          <div class="otp-code" style="font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #0f172a; padding-left: 8px;">
            ${escapeHtml(otpCode)}
          </div>
          <div style="margin-top: 10px; font-size: 12px; color: #64748b;">
            This code expires in 24 hours.
          </div>
        </td>
      </tr>
    </table>

    <!-- Primary Action Button -->
    <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin: 28px 0;">
      <tr>
        <td align="left">
          <!--[if mso]>
          <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${verificationUrl}" style="height:42px;v-text-anchor:middle;width:200px;" arcsize="12%" stroke="f" fillcolor="#0f172a">
            <w:anchorlock/>
            <center style="color:#ffffff;font-family:sans-serif;font-size:13px;font-weight:600;">Confirm Email Address</center>
          </v:roundrect>
          <![endif]-->
          <!--[if !mso]><!-->
          <a href="${verificationUrl}" target="_blank" style="display: inline-block; background-color: #0f172a; color: #ffffff; padding: 12px 24px; border-radius: 6px; font-size: 13px; font-weight: 600; text-decoration: none; letter-spacing: 0.2px;">
            Confirm Email Address
          </a>
          <!--<![endif]-->
        </td>
      </tr>
    </table>

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
    <h1 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 600; color: #0f172a; letter-spacing: -0.02em; line-height: 1.3;">
      Reset your password
    </h1>
    <p style="margin: 0 0 28px 0; font-size: 14px; color: #475569; line-height: 1.6;">
      We received a request to reset your password for your ClipFlow account. Use the code below to complete the reset process.
    </p>

    <!-- OTP Code Container -->
    <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin: 20px 0 28px 0;">
      <tr>
        <td align="center" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 22px 16px;">
          <div style="font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; color: #64748b; margin-bottom: 8px;">
            Reset Code
          </div>
          <div class="otp-code" style="font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #0f172a; padding-left: 8px;">
            ${escapeHtml(otpCode)}
          </div>
          <div style="margin-top: 10px; font-size: 12px; color: #64748b;">
            This code expires in 60 minutes.
          </div>
        </td>
      </tr>
    </table>

    <!-- Primary Action Button -->
    <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin: 28px 0;">
      <tr>
        <td align="left">
          <!--[if mso]>
          <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${resetUrl}" style="height:42px;v-text-anchor:middle;width:180px;" arcsize="12%" stroke="f" fillcolor="#0f172a">
            <w:anchorlock/>
            <center style="color:#ffffff;font-family:sans-serif;font-size:13px;font-weight:600;">Reset Password</center>
          </v:roundrect>
          <![endif]-->
          <!--[if !mso]><!-->
          <a href="${resetUrl}" target="_blank" style="display: inline-block; background-color: #0f172a; color: #ffffff; padding: 12px 24px; border-radius: 6px; font-size: 13px; font-weight: 600; text-decoration: none; letter-spacing: 0.2px;">
            Reset Password
          </a>
          <!--<![endif]-->
        </td>
      </tr>
    </table>

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
    <h1 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 600; color: #0f172a; letter-spacing: -0.02em; line-height: 1.3;">
      Welcome to ClipFlow
    </h1>
    <p style="margin: 0 0 16px 0; font-size: 14px; color: #475569; line-height: 1.6;">
      ${recipientGreeting}
    </p>
    <p style="margin: 0 0 24px 0; font-size: 14px; color: #475569; line-height: 1.6;">
      Your ClipFlow workspace is active. ClipFlow provides tools to reframe, extract, and produce video clips across social formats with minimal manual overhead.
    </p>

    <!-- Key Capabilities List (Clean Minimalist Layout) -->
    <div style="margin: 24px 0; padding: 16px 20px; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px;">
      <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: #64748b; margin-bottom: 12px;">
        Core Features
      </div>
      
      <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
        <tr>
          <td valign="top" style="padding-bottom: 10px; font-size: 13px; line-height: 1.5; color: #334155;">
            <strong style="color: #0f172a;">Smart Aspect Ratio Framing:</strong> Convert 16:9 widescreen footage into 9:16 vertical, 1:1 square, or 4:5 portrait formats with active framing controls.
          </td>
        </tr>
        <tr>
          <td valign="top" style="padding-bottom: 10px; font-size: 13px; line-height: 1.5; color: #334155;">
            <strong style="color: #0f172a;">Direct Media Ingestion:</strong> Ingest source media directly from YouTube, Twitch streams and VODs, Instagram Reels, and X videos.
          </td>
        </tr>
        <tr>
          <td valign="top" style="padding-bottom: 10px; font-size: 13px; line-height: 1.5; color: #334155;">
            <strong style="color: #0f172a;">Synchronized Subtitles:</strong> Automatically generate word-level timestamped transcripts and export clean .SRT or .VTT subtitle files.
          </td>
        </tr>
        <tr>
          <td valign="top" style="font-size: 13px; line-height: 1.5; color: #334155;">
            <strong style="color: #0f172a;">Cloud Storage Backup:</strong> Connect your personal Google Drive in workspace settings to automatically archive all exported media.
          </td>
        </tr>
      </table>
    </div>

    <!-- Primary Action Button -->
    <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin: 28px 0 20px 0;">
      <tr>
        <td align="left">
          <!--[if mso]>
          <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${studioUrl}" style="height:42px;v-text-anchor:middle;width:180px;" arcsize="12%" stroke="f" fillcolor="#0f172a">
            <w:anchorlock/>
            <center style="color:#ffffff;font-family:sans-serif;font-size:13px;font-weight:600;">Open Workspace</center>
          </v:roundrect>
          <![endif]-->
          <!--[if !mso]><!-->
          <a href="${studioUrl}" target="_blank" style="display: inline-block; background-color: #0f172a; color: #ffffff; padding: 12px 24px; border-radius: 6px; font-size: 13px; font-weight: 600; text-decoration: none; letter-spacing: 0.2px;">
            Open Workspace
          </a>
          <!--<![endif]-->
        </td>
      </tr>
    </table>

    <div style="border-top: 1px solid #f1f5f9; padding-top: 20px; margin-top: 24px;">
      <p style="margin: 0; font-size: 12px; color: #64748b; line-height: 1.5;">
        If you have any questions or require help getting started, please reply directly to this email.
      </p>
    </div>
  `;

  return emailLayout({
    title: 'Welcome to ClipFlow',
    preheader: `Welcome to ClipFlow, ${name || 'Creator'}. Your workspace is ready.`,
    content: body,
  });
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
