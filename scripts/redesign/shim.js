// Static stand-in for the Design-canvas runtime that redesign/mockups/*.dc.html expect as
// ./support.js. scripts/redesign/harness.mjs serves it under that name; it never runs in the app.
// On DOMContentLoaded it evaluates the file's `class Component extends DCLogic` script, calls
// renderVals() once with the props (each prop's default, `look` overridable by ?look=…), moves
// <helmet> children into <head> and replaces <x-dc> with the expanded template: <sc-for list as>
// repeats its children per item, <sc-if value> keeps them when truthy (both unwrap, so `.wave > i`
// selectors still match), {{a.b}} holes fill text and attributes, and on* handler holes are
// dropped (a static render has no events). Anything else fails loudly: the outcome is in
// window.__dc = { done, ok, errors, … } and the harness exits non-zero on any error.
;(() => {
  const result = {
    done: false,
    ok: false,
    errors: [],
    props: null,
    holes: 0,
    removedHandlers: [],
  }
  window.__dc = result

  const fail = (message) => {
    throw new Error(message)
  }
  const HOLE = /\{\{\s*([^{}]*?)\s*\}\}/g
  const PATH = /^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*$/
  const SC_ATTRS = {
    'sc-for': ['list', 'as', 'hint-placeholder-count'],
    'sc-if': ['value', 'hint-placeholder-val'],
  }

  class DCLogic {
    constructor(props) {
      this.props = props
      this.state = {}
    }
    setState(patch) {
      Object.assign(this.state, typeof patch === 'function' ? patch(this.state) : patch)
    }
  }

  const describe = (node) => {
    const parts = []
    for (let el = node; el && el.nodeType === Node.ELEMENT_NODE; el = el.parentElement) {
      const cls = el.getAttribute('class')
      parts.unshift(
        cls && !cls.includes('{{') ? `${el.localName}.${cls.split(/\s+/)[0]}` : el.localName,
      )
      if (el.localName === 'x-dc') break
    }
    return parts.join(' > ')
  }

  // A hole is a literal (true, false, null, a number) or a dotted path looked up from the innermost
  // sc-for scope out to renderVals(). A missing segment is an error, never an empty string.
  const evaluate = (expr, scopes, where) => {
    result.holes += 1
    if (expr === 'true') return true
    if (expr === 'false') return false
    if (expr === 'null') return null
    if (/^-?\d+(?:\.\d+)?$/.test(expr)) return Number(expr)
    if (!PATH.test(expr)) fail(`unsupported hole expression {{${expr}}} at ${where}`)
    const [head, ...rest] = expr.split('.')
    const scope = [...scopes].reverse().find((s) => Object.hasOwn(s, head))
    if (!scope) fail(`unresolved hole {{${expr}}} at ${where}`)
    let value = scope[head]
    for (const key of rest) {
      if (value === null || value === undefined || !Object.hasOwn(Object(value), key)) {
        fail(`unresolved hole {{${expr}}} at ${where}`)
      }
      value = value[key]
    }
    if (value === undefined) fail(`unresolved hole {{${expr}}} at ${where} (undefined)`)
    return value
  }

  const whole = (raw, scopes, where) => {
    const match = /^\{\{\s*([^{}]*?)\s*\}\}$/.exec(raw ?? '')
    if (!match) fail(`expected exactly one {{hole}}, got "${raw}" at ${where}`)
    return evaluate(match[1], scopes, where)
  }

  const fill = (text, scopes, where, inAttribute) =>
    text.replace(HOLE, (_, expr) => {
      const value = evaluate(expr, scopes, where)
      if (typeof value === 'string' || typeof value === 'number') return String(value)
      if (typeof value === 'boolean' && inAttribute) return String(value)
      fail(`hole {{${expr}}} is ${value === null ? 'null' : typeof value} at ${where}`)
    })

  const checkAttributes = (el, allowed, where) => {
    for (const { name } of el.attributes) {
      if (!allowed.includes(name))
        fail(`unknown attribute ${name} on <${el.localName}> at ${where}`)
    }
  }

  const expandChildren = (parent, scopes) => {
    const out = []
    for (const child of parent.childNodes) out.push(...expand(child, scopes))
    return out
  }

  const expand = (node, scopes) => {
    if (node.nodeType === Node.TEXT_NODE) {
      return [document.createTextNode(fill(node.data, scopes, describe(node.parentElement), false))]
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return []
    const where = describe(node)
    const tag = node.localName
    if (tag === 'sc-for') {
      checkAttributes(node, SC_ATTRS[tag], where)
      const list = whole(node.getAttribute('list'), scopes, where)
      const as = node.getAttribute('as') ?? ''
      if (!Array.isArray(list)) fail(`<sc-for list> is not an array at ${where}`)
      if (!/^[A-Za-z_$][\w$]*$/.test(as)) fail(`<sc-for as="${as}"> is not a name at ${where}`)
      return list.flatMap((item) => expandChildren(node, [...scopes, { [as]: item }]))
    }
    if (tag === 'sc-if') {
      checkAttributes(node, SC_ATTRS[tag], where)
      return whole(node.getAttribute('value'), scopes, where) ? expandChildren(node, scopes) : []
    }
    if (tag === 'x-dc' || tag === 'helmet') fail(`nested <${tag}> at ${where}`)
    const el = node.cloneNode(false)
    for (const { name, value } of [...node.attributes]) {
      if (name.startsWith('hint-')) fail(`${name} outside <sc-for>/<sc-if> at ${where}`)
      if (!value.includes('{{')) continue
      if (/^on[a-z]+$/.test(name)) {
        if (typeof whole(value, scopes, where) !== 'function') {
          fail(`${name}="${value}" is not a function at ${where}`)
        }
        el.removeAttribute(name)
        result.removedHandlers.push(`${name} at ${where}`)
        continue
      }
      el.setAttribute(name, fill(value, scopes, `${where} [${name}]`, true))
    }
    for (const child of expandChildren(node, scopes)) el.append(child)
    return [el]
  }

  // After expansion every element must be a known HTML or SVG element and no {{ may remain.
  const validate = () => {
    const walker = document.createTreeWalker(document.documentElement, NodeFilter.SHOW_ALL)
    for (let node = walker.currentNode; node; node = walker.nextNode()) {
      if (node.nodeType === Node.TEXT_NODE && node.data.includes('{{')) {
        result.errors.push(`unresolved {{ in text at ${describe(node.parentElement)}`)
      }
      if (node.nodeType !== Node.ELEMENT_NODE) continue
      const unknownHtml = node instanceof HTMLUnknownElement || node.localName.includes('-')
      const unknownSvg = Object.getPrototypeOf(node) === SVGElement.prototype
      if (unknownHtml || unknownSvg) {
        result.errors.push(`unknown tag <${node.localName}> at ${describe(node)}`)
      }
      for (const { name, value } of node.attributes) {
        if (value.includes('{{'))
          result.errors.push(`unresolved {{ in ${name} at ${describe(node)}`)
      }
    }
  }

  const props = (script) => {
    const defs = JSON.parse(script.dataset.props || '{}')
    const values = {}
    for (const [name, def] of Object.entries(defs)) {
      if (name.startsWith('$')) continue
      if (def.editor !== 'enum' || !Array.isArray(def.options) || !('default' in def)) {
        fail(`unsupported prop ${name}: ${JSON.stringify(def)}`)
      }
      values[name] = def.default
    }
    const params = new URLSearchParams(location.search)
    for (const [name, value] of params) {
      if (name !== 'look') fail(`unknown query parameter ${name}`)
      if (!defs.look) fail('?look= given but this board has no look prop')
      if (!defs.look.options.includes(value)) fail(`unknown look "${value}"`)
      values.look = value
    }
    return values
  }

  const render = () => {
    const hosts = document.querySelectorAll('x-dc')
    const scripts = document.querySelectorAll('script[type="text/x-dc"]')
    if (hosts.length !== 1) fail(`expected one <x-dc>, found ${hosts.length}`)
    if (scripts.length !== 1)
      fail(`expected one <script type="text/x-dc">, found ${scripts.length}`)
    const [host] = hosts
    const [script] = scripts
    result.props = props(script)
    const Component = new Function('DCLogic', `${script.textContent}\nreturn Component`)(DCLogic)
    const vals = new Component(result.props).renderVals()
    if (!vals || typeof vals !== 'object' || Array.isArray(vals)) {
      fail('renderVals() did not return an object')
    }
    for (const helmet of host.querySelectorAll('helmet')) {
      if (helmet.parentElement !== host) fail('<helmet> must be a direct child of <x-dc>')
      document.head.append(...helmet.childNodes)
      helmet.remove()
    }
    host.replaceWith(...expandChildren(host, [vals]))
    script.remove()
  }

  document.addEventListener('DOMContentLoaded', () => {
    try {
      render()
      validate()
    } catch (error) {
      result.errors.push(error instanceof Error ? error.message : String(error))
    }
    result.ok = result.errors.length === 0
    result.done = true
  })
})()
