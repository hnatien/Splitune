import { describe, expect, it } from 'vitest'
import { renderPlist } from './plist.mjs'

const TEMPLATE = `<!-- installed with __REPO__ filled in -->
<string>__REPO__/apps/node-worker</string>
<string>__NODE__</string>
<string>__USER_HOME__/Library/Logs/Splitune/node-worker.log</string>`

describe('renderPlist', () => {
  it('fills every placeholder, comments included', () => {
    const plist = renderPlist(TEMPLATE, {
      REPO: '/Users/me/Splitune',
      NODE: '/usr/local/bin/node',
      USER_HOME: '/Users/me',
    })
    expect(plist).not.toMatch(/__[A-Z_]+__/)
    expect(plist).toContain('<string>/Users/me/Splitune/apps/node-worker</string>')
    expect(plist).toContain('<string>/Users/me/Library/Logs/Splitune/node-worker.log</string>')
  })

  it('escapes paths for XML', () => {
    const plist = renderPlist('<string>__REPO__</string>', { REPO: '/Users/me/R&D <music>' })
    expect(plist).toBe('<string>/Users/me/R&amp;D &lt;music&gt;</string>')
  })

  it('refuses a template with a placeholder it was not given', () => {
    expect(() => renderPlist(TEMPLATE, { REPO: '/r', USER_HOME: '/h' })).toThrow('__NODE__')
  })
})
