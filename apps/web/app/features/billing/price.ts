// Prices in minor units (BillingPlan.price_minor), e.g. "$9.99" (27 §5.3: numerals).
export function formatPrice(minor: number, currency: string): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(minor / 100)
}
