// Python advisories accepted after review (17-security.md §7), per exact package version: a new
// pin is audited again. Everything else pip-audit reports fails `pnpm audit:deps`.
export const ACCEPTED = {
  'transformers@4.45.1': [
    'Only the optional yourmt3 extra (stage_notes, a P2 evaluation candidate) imports it; the',
    'production notes config uses basic_pitch for every instrument. The advisories concern',
    'loading untrusted checkpoints/tokenizers and tokenizer ReDoS; the worker loads only pinned,',
    "hash-checked weights and never user-supplied models. YourMT3's code needs 4.45 internals.",
  ].join(' '),
}

/** pip-audit's JSON report → the vulnerabilities not accepted above. */
export function unaccepted(report) {
  return report.dependencies.flatMap((dependency) =>
    `${dependency.name}@${dependency.version}` in ACCEPTED
      ? []
      : (dependency.vulns ?? []).map((vuln) => ({
          package: `${dependency.name}@${dependency.version}`,
          id: vuln.id,
          fix: vuln.fix_versions ?? [],
        })),
  )
}
