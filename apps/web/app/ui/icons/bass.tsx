import { createLucideIcon } from 'lucide-react'

// Its own module: only onboarding uses it, so the practice screen's icon module stays as it was.
/** Bass guitar: a smaller body and a longer neck than Lucide's guitar (onboarding's choice). */
export const BassIcon = createLucideIcon('bass', [
  ['path', { d: 'M8.5 13.5 19 3', key: 'neck' }],
  ['path', { d: 'm17.5 2.5 4 4', key: 'head' }],
  [
    'path',
    {
      d: 'M9.5 11.5c-1.6-1.6-4.6-1.2-5.9.6-1 1.4-.5 2.5-1.3 3.6-.8 1.1-.6 2.9.9 4.3 1.4 1.4 3.2 1.6 4.3.8 1.1-.8 2.2-.3 3.6-1.3 1.8-1.3 2.2-4.3.6-5.9Z',
      key: 'body',
    },
  ],
  ['path', { d: 'm6.5 15.5 2 2', key: 'bridge' }],
])
