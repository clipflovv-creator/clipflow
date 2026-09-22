import { Resend } from 'resend';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import {
  getVerificationEmailHtml,
  getPasswordResetEmailHtml,
  getWelcomeEmailHtml,
} from './email-templates.js';

dotenv.config();

const DEFAULT_FRONTEND_URL = 'http://localhost:5173';
const DEFAULT_EMAIL_FROM = 'ClipFlow <no-reply@clipflow.cliy.me>';

class EmailService {
  private resend: Resend | null = null;
  private transporter: any = null;
  private initialized: boolean = false;

  constructor() {
    this.initClients();
  }

  private initClients() {
    const fromAddress = process.env.EMAIL_FROM || DEFAULT_EMAIL_FROM;

    // 1. Resend API Client (Primary)
    if (process.env.RESEND_API_KEY) {
      try {
        this.resend = new Resend(process.env.RESEND_API_KEY);
        console.log(`[EmailService] Resend API client initialized (from: ${fromAddress})`);
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
        console.log('[EmailService] SMTP fallback transporter initialized');
      } catch (err: any) {
        console.warn('[EmailService] Failed to initialize SMTP transporter:', err.message);
      }
    }

    this.initialized = true;
  }

  /**
   * Lazily re-checks environment variables in case dotenv was loaded after service creation
   */
  private ensureClients() {
    if (!this.resend && process.env.RESEND_API_KEY) {
      this.initClients();
    }
  }

  private getEmailFrom(): string {
    return process.env.EMAIL_FROM || DEFAULT_EMAIL_FROM;
  }

  private getFrontendUrl(): string {
    return process.env.FRONTEND_URL || DEFAULT_FRONTEND_URL;
  }

  /**
   * Internal sender helper trying Resend first, then SMTP fallback, with developer logging.
   */
  private async deliverEmail(params: {
    to: string;
    subject: string;
    html: string;
  }): Promise<boolean> {
    this.ensureClients();
    const { to, subject, html } = params;
    const emailFrom = this.getEmailFrom();

    // A. Attempt Resend API
    if (this.resend) {
      try {
        const { data, error } = await this.resend.emails.send({
          from: emailFrom,
          to: [to],
          subject,
          html,
        });

        if (error) {
          console.error('[EmailService:Resend Error]', error);
        } else {
          console.log(`[EmailService] Delivered via Resend to ${to} (ID: ${data?.id})`);
          return true;
        }
      } catch (err: any) {
        console.error('[EmailService:Resend Exception]', err.message);
      }
    } else {
      console.warn('[EmailService] Warning: No RESEND_API_KEY found in environment');
    }

    // B. Attempt SMTP Fallback
    if (this.transporter) {
      try {
        await this.transporter.sendMail({
          from: emailFrom,
          to,
          subject,
          html,
        });
        console.log(`[EmailService] Delivered via SMTP fallback to: ${to}`);
        return true;
      } catch (err: any) {
        console.warn('[EmailService:SMTP Fallback Error]', err.message);
      }
    }

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
    const frontendUrl = this.getFrontendUrl();
    const verificationUrl = rawToken
      ? `${frontendUrl}/verify-email?token=${encodeURIComponent(rawToken)}`
      : `${frontendUrl}/verify-email?code=${encodeURIComponent(otpCode)}`;

    console.log('\n================== EMAIL VERIFICATION ==================');
    console.log(`To: ${email}`);
    console.log(`6-Digit OTP Code: ${otpCode}`);
    console.log(`Verification URL: ${verificationUrl}`);
    console.log('=========================================================\n');

    const html = getVerificationEmailHtml({
      otpCode,
      rawToken,
      name,
      frontendUrl,
    });

    return await this.deliverEmail({
      to: email,
      subject: `Verify your ClipFlow account (Code: ${otpCode})`,
      html,
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
    const frontendUrl = this.getFrontendUrl();
    const resetUrl = rawToken
      ? `${frontendUrl}/reset-password?token=${encodeURIComponent(rawToken)}`
      : `${frontendUrl}/reset-password?code=${encodeURIComponent(otpCode)}`;

    console.log('\n================== PASSWORD RESET ==================');
    console.log(`To: ${email}`);
    console.log(`6-Digit Reset Code: ${otpCode}`);
    console.log(`Reset URL: ${resetUrl}`);
    console.log('====================================================\n');

    const html = getPasswordResetEmailHtml({
      otpCode,
      rawToken,
      frontendUrl,
    });

    return await this.deliverEmail({
      to: email,
      subject: `Reset your ClipFlow password (Code: ${otpCode})`,
      html,
    });
  }

  /**
   * Sends a feature-rich welcome email to new users introducing video editing tools.
   */
  public async sendWelcomeEmail(email: string, name?: string): Promise<boolean> {
    const frontendUrl = this.getFrontendUrl();

    console.log('\n================== WELCOME EMAIL ==================');
    console.log(`To: ${email} (Name: ${name || 'User'})`);
    console.log('===================================================\n');

    const html = getWelcomeEmailHtml({
      name,
      email,
      frontendUrl,
    });

    return await this.deliverEmail({
      to: email,
      subject: `Welcome to ClipFlow Studio 🎬 — Video Editing & AI Repurposing`,
      html,
    });
  }
}

export const emailService = new EmailService();
