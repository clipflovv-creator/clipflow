import { Resend } from 'resend';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import {
  getVerificationEmailHtml,
  getVerificationEmailText,
  getPasswordResetEmailHtml,
  getPasswordResetEmailText,
  getWelcomeEmailHtml,
  getWelcomeEmailText,
} from './email-templates.js';

dotenv.config();

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
const EMAIL_FROM = process.env.EMAIL_FROM || 'ClipFlow <no-reply@clipflow.cliy.me>';

class EmailService {
  private resend: Resend | null = null;
  private transporter: any = null;

  constructor() {
    this.initClients();
  }

  private initClients() {
    // 1. Resend API Client (Primary)
    if (process.env.RESEND_API_KEY) {
      try {
        this.resend = new Resend(process.env.RESEND_API_KEY);
        console.log('[EmailService] Resend client initialized (from:', EMAIL_FROM, ')');
      } catch (err: any) {
        console.warn('[EmailService] Failed to initialize Resend:', err.message);
      }
    }

    // 2. SMTP Transporter (Fallback)
    if (process.env.SMTP_HOST && process.env.SMTP_USER) {
      try {
        this.transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: parseInt(process.env.SMTP_PORT || '587', 10),
          secure: process.env.SMTP_PORT === '465',
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASSWORD,
          },
        });
      } catch (err: any) {
        console.warn('[EmailService] Failed to initialize SMTP transporter:', err.message);
      }
    }
  }

  /**
   * Internal sender helper trying Resend first, then SMTP fallback, with developer logging.
   */
  private async deliverEmail(params: {
    to: string;
    subject: string;
    html: string;
    text?: string;
  }): Promise<boolean> {
    const { to, subject, html, text } = params;

    // A. Attempt Resend API
    if (this.resend) {
      try {
        const { data, error } = await this.resend.emails.send({
          from: EMAIL_FROM,
          to: [to],
          subject,
          html,
          ...(text ? { text } : {}),
        });

        if (error) {
          console.error('[EmailService:Resend Error]', JSON.stringify(error));
        } else {
          console.log(`[EmailService] Email delivered via Resend API to: ${to} (ID: ${data?.id})`);
          return true;
        }
      } catch (err: any) {
        console.error('[EmailService:Resend Exception]', err.message);
      }
    }

    // B. Attempt SMTP Fallback
    if (this.transporter) {
      try {
        await this.transporter.sendMail({
          from: EMAIL_FROM,
          to,
          subject,
          html,
          ...(text ? { text } : {}),
        });
        console.log(`[EmailService] Email delivered via SMTP to: ${to}`);
        return true;
      } catch (err: any) {
        console.warn('[EmailService:SMTP Fallback Error]', err.message);
      }
    }

    console.error(`[EmailService] Failed to deliver email to: ${to}`);
    return false;
  }

  /**
   * Sends an email verification OTP code & 1-click link to the user.
   */
  public async sendVerificationEmail(
    email: string,
    otpCode: string,
    rawToken?: string,
    name?: string
  ): Promise<boolean> {
    const verificationUrl = rawToken
      ? `${FRONTEND_URL}/verify-email?token=${encodeURIComponent(rawToken)}`
      : `${FRONTEND_URL}/verify-email?code=${encodeURIComponent(otpCode)}`;

    console.log('\n================== EMAIL VERIFICATION ==================');
    console.log(`To: ${email}`);
    console.log(`6-Digit OTP Code: ${otpCode}`);
    console.log(`Verification URL: ${verificationUrl}`);
    console.log('=========================================================\n');

    const html = getVerificationEmailHtml({
      otpCode,
      rawToken,
      name,
      frontendUrl: FRONTEND_URL,
    });

    const text = getVerificationEmailText({
      otpCode,
      rawToken,
      name,
      frontendUrl: FRONTEND_URL,
    });

    return await this.deliverEmail({
      to: email,
      subject: `Verify your ClipFlow account (Code: ${otpCode})`,
      html,
      text,
    });
  }

  /**
   * Sends a 6-digit password reset OTP & link to the user.
   */
  public async sendPasswordResetEmail(
    email: string,
    otpCode: string,
    rawToken?: string
  ): Promise<boolean> {
    const resetUrl = rawToken
      ? `${FRONTEND_URL}/reset-password?token=${encodeURIComponent(rawToken)}`
      : `${FRONTEND_URL}/reset-password?code=${encodeURIComponent(otpCode)}`;

    console.log('\n================== PASSWORD RESET ==================');
    console.log(`To: ${email}`);
    console.log(`6-Digit Reset Code: ${otpCode}`);
    console.log(`Reset URL: ${resetUrl}`);
    console.log('====================================================\n');

    const html = getPasswordResetEmailHtml({
      otpCode,
      rawToken,
      frontendUrl: FRONTEND_URL,
    });

    const text = getPasswordResetEmailText({
      otpCode,
      rawToken,
      frontendUrl: FRONTEND_URL,
    });

    return await this.deliverEmail({
      to: email,
      subject: `Reset your ClipFlow password (Code: ${otpCode})`,
      html,
      text,
    });
  }

  /**
   * Sends a feature-rich welcome email to new users introducing video editing tools.
   */
  public async sendWelcomeEmail(email: string, name?: string): Promise<boolean> {
    console.log('\n================== WELCOME EMAIL ==================');
    console.log(`To: ${email} (Name: ${name || 'User'})`);
    console.log('===================================================\n');

    const html = getWelcomeEmailHtml({
      name,
      email,
      frontendUrl: FRONTEND_URL,
    });

    const text = getWelcomeEmailText({
      name,
      email,
      frontendUrl: FRONTEND_URL,
    });

    return await this.deliverEmail({
      to: email,
      subject: `Welcome to ClipFlow Studio`,
      html,
      text,
    });
  }
}

export const emailService = new EmailService();
