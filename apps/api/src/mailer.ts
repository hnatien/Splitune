import nodemailer from 'nodemailer'
import type { ApiConfig } from './config.ts'

export interface Mail {
  to: string
  subject: string
  text: string
}

export interface Mailer {
  send(mail: Mail): Promise<void>
}

// SMTP when SMTP_HOST is set; otherwise nothing is sent (25-personal-mode.md §1: no mail server
// on Railway, whose Hobby plan blocks outbound SMTP). Short timeouts: an unreachable server fails
// within seconds instead of nodemailer's default two minutes.
export function createSmtpMailer(smtp: ApiConfig['smtp']): Mailer {
  if (!smtp) return { send: async () => undefined }
  const transport = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
    ...(smtp.user && smtp.password ? { auth: { user: smtp.user, pass: smtp.password } } : {}),
  })
  return {
    async send({ to, subject, text }) {
      // Username accounts carry a placeholder address under .invalid (auth.ts): nothing to send.
      if (to.toLowerCase().endsWith('.invalid')) return
      await transport.sendMail({ from: smtp.from, to, subject, text })
    },
  }
}
