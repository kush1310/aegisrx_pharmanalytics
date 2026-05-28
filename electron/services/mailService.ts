import nodemailer from 'nodemailer';
import { app } from 'electron';
import path from 'path';
import fs from 'fs';

let transporter: nodemailer.Transporter | null = null;

export async function getTransporter() {
  if (transporter) return transporter;

  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT) || 587;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (host && user && pass) {
    transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass }
    });
  } else {
    console.log('[Mailer] Missing SMTP env configuration, creating Ethereal test account...');
    try {
      const testAccount = await nodemailer.createTestAccount();
      transporter = nodemailer.createTransport({
        host: testAccount.smtp.host,
        port: testAccount.smtp.port,
        secure: testAccount.smtp.secure,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass
        }
      });
      console.log('[Mailer] Ethereal SMTP configured. User:', testAccount.user);
    } catch (e) {
      console.error('[Mailer] Failed to create Ethereal account, falling back to mock mailer:', e);
      transporter = {
        sendMail: async (mailOptions: any) => {
          console.log('\n=== MOCK EMAIL SENT ===');
          console.log('To:', mailOptions.to);
          console.log('Subject:', mailOptions.subject);
          console.log('Body:\n', mailOptions.text);
          console.log('=======================\n');
          return { messageId: 'mock-id' };
        }
      } as any;
    }
  }

  return transporter;
}

export async function sendOtpEmail(to: string, otp: string) {
  try {
    const client = await getTransporter();
    const info = await client.sendMail({
      from: process.env.SMTP_FROM || '"AegisRx Analytics Support" <support@aegisrx.com>',
      to,
      subject: 'AegisRx Analytics — Password Reset Verification Code',
      text: `Hello,\n\nWe received a request to reset your password for AegisRx Analytics.\n\nYour 6-digit verification code is: ${otp}\n\nThis code is valid for 10 minutes. If you did not make this request, you can safely ignore this email.\n\nBest regards,\nAegisRx Analytics Team`,
      html: `
        <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
          <h2 style="color: #4f46e5; margin-bottom: 20px; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px;">AegisRx Analytics</h2>
          <p style="color: #334155; font-size: 16px; line-height: 1.5;">Hello,</p>
          <p style="color: #334155; font-size: 16px; line-height: 1.5;">We received a request to reset your password. Use the following verification code to proceed:</p>
          <div style="background: #f8fafc; padding: 15px; border-radius: 8px; text-align: center; margin: 25px 0;">
            <span style="font-family: monospace; font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #1e1b4b;">${otp}</span>
          </div>
          <p style="color: #64748b; font-size: 14px; line-height: 1.5;">This code is valid for 10 minutes. If you did not make this request, you can safely ignore this email.</p>
          <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 30px 0;" />
          <p style="color: #94a3b8; font-size: 12px; text-align: center;">© 2026 AegisRx Analytics. All rights reserved.</p>
        </div>
      `
    });

    const previewUrl = nodemailer.getTestMessageUrl(info);
    if (previewUrl) {
      console.log('[Mailer] Ethereal email sent. View preview here:', previewUrl);
      const dbgPath = path.join(app.getPath('userData'), 'last-email-preview.txt');
      fs.writeFileSync(dbgPath, `Preview URL: ${previewUrl}\nOTP: ${otp}\nTo: ${to}\nTimestamp: ${new Date().toISOString()}`);
      console.log('[Mailer] Preview URL saved to:', dbgPath);
    } else {
      console.log('[Mailer] Email sent successfully. MessageID:', info.messageId);
    }
    return { success: true };
  } catch (error: any) {
    console.error('[Mailer] sendOtpEmail failed:', error);
    try {
      const dbgPath = path.join(app.getPath('userData'), 'last-email-preview.txt');
      fs.writeFileSync(dbgPath, `ERROR: ${error.message}\nOTP: ${otp}\nTo: ${to}\n[Offline Fallback]\nTimestamp: ${new Date().toISOString()}`);
      console.log('[Mailer] Offline fallback OTP saved to:', dbgPath);
    } catch (e) {}
    throw error;
  }
}
