import { m } from '@/lib/i18n'

// Legal page content (27 §3.2). Personal mode (25 §8): plain terms and privacy notes for a private
// deployment. Apart from the page so the route's loader and head don't pull the page in.

type Section = { id: string; title: string; body: string }

export const UPDATED = new Date(2026, 9, 22)

export function legalPages(): Record<string, { title: string; sections: Section[] }> {
  return {
    terms: {
      title: m['legal.terms_title'](),
      sections: [
        {
          id: 'service',
          title: m['legal.terms.service_title'](),
          body: m['legal.terms.service_body'](),
        },
        {
          id: 'your-songs',
          title: m['legal.terms.songs_title'](),
          body: m['legal.terms.songs_body'](),
        },
        {
          id: 'accuracy',
          title: m['legal.terms.accuracy_title'](),
          body: m['legal.terms.accuracy_body'](),
        },
        {
          id: 'billing',
          title: m['legal.terms.billing_title'](),
          body: m['legal.terms.billing_body'](),
        },
        {
          id: 'ending',
          title: m['legal.terms.ending_title'](),
          body: m['legal.terms.ending_body'](),
        },
      ],
    },
    privacy: {
      title: m['legal.privacy_title'](),
      sections: [
        {
          id: 'what',
          title: m['legal.privacy.what_title'](),
          body: m['legal.privacy.what_body'](),
        },
        {
          id: 'where',
          title: m['legal.privacy.where_title'](),
          body: m['legal.privacy.where_body'](),
        },
        {
          id: 'device',
          title: m['legal.privacy.device_title'](),
          body: m['legal.privacy.device_body'](),
        },
        {
          id: 'delete',
          title: m['legal.privacy.delete_title'](),
          body: m['legal.privacy.delete_body'](),
        },
      ],
    },
  }
}
