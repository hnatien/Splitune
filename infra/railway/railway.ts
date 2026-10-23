// Railway project `splitune`, environment production (25-personal-mode.md §1, §6): one `app`
// service (web + API, sleeps when idle) and Postgres. Review with
// `railway config plan --file infra/railway/railway.ts` and apply only what was approved; the
// generated *.up.railway.app domain is added with `railway domain` (never written here).
// Secrets are set with `railway variable set … --stdin` and kept by preserve().
import { defineRailway, github, postgres, preserve, project, service } from 'railway/iac'

// Singapore: nearest the owner's Mac and the APAC R2 bucket.
const REGION = 'asia-southeast1-eqsg3a'
// Railway's reference syntax, resolved per deploy to the service's generated domain.
// biome-ignore lint/suspicious/noTemplateCurlyInString: a Railway variable reference, not JS
const PUBLIC_ORIGIN = 'https://${{RAILWAY_PUBLIC_DOMAIN}}'

export default defineRailway(() => {
  const db = postgres('Postgres', { region: REGION })

  const app = service('app', {
    source: github('hnatien/Splitune', { branch: 'dev' }),
    build: {
      builder: 'DOCKERFILE',
      dockerfilePath: 'infra/railway/Dockerfile',
      // Only what the image contains; workers, ML, docs-only and CI changes don't redeploy.
      watchPatterns: [
        'apps/web/**',
        'apps/api/**',
        'packages/**',
        'infra/railway/**',
        'package.json',
        'pnpm-lock.yaml',
        'pnpm-workspace.yaml',
        'tsconfig.base.json',
        '.browserslistrc',
        '.dockerignore',
      ],
    },
    // `pnpm db:migrate` without pnpm in the image.
    preDeploy: 'node packages/db/scripts/migrate.ts',
    healthcheck: '/internal/ready',
    healthcheckTimeout: 120,
    deploy: {
      sleepApplication: true,
      restartPolicyType: 'ON_FAILURE',
      restartPolicyMaxRetries: 5,
    },
    regions: { [REGION]: 1 },
    env: {
      NODE_ENV: 'production',
      LOG_LEVEL: 'info',
      TRUST_PROXY: 'true',
      CSP_REPORT_ONLY: 'false',
      APP_URL: PUBLIC_ORIGIN,
      BETTER_AUTH_URL: PUBLIC_ORIGIN,
      DATABASE_URL: db.env.DATABASE_URL,
      BETTER_AUTH_SECRET: preserve(),
      BILLING_PROVIDER: 'mock',
      BILLING_WEBHOOK_SECRET: preserve(),
      BILLING_CURRENCY: 'USD',
      BILLING_PRICE_MONTHLY_MINOR: '999',
      BILLING_PRICE_YEARLY_MINOR: '7999',
      ANALYTICS_SALT: preserve(),
      S3_ENDPOINT: preserve(),
      S3_REGION: 'auto',
      S3_BUCKET: 'splitune-media',
      S3_FORCE_PATH_STYLE: 'false',
      S3_ACCESS_KEY_ID: preserve(),
      S3_SECRET_ACCESS_KEY: preserve(),
      SMTP_HOST: preserve(),
      SMTP_PORT: preserve(),
      SMTP_SECURE: preserve(),
      SMTP_USER: preserve(),
      SMTP_PASSWORD: preserve(),
      EMAIL_FROM: preserve(),
    },
  })

  return project('splitune', { resources: [db, app] })
})
