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

// SMTP: Mailpit, locally (UI http://localhost:8025) and as a Railway service in production
// (25-personal-mode.md §1). Short timeouts: an unreachable server fails the request within
// seconds instead of leaving sign-in spinning for nodemailer's default two minutes.
export function createSmtpMailer(smtp: ApiConfig['smtp']): Mailer {
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
      await transport.sendMail({ from: smtp.from, to, subject, text })
    },
  }
}
