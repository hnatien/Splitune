// Fills the launchd templates' placeholders (__REPO__, __USER_HOME__, __NODE__) for `pnpm workers`.
const XML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }

const escapeXml = (value) => value.replace(/[&<>"']/g, (c) => XML_ESCAPES[c])

export function renderPlist(template, values) {
  let rendered = template
  for (const [name, value] of Object.entries(values)) {
    rendered = rendered.replaceAll(`__${name}__`, escapeXml(value))
  }
  const left = rendered.match(/__[A-Z_]+__/)
  if (left) throw new Error(`placeholder ${left[0]} has no value`)
  return rendered
}
