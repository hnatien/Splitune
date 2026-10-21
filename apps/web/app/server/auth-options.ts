import { createServerFn } from '@tanstack/react-start'

// What the sign-in page offers (27 §3.4): Google only when the API has its credentials, and the
// local Mailpit inbox link only in development.
export const getAuthOptions = createServerFn({ method: 'GET' }).handler(() => {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, NODE_ENV } = process.env
  return {
    google: Boolean(GOOGLE_CLIENT_ID?.trim() && GOOGLE_CLIENT_SECRET?.trim()),
    mailpitUrl: NODE_ENV === 'development' ? 'http://localhost:8025' : undefined,
  }
})
