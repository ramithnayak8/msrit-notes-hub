import nodemailer from 'nodemailer';
import { config } from '../config.js';
import { logger } from '../lib/logger.js';

const transport = config.SMTP_HOST
  ? nodemailer.createTransport({
      host: config.SMTP_HOST,
      port: config.SMTP_PORT,
      secure: config.SMTP_PORT === 465,
      auth: config.SMTP_USER ? { user: config.SMTP_USER, pass: config.SMTP_PASS } : undefined,
    })
  : null;

export async function sendVerificationEmail(to: string, name: string, link: string) {
  if (!transport) {
    // No SMTP in development: print the link so it can be clicked from the terminal.
    logger.warn({ to, link }, 'SMTP not configured; verification link');
    return;
  }
  await transport.sendMail({
    from: config.MAIL_FROM,
    to,
    subject: 'Verify your ConceptQuery account',
    text: `Hi ${name},\n\nConfirm your email to start using ConceptQuery:\n${link}\n\nThe link expires in 24 hours. If you didn't sign up, ignore this email.`,
    html: `<p>Hi ${escapeHtml(name)},</p><p>Confirm your email to start using ConceptQuery:</p><p><a href="${link}">Verify my email</a></p><p>The link expires in 24 hours. If you didn't sign up, ignore this email.</p>`,
  });
}

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
