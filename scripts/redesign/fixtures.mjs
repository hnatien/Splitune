// Self-check fixtures for shim.js (render-mockups.mjs --check), served from memory under /t/.
// NEGATIVE: each must fail with an error containing `expect`. POSITIVE: each must render without
// errors and match `checks` exactly: [selector, 'outerHTML' | 'innerHTML' | 'exists' | 'absent',
// expected]. Together they pin the shim's semantics, not only "no errors".

const LOOK_PROPS =
  '{"look":{"editor":"enum","options":["Night Rehearsal","Daylight"],"default":"Night Rehearsal"},"$preview":{"width":390,"height":200}}'

function fixture(body, vals = '{}', props = '{"$preview":{"width":390,"height":200}}') {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>fixture</title>
<script src="./support.js"></script><link rel="stylesheet" href="splitune.css"></head><body>
<x-dc><helmet><style id="helmet-style">body{margin:0}</style></helmet>${body}</x-dc>
<script type="text/x-dc" data-dc-script data-props='${props}'>
class Component extends DCLogic { renderVals() { return ${vals} } }
</script></body></html>`
}

export const NEGATIVE = {
  'unknown-tag.dc.html': {
    html: fixture('<div class="app"><sc-each><i>{{label}}</i></sc-each></div>', '{ label: "x" }'),
    expect: 'unknown tag <sc-each>',
  },
  'unresolved-hole.dc.html': {
    html: fixture('<div class="app" style="width: {{w}}px">{{label}}</div>', '{ label: "x" }'),
    expect: 'unresolved hole {{w}}',
  },
  'unresolved-item-hole.dc.html': {
    html: fixture(
      '<ul class="app"><sc-for list="{{rows}}" as="r"><li>{{r.nope}}</li></sc-for></ul>',
      '{ rows: [{ name: "a" }] }',
    ),
    expect: 'unresolved hole {{r.nope}}',
  },
  'unknown-look.dc.html': {
    html: fixture('<div class="app">x</div>'),
    look: 'daylight',
    expect: 'no look prop',
  },
}

const lookFixture = fixture(
  '<div class="{{cls}}" data-theme="{{theme}}" id="r">{{label}}</div>',
  "{ cls: 'app', theme: this.props.look === 'Daylight' ? 'light' : 'dark', label: this.props.look }",
  LOOK_PROPS,
)

export const POSITIVE = {
  // sc-if keeps truthy branches (true, a number) and drops falsy ones (false, a literal, 0), and
  // unwraps; helmet content lands in <head>; no canvas element survives.
  'sc-if.dc.html': {
    html: fixture(
      '<div class="app" id="r"><sc-if value="{{yes}}"><b id="y">{{label}}</b></sc-if><sc-if value="{{no}}"><b id="n">no</b></sc-if><sc-if value="{{false}}"><b id="lf">no</b></sc-if><sc-if value="{{count}}"><i id="c">{{count}}</i></sc-if><sc-if value="{{zero}}"><i id="z">0</i></sc-if></div>',
      "{ yes: true, no: false, label: 'shown', count: 2, zero: 0 }",
    ),
    checks: [
      ['#r', 'innerHTML', '<b id="y">shown</b><i id="c">2</i>'],
      ['head > #helmet-style', 'exists'],
      ['x-dc, helmet, sc-if, sc-for, script[type="text/x-dc"]', 'absent'],
    ],
  },
  // sc-for repeats per item; an inner `as` shadows the outer name and the outer one is back after
  // the inner loop; renderVals() names stay visible inside loops; an empty list renders nothing.
  'sc-for.dc.html': {
    html: fixture(
      '<ul class="app" id="r"><sc-for list="{{rows}}" as="r"><li class="row {{r.cls}}" data-n="{{r.name}}"><sc-for list="{{r.items}}" as="r"><span>{{r.v}}</span></sc-for><em>{{r.name}}</em><u>{{top}}</u></li></sc-for></ul>',
      "{ top: 'T', rows: [{ name: 'a', cls: 'x', items: [{ v: 1 }, { v: 2 }] }, { name: 'b', cls: 'y', items: [] }] }",
    ),
    checks: [
      [
        '#r',
        'innerHTML',
        '<li class="row x" data-n="a"><span>1</span><span>2</span><em>a</em><u>T</u></li><li class="row y" data-n="b"><em>b</em><u>T</u></li>',
      ],
    ],
  },
  // Attribute holes: booleans become "true"/"false", numbers and nested paths fill in, handlers are
  // removed; SVG attribute holes work.
  'attributes.dc.html': {
    html: fixture(
      '<div class="app"><button id="b" type="button" aria-pressed="{{on}}" aria-checked="{{off}}" onClick="{{fn}}" style="width: {{w}}px" title="{{meta.a.b}}">{{n}}</button><svg viewBox="0 0 10 10"><rect id="s" x="{{w}}" width="{{w}}" height="1"/></svg></div>',
      "{ on: true, off: false, fn: () => {}, w: 3, n: 0, meta: { a: { b: 'deep' } } }",
    ),
    checks: [
      [
        '#b',
        'outerHTML',
        '<button id="b" type="button" aria-pressed="true" aria-checked="false" style="width: 3px" title="deep">0</button>',
      ],
      ['#s', 'outerHTML', '<rect id="s" x="3" width="3" height="1"></rect>'],
    ],
  },
  // The look prop: its default without ?look=, the requested option with it.
  'look-night.dc.html': {
    html: lookFixture,
    checks: [
      ['#r', 'outerHTML', '<div class="app" data-theme="dark" id="r">Night Rehearsal</div>'],
    ],
  },
  'look-daylight.dc.html': {
    html: lookFixture,
    look: 'daylight',
    checks: [['#r', 'outerHTML', '<div class="app" data-theme="light" id="r">Daylight</div>']],
  },
}

// Runs in the page: the failed checks, as messages.
export function runChecks(checks) {
  return checks.flatMap(([selector, kind, expected]) => {
    const el = document.querySelector(selector)
    if (kind === 'absent') return el ? [`${selector} should be absent`] : []
    if (!el) return [`${selector} is missing`]
    if (kind === 'exists') return []
    const actual = el[kind]
    return actual === expected
      ? []
      : [`${selector} ${kind}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`]
  })
}
