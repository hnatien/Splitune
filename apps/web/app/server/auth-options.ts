import { createServerFn } from '@tanstack/react-start'

// What the auth pages offer (27 §3.4): Google only when the API has its credentials.
export const getAuthOptions = createServerFn({ method: 'GET' }).handler(() => {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET } = process.env
  return { google: Boolean(GOOGLE_CLIENT_ID?.trim() && GOOGLE_CLIENT_SECRET?.trim()) }
})
