// Listening test client: one task at a time, answers saved as you go, resumable.
const app = document.getElementById('app')
const KEY = 'splitune-listening-rater'
const SCORES = [
  [1, 'Unusable'],
  [2, 'Barely, with lots of distraction'],
  [3, 'Usable with some distraction'],
  [4, 'Good, small artefacts'],
  [5, 'I could practise with this as is'],
]
const WHAT = {
  isolated: (t) => `the isolated ${t} part`,
  mix_minus: (t) => `the backing track without the ${t} (play-along)`,
}
let state = { rater: null, tasks: [], question: '', index: 0 }

function storedRater() {
  try {
    return localStorage.getItem(KEY)
  } catch {
    return null
  }
}

function remember(id) {
  try {
    localStorage.setItem(KEY, id)
  } catch {
    // private mode: the rater id lives for this page only
  }
}

async function api(path, body) {
  const res = await fetch(
    path,
    body
      ? {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
        }
      : {},
  )
  if (!res.ok) throw new Error(`${path}: ${res.status}`)
  return res.json()
}

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag)
  for (const [k, v] of Object.entries(attrs)) {
    if (k.startsWith('on')) node.addEventListener(k.slice(2), v)
    else if (v !== false && v !== undefined) node.setAttribute(k, v === true ? '' : v)
  }
  node.append(...children)
  return node
}

function signup() {
  const name = el('input', { id: 'name', required: true, autocomplete: 'nickname' })
  const instrument = el('input', { id: 'instrument', required: true, placeholder: 'e.g. guitar' })
  const experience = el(
    'select',
    { id: 'experience' },
    el('option', { value: 'learner' }, 'Learner'),
    el('option', { value: 'intermediate' }, 'Intermediate player'),
    el('option', { value: 'teacher' }, 'Teacher'),
  )
  const form = el(
    'form',
    {
      onsubmit: async (event) => {
        event.preventDefault()
        const { rater } = await api('/api/raters', {
          name: name.value,
          instrument: instrument.value,
          experience: experience.value,
        })
        remember(rater)
        await start(rater)
      },
    },
    el('label', { for: 'name' }, 'Name or nickname'),
    name,
    el('label', { for: 'instrument' }, 'Main instrument'),
    instrument,
    el('label', { for: 'experience' }, 'Experience'),
    experience,
    el('p', {}, el('button', { class: 'primary', type: 'submit' }, 'Start')),
  )
  app.replaceChildren(form)
  name.focus()
}

async function start(rater) {
  const data = await api(`/api/tasks?rater=${encodeURIComponent(rater)}`)
  state = {
    rater,
    tasks: data.tasks,
    question: data.question,
    index: Math.max(
      0,
      data.tasks.findIndex((t) => t.answer === null),
    ),
  }
  if (data.tasks.every((t) => t.answer !== null)) state.index = data.tasks.length
  render()
}

function player(token, label) {
  return el(
    'div',
    {},
    el('span', {}, label),
    el('audio', { controls: true, preload: 'none', src: `/media/${token}` }),
  )
}

async function answer(value) {
  const task = state.tasks[state.index]
  if (task.type === 'rate')
    await api('/api/ratings', { rater: state.rater, item: task.id, score: value })
  else await api('/api/preferences', { rater: state.rater, pair: task.id, choice: value })
  task.answer = value
  state.index += 1
  render()
}

function render() {
  for (const audio of document.querySelectorAll('audio')) audio.pause()
  const total = state.tasks.length
  if (state.index >= total) {
    app.replaceChildren(
      el('p', {}, `All ${total} tasks answered. Thank you! You can go back to change an answer.`),
      nav(),
    )
    return
  }
  const task = state.tasks[state.index]
  const head = el(
    'div',
    {},
    el('progress', { max: total, value: state.index, 'aria-label': 'Progress' }),
    el('p', { class: 'muted' }, `Task ${state.index + 1} of ${total}`),
  )
  const reference = el(
    'details',
    {},
    el('summary', {}, 'Original mix (reference)'),
    player(task.mixture, ''),
  )
  let body
  if (task.type === 'rate') {
    body = el(
      'fieldset',
      {},
      el('legend', {}, `${state.question} Listening to ${WHAT[task.kind](task.target)}.`),
      player(task.id, 'Clip'),
      ...SCORES.map(([score, text]) =>
        el(
          'label',
          {},
          el('input', {
            type: 'radio',
            name: 'score',
            value: score,
            checked: task.answer === score,
            onchange: () => answer(score),
          }),
          ` ${score}: ${text}`,
        ),
      ),
      el(
        'p',
        { class: 'muted' },
        'Keys: ',
        el('kbd', {}, '1'),
        '–',
        el('kbd', {}, '5'),
        ' rate, ',
        el('kbd', {}, '←'),
        el('kbd', {}, '→'),
        ' move',
      ),
    )
  } else {
    body = el(
      'fieldset',
      {},
      el(
        'legend',
        {},
        `Which version of ${WHAT[task.kind](task.target)} would you rather practise with?`,
      ),
      el('div', { class: 'side' }, player(task.a, 'Version A')),
      el('div', { class: 'side' }, player(task.b, 'Version B')),
      el(
        'div',
        { class: 'row' },
        ...[
          ['a', 'A is better'],
          ['b', 'B is better'],
          ['none', 'No preference'],
        ].map(([value, text]) =>
          el(
            'button',
            {
              type: 'button',
              'aria-pressed': String(task.answer === value),
              onclick: () => answer(value),
            },
            text,
          ),
        ),
      ),
      el(
        'p',
        { class: 'muted' },
        'Keys: ',
        el('kbd', {}, 'A'),
        ' ',
        el('kbd', {}, 'B'),
        ' ',
        el('kbd', {}, 'N'),
        ' choose, ',
        el('kbd', {}, '←'),
        el('kbd', {}, '→'),
        ' move',
      ),
    )
  }
  app.replaceChildren(head, body, reference, nav())
}

function nav() {
  return el(
    'div',
    { class: 'row' },
    el(
      'button',
      { type: 'button', onclick: () => move(-1), disabled: state.index === 0 },
      'Previous',
    ),
    el(
      'button',
      { type: 'button', onclick: () => move(1), disabled: state.index >= state.tasks.length },
      'Skip',
    ),
  )
}

function move(delta) {
  state.index = Math.min(state.tasks.length, Math.max(0, state.index + delta))
  render()
}

document.addEventListener('keydown', (event) => {
  if (!state.rater || event.target instanceof HTMLInputElement || event.metaKey || event.ctrlKey)
    return
  const task = state.tasks[state.index]
  const key = event.key.toLowerCase()
  if (event.key === 'ArrowLeft') move(-1)
  else if (event.key === 'ArrowRight') move(1)
  else if (task?.type === 'rate' && /^[1-5]$/.test(key)) answer(Number(key))
  else if (task?.type === 'compare' && ['a', 'b', 'n'].includes(key))
    answer({ a: 'a', b: 'b', n: 'none' }[key])
})

const known = storedRater()
if (known) start(known).catch(signup)
else signup()
