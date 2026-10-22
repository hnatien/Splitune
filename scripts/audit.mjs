// `pnpm audit:deps` (17-security.md §7, CI): npm advisories through `pnpm audit`, failing on
// critical ones; Python through pip-audit over the ML workspace and both islands' locked
// dependencies, failing on anything not accepted in audit/findings.mjs.
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ACCEPTED, unaccepted } from './audit/findings.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const ML = join(root, 'services/ml')
const PIP_AUDIT = 'pip-audit==2.10.1'
const PROJECTS = ['.', 'islands/torch', 'islands/onnx-cpu']

let failed = false

const npm = spawnSync('pnpm', ['audit', '--audit-level', 'critical'], {
  cwd: root,
  stdio: 'inherit',
})
if (npm.status !== 0) failed = true

const dir = mkdtempSync(join(tmpdir(), 'splitune-audit-'))
try {
  for (const project of PROJECTS) {
    const requirements = join(dir, `${project.replaceAll('/', '-')}.txt`)
    const report = join(dir, `${project.replaceAll('/', '-')}.json`)
    execFileSync(
      'uv',
      [
        'export',
        '--frozen',
        '--no-hashes',
        '--no-emit-workspace',
        '--project',
        project,
        '-o',
        requirements,
      ],
      { cwd: ML, stdio: 'ignore' },
    )
    // Exit status 1 only means "vulnerabilities found"; the JSON decides.
    spawnSync(
      'uvx',
      [
        '--quiet',
        PIP_AUDIT,
        '--disable-pip',
        '--no-deps',
        '-r',
        requirements,
        '-f',
        'json',
        '-o',
        report,
      ],
      { cwd: ML, stdio: ['ignore', 'ignore', 'inherit'] },
    )
    const parsed = JSON.parse(readFileSync(report, 'utf8'))
    const open = unaccepted(parsed)
    const accepted = parsed.dependencies.filter((d) => `${d.name}@${d.version}` in ACCEPTED)
    console.log(
      `pip-audit ${project}: ${parsed.dependencies.length} packages, ${open.length} open` +
        (accepted.length
          ? ` (accepted: ${accepted.map((d) => `${d.name}@${d.version} ×${d.vulns.length}`).join(', ')})`
          : ''),
    )
    for (const finding of open) {
      console.log(`  ${finding.package} ${finding.id} fixed in ${finding.fix.join(', ') || '—'}`)
    }
    if (open.length > 0) failed = true
  }
} finally {
  rmSync(dir, { recursive: true, force: true })
}

process.exit(failed ? 1 : 0)
