/**
 * Professional responsive HTML email templates for ClipFlow Studio.
 * Designed with a modern, high-contrast dark aesthetic, robust HTML table layouts,
 * MSO/Outlook conditional comments, and bulletproof cross-client compatibility
 * (Gmail, Apple Mail, Outlook, Yahoo, iOS Mail, Android).
 */

interface BaseLayoutOptions {
  title: string;
  preheader?: string;
  content: string;
}

/**
 * Universal HTML Email Wrapper with MSO & WebKit support
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
  <meta name="color-scheme" content="dark only">
  <meta name="supported-color-schemes" content="dark only">
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
    .mso-btn { padding: 14px 28px !important; }
  </style>
  <![endif]-->
  <style type="text/css">
    :root {
      color-scheme: dark only;
      supported-color-schemes: dark only;
    }
    body {
      margin: 0 !important;
      padding: 0 !important;
      -webkit-text-size-adjust: 100% !important;
      -ms-text-size-adjust: 100% !important;
      background-color: #08090e !important;
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
    @media only screen and (max-width: 620px) {
      .email-container {
        width: 100% !important;
        max-width: 100% !important;
      }
      .mobile-padding {
        padding-left: 20px !important;
        padding-right: 20px !important;
      }
      .otp-digit {
        font-size: 28px !important;
        letter-spacing: 6px !important;
      }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #08090e; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; color: #f1f5f9; -webkit-font-smoothing: antialiased;">
  ${previewText}
  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #08090e; min-height: 100vh;">
    <tr>
      <td align="center" style="padding: 40px 16px;">
        
        <!-- Main Container Card -->
        <table role="presentation" class="email-container" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 580px; background-color: #0f121d; border-radius: 20px; border: 1px solid #1e2436; overflow: hidden; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.85);">
          
          <!-- Top Accent Gradient Line -->
          <tr>
            <td style="height: 4px; background: linear-gradient(90deg, #8b5cf6 0%, #6366f1 50%, #38bdf8 100%);"></td>
          </tr>

          <!-- Header Logo Bar -->
          <tr>
            <td align="center" style="padding: 34px 32px 20px 32px;">
              <table role="presentation" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center">
                    <div style="display: inline-block; background: rgba(139, 92, 246, 0.12); border: 1px solid rgba(139, 92, 246, 0.35); border-radius: 9999px; padding: 8px 22px;">
                      <table role="presentation" border="0" cellspacing="0" cellpadding="0">
                        <tr>
                          <td valign="middle" style="font-size: 16px; line-height: 1; padding-right: 8px;">🎬</td>
                          <td valign="middle">
                            <span style="font-size: 16px; font-weight: 800; letter-spacing: 0.8px; color: #ffffff;">
                              <span style="color: #a78bfa;">CLIP</span>FLOW
                            </span>
                            <span style="display: inline-block; margin-left: 8px; font-size: 10px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 1.5px; background: #1a1f33; padding: 2px 7px; border-radius: 4px;">STUDIO</span>
                          </td>
                        </tr>
                      </table>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Content Slot -->
          <tr>
            <td class="mobile-padding" style="padding: 12px 36px 36px 36px;">
              ${content}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td class="mobile-padding" style="padding: 28px 36px 32px 36px; background-color: #0a0b12; border-top: 1px solid #171b29; text-align: center;">
              <p style="margin: 0 0 10px 0; font-size: 12px; font-weight: 600; color: #818cf8; letter-spacing: 0.3px;">
                ClipFlow Studio • High-Performance AI Video Repurposing
              </p>
              <p style="margin: 0 0 12px 0; font-size: 11px; color: #64748b; line-height: 1.6;">
                Automated multi-platform video extraction, smart ratio framing, synchronized subtitles & companion rendering.
              </p>
              <p style="margin: 0; font-size: 11px; color: #475569;">
                &copy; ${new Date().getFullYear()} ClipFlow Technologies Inc. All rights reserved.
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

  const recipientName = name && name.trim() ? escapeHtml(name.trim()) : 'Creator';

  const body = `
    <!-- Header Title -->
    <div style="text-align: center; margin-bottom: 26px;">
      <h1 style="margin: 0 0 10px 0; font-size: 24px; font-weight: 800; color: #ffffff; letter-spacing: -0.4px;">
        Verify Your Email Address
      </h1>
      <p style="margin: 0; font-size: 14px; color: #94a3b8; line-height: 1.6;">
        Welcome to ClipFlow Studio, <strong style="color: #f1f5f9;">${recipientName}</strong>! Please enter the 6-digit verification code below to confirm your account and get started.
      </p>
    </div>

    <!-- OTP Code Card -->
    <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin: 24px 0 28px 0;">
      <tr>
        <td align="center">
          <div style="background: #090a12; border: 1px solid #312e81; border-radius: 16px; padding: 26px 20px; text-align: center; box-shadow: inset 0 2px 10px rgba(0, 0, 0, 0.6), 0 10px 25px -5px rgba(99, 102, 241, 0.15);">
            <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; color: #a78bfa; margin-bottom: 12px;">
              ONE-TIME VERIFICATION CODE
            </div>
            <div class="otp-digit" style="font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, Courier, monospace; font-size: 38px; font-weight: 800; letter-spacing: 10px; color: #ffffff; text-shadow: 0 0 20px rgba(167, 139, 250, 0.6); padding: 4px 0 8px 10px;">
              ${escapeHtml(otpCode)}
            </div>
            <div style="display: inline-block; background: rgba(99, 102, 241, 0.12); border: 1px solid rgba(99, 102, 241, 0.3); border-radius: 20px; padding: 4px 14px; margin-top: 6px;">
              <span style="font-size: 12px; color: #cbd5e1; font-weight: 500;">⏱️ Valid for <strong>24 hours</strong> • Single use</span>
            </div>
          </div>
        </td>
      </tr>
    </table>

    <!-- Direct 1-Click Button -->
    <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin: 28px 0;">
      <tr>
        <td align="center">
          <!--[if mso]>
          <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${verificationUrl}" style="height:48px;v-text-anchor:middle;width:260px;" arcsize="20%" stroke="f" fillcolor="#8b5cf6">
            <w:anchorlock/>
            <center style="color:#ffffff;font-family:sans-serif;font-size:14px;font-weight:bold;">Verify Email Address &rarr;</center>
          </v:roundrect>
          <![endif]-->
          <!--[if !mso]><!-->
          <a href="${verificationUrl}" target="_blank" class="mso-btn" style="display: inline-block; background: linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%); color: #ffffff; padding: 14px 34px; border-radius: 12px; font-size: 14px; font-weight: 700; text-decoration: none; letter-spacing: 0.3px; box-shadow: 0 10px 25px -4px rgba(139, 92, 246, 0.55);">
            Verify Email Address &rarr;
          </a>
          <!--<![endif]-->
        </td>
      </tr>
    </table>

    <!-- Fallback Direct Link -->
    <div style="border-top: 1px solid #1a2030; padding-top: 20px; margin-top: 24px; text-align: center;">
      <p style="margin: 0 0 6px 0; font-size: 12px; color: #64748b;">
        Button not working? Copy and paste this link into your browser:
      </p>
      <a href="${verificationUrl}" target="_blank" style="color: #a78bfa; word-break: break-all; font-size: 11px; text-decoration: underline; line-height: 1.5;">
        ${verificationUrl}
      </a>
      <p style="margin: 18px 0 0 0; font-size: 11px; color: #475569;">
        If you didn't create a ClipFlow account, you can safely disregard this email.
      </p>
    </div>
  `;

  return emailLayout({
    title: 'Verify your ClipFlow account',
    preheader: `Your ClipFlow verification code is ${otpCode}. Valid for 24 hours.`,
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
    <!-- Header Title & Security Shield -->
    <div style="text-align: center; margin-bottom: 24px;">
      <div style="display: inline-block; background: rgba(239, 68, 68, 0.12); border: 1px solid rgba(239, 68, 68, 0.35); border-radius: 50%; padding: 14px; margin-bottom: 14px;">
        <span style="font-size: 24px; line-height: 1;">🔒</span>
      </div>
      <h1 style="margin: 0 0 10px 0; font-size: 24px; font-weight: 800; color: #ffffff; letter-spacing: -0.4px;">
        Password Reset Request
      </h1>
      <p style="margin: 0; font-size: 14px; color: #94a3b8; line-height: 1.6;">
        We received a request to reset your password for your ClipFlow account. Use the one-time code below to choose a new password.
      </p>
    </div>

    <!-- OTP Code Card (Security Amber) -->
    <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin: 24px 0 28px 0;">
      <tr>
        <td align="center">
          <div style="background: #090a12; border: 1px solid #7c2d12; border-radius: 16px; padding: 26px 20px; text-align: center; box-shadow: inset 0 2px 10px rgba(0, 0, 0, 0.6), 0 10px 25px -5px rgba(249, 115, 22, 0.15);">
            <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; color: #fb923c; margin-bottom: 12px;">
              6-DIGIT RESET CODE
            </div>
            <div class="otp-digit" style="font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, Courier, monospace; font-size: 38px; font-weight: 800; letter-spacing: 10px; color: #ffffff; text-shadow: 0 0 20px rgba(249, 115, 22, 0.6); padding: 4px 0 8px 10px;">
              ${escapeHtml(otpCode)}
            </div>
            <div style="display: inline-block; background: rgba(249, 115, 22, 0.12); border: 1px solid rgba(249, 115, 22, 0.3); border-radius: 20px; padding: 4px 14px; margin-top: 6px;">
              <span style="font-size: 12px; color: #fed7aa; font-weight: 500;">⏱️ Valid for <strong>60 minutes</strong></span>
            </div>
          </div>
        </td>
      </tr>
    </table>

    <!-- Direct 1-Click Reset Button -->
    <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin: 28px 0;">
      <tr>
        <td align="center">
          <!--[if mso]>
          <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${resetUrl}" style="height:48px;v-text-anchor:middle;width:260px;" arcsize="20%" stroke="f" fillcolor="#ea580c">
            <w:anchorlock/>
            <center style="color:#ffffff;font-family:sans-serif;font-size:14px;font-weight:bold;">Choose New Password &rarr;</center>
          </v:roundrect>
          <![endif]-->
          <!--[if !mso]><!-->
          <a href="${resetUrl}" target="_blank" class="mso-btn" style="display: inline-block; background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); color: #ffffff; padding: 14px 34px; border-radius: 12px; font-size: 14px; font-weight: 700; text-decoration: none; letter-spacing: 0.3px; box-shadow: 0 10px 25px -4px rgba(234, 88, 12, 0.55);">
            Choose New Password &rarr;
          </a>
          <!--<![endif]-->
        </td>
      </tr>
    </table>

    <!-- Security Warning & Direct Link -->
    <div style="border-top: 1px solid #1a2030; padding-top: 20px; margin-top: 24px; text-align: center;">
      <p style="margin: 0 0 8px 0; font-size: 12px; color: #94a3b8; line-height: 1.5;">
        If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged and your account stays protected.
      </p>
      <p style="margin: 12px 0 0 0; font-size: 11px; color: #64748b;">
        Reset link: <a href="${resetUrl}" target="_blank" style="color: #fb923c; word-break: break-all; text-decoration: underline;">${resetUrl}</a>
      </p>
    </div>
  `;

  return emailLayout({
    title: 'Reset your ClipFlow password',
    preheader: `Your ClipFlow password reset code is ${otpCode}. Expires in 60 minutes.`,
    content: body,
  });
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
  const displayName = name && name.trim() ? escapeHtml(name.trim()) : 'Creator';
  const studioUrl = `${frontendUrl}/editor/storage`;

  const body = `
    <!-- Hero Banner -->
    <div style="text-align: center; margin-bottom: 28px;">
      <div style="display: inline-block; background: linear-gradient(135deg, rgba(139, 92, 246, 0.2), rgba(56, 189, 248, 0.2)); border: 1px solid rgba(139, 92, 246, 0.4); border-radius: 50%; padding: 16px; margin-bottom: 16px;">
        <span style="font-size: 30px; line-height: 1;">🚀</span>
      </div>
      <h1 style="margin: 0 0 10px 0; font-size: 26px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px;">
        Welcome to ClipFlow Studio, ${displayName}!
      </h1>
      <p style="margin: 0 auto; max-width: 460px; font-size: 14px; color: #cbd5e1; line-height: 1.6;">
        You're officially set up to turn long-form video into high-converting, viral clips for TikTok, YouTube Shorts, and Instagram Reels in seconds.
      </p>
    </div>

    <!-- 4 Core Capabilities Section -->
    <div style="margin: 28px 0;">
      <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; color: #a78bfa; text-align: center; margin-bottom: 16px;">
        YOUR CREATOR SUPERPOWERS
      </div>

      <!-- Capability Cards -->
      <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
        <!-- Card 1 -->
        <tr>
          <td style="padding-bottom: 10px;">
            <div style="background-color: #0b0d17; border: 1px solid #1a2033; border-radius: 14px; padding: 14px 18px;">
              <table role="presentation" border="0" cellspacing="0" cellpadding="0" width="100%">
                <tr>
                  <td width="38" valign="top" style="font-size: 22px; line-height: 1; padding-top: 2px;">📐</td>
                  <td style="padding-left: 12px;">
                    <div style="font-size: 13px; font-weight: 700; color: #ffffff; margin-bottom: 3px;">
                      Smart Ratios & Interactive Crop Framing
                    </div>
                    <div style="font-size: 12px; color: #94a3b8; line-height: 1.5;">
                      Instantly transform videos into 9:16 Shorts/Reels, 1:1 Square, and 4:5 Portrait with live visual cropping and background blur effects.
                    </div>
                  </td>
                </tr>
              </table>
            </div>
          </td>
        </tr>

        <!-- Card 2 -->
        <tr>
          <td style="padding-bottom: 10px;">
            <div style="background-color: #0b0d17; border: 1px solid #1a2033; border-radius: 14px; padding: 14px 18px;">
              <table role="presentation" border="0" cellspacing="0" cellpadding="0" width="100%">
                <tr>
                  <td width="38" valign="top" style="font-size: 22px; line-height: 1; padding-top: 2px;">⚡</td>
                  <td style="padding-left: 12px;">
                    <div style="font-size: 13px; font-weight: 700; color: #ffffff; margin-bottom: 3px;">
                      Multi-Platform Instant Video Extraction
                    </div>
                    <div style="font-size: 12px; color: #94a3b8; line-height: 1.5;">
                      Paste any link from YouTube, Twitch streams/VODs, Instagram Reels, or X/Twitter. Extract high-bitrate video and audio on demand.
                    </div>
                  </td>
                </tr>
              </table>
            </div>
          </td>
        </tr>

        <!-- Card 3 -->
        <tr>
          <td style="padding-bottom: 10px;">
            <div style="background-color: #0b0d17; border: 1px solid #1a2033; border-radius: 14px; padding: 14px 18px;">
              <table role="presentation" border="0" cellspacing="0" cellpadding="0" width="100%">
                <tr>
                  <td width="38" valign="top" style="font-size: 22px; line-height: 1; padding-top: 2px;">📝</td>
                  <td style="padding-left: 12px;">
                    <div style="font-size: 13px; font-weight: 700; color: #ffffff; margin-bottom: 3px;">
                      AI Synchronized Captions & Subtitles
                    </div>
                    <div style="font-size: 12px; color: #94a3b8; line-height: 1.5;">
                      Auto-generate dynamic captions with word-level timestamps and export directly in .SRT, .VTT, or burned-in video subtitles.
                    </div>
                  </td>
                </tr>
              </table>
            </div>
          </td>
        </tr>

        <!-- Card 4 -->
        <tr>
          <td style="padding-bottom: 10px;">
            <div style="background-color: #0b0d17; border: 1px solid #1a2033; border-radius: 14px; padding: 14px 18px;">
              <table role="presentation" border="0" cellspacing="0" cellpadding="0" width="100%">
                <tr>
                  <td width="38" valign="top" style="font-size: 22px; line-height: 1; padding-top: 2px;">☁️</td>
                  <td style="padding-left: 12px;">
                    <div style="font-size: 13px; font-weight: 700; color: #ffffff; margin-bottom: 3px;">
                      Google Drive Cloud Sync & Companion Engine
                    </div>
                    <div style="font-size: 12px; color: #94a3b8; line-height: 1.5;">
                      Seamless 1-click Google Drive integration to auto-sync exports, plus local GPU hardware acceleration for blazing-fast rendering.
                    </div>
                  </td>
                </tr>
              </table>
            </div>
          </td>
        </tr>
      </table>
    </div>

    <!-- Pro Tip Callout Box -->
    <div style="background: linear-gradient(135deg, rgba(139, 92, 246, 0.1), rgba(59, 130, 246, 0.1)); border: 1px solid rgba(139, 92, 246, 0.3); border-radius: 14px; padding: 16px 20px; margin: 24px 0 28px 0;">
      <div style="font-size: 12px; font-weight: 700; color: #c084fc; margin-bottom: 4px;">
        💡 PRO TIP: CONNECT YOUR GOOGLE DRIVE
      </div>
      <div style="font-size: 12px; color: #cbd5e1; line-height: 1.5;">
        Head to <strong>Settings &rarr; Google Drive</strong> inside the studio to link your Google account. All finished clips can be automatically backed up directly to your personal Drive.
      </div>
    </div>

    <!-- Primary Launch Studio CTA -->
    <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin: 28px 0 16px 0;">
      <tr>
        <td align="center">
          <!--[if mso]>
          <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${studioUrl}" style="height:52px;v-text-anchor:middle;width:270px;" arcsize="20%" stroke="f" fillcolor="#8b5cf6">
            <w:anchorlock/>
            <center style="color:#ffffff;font-family:sans-serif;font-size:15px;font-weight:bold;">Launch ClipFlow Studio &rarr;</center>
          </v:roundrect>
          <![endif]-->
          <!--[if !mso]><!-->
          <a href="${studioUrl}" target="_blank" class="mso-btn" style="display: inline-block; background: linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%); color: #ffffff; padding: 15px 38px; border-radius: 12px; font-size: 15px; font-weight: 800; text-decoration: none; letter-spacing: 0.3px; box-shadow: 0 10px 30px -4px rgba(139, 92, 246, 0.6);">
            Launch ClipFlow Studio &rarr;
          </a>
          <!--<![endif]-->
        </td>
      </tr>
    </table>
  `;

  return emailLayout({
    title: 'Welcome to ClipFlow Studio!',
    preheader: `Welcome to ClipFlow Studio, ${displayName}! Start clipping long videos into viral shorts.`,
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
