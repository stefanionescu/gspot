import assert from 'node:assert/strict'
import { describe, it } from 'bun:test'
import { claim, classified, decide } from '@tests/support/status'

describe('statusOf, over a path nobody here edits', () => {
  it('takes the status from the nature rather than from what claims it', () => {
    assert.equal(decide(classified('vendored'), [], []).status, 'vendored')
    assert.equal(decide(classified('generated'), [], []).status, 'generated')
    assert.equal(decide(classified('frozen'), [], []).status, 'frozen')
    assert.equal(decide(classified('binary'), [], []).status, 'binary')
  })

  it('reports the inspections the nature wants and does not have', () => {
    const generated = decide(classified('generated'), [claim('secrets/gitleaks', ['security'])], [])
    assert.deepEqual(generated.missing, ['freshness'])
  })

  it('reports nothing missing once the nature is satisfied', () => {
    const vendored = decide(
      classified('vendored'),
      [claim('secrets/gitleaks', ['security']), claim('deps/osv', ['dependencies'])],
      [],
    )
    assert.deepEqual(vendored.missing, [])
  })

  it('carries the reason from the declaration into the report', () => {
    const status = decide(classified('vendored', { reason: 'Upstream, patched by rebase' }), [], [])
    assert.equal(status.reason, 'Upstream, patched by rebase')
  })
})
