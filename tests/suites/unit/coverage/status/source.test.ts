import assert from 'node:assert/strict'
import { describe, it } from 'bun:test'
import { claim, classified, decide, supplied } from '@tests/support/status'

describe('statusOf, over a source file', () => {
  it('covers a path whose every required inspection has a provider', () => {
    const status = decide(
      classified('source'),
      [claim('ts/eslint', ['style', 'structure']), claim('ts/tsc', ['types', 'syntax'])],
      ['style', 'structure', 'types', 'syntax'],
    )
    assert.equal(status.status, 'covered')
    assert.deepEqual(status.missing, [])
  })

  it('reports a path only suppliers claim as unchecked, however many of them read it', () => {
    const status = decide(
      classified('source'),
      [supplied('structure/trivial-function', ['structure']), supplied('structure/file-length', ['structure'])],
      ['structure'],
    )
    assert.equal(status.status, 'unchecked')
  })

  it('covers a path one owner claims alongside the suppliers', () => {
    const status = decide(
      classified('source'),
      [claim('sh/shellcheck', ['style']), supplied('structure/file-length', ['structure'])],
      ['style', 'structure'],
    )
    assert.equal(status.status, 'covered')
  })

  it('reports a path no claim reaches as unchecked, with everything it wanted', () => {
    const status = decide(classified('source'), [], ['style', 'types'])
    assert.equal(status.status, 'unchecked')
    assert.deepEqual(status.missing, ['style', 'types'])
  })

  it('names the inspections a partial path is short of', () => {
    const status = decide(
      classified('source'),
      [claim('ts/eslint', ['style'])],
      ['style', 'types', 'prose'],
    )
    assert.equal(status.status, 'partial')
    assert.deepEqual(status.missing, ['types', 'prose'])
  })

  it('reports a path only weak inspections reach as partial', () => {
    const status = decide(
      classified('source'),
      [claim('spell/typos', ['spelling']), claim('secrets/gitleaks', ['security'])],
      ['spelling', 'security'],
    )
    assert.equal(status.status, 'partial')
  })

  it('marks a claim taken from a preset assertion as unverified', () => {
    const status = decide(classified('source'), [], [])
    assert.equal(status.unverified, false)

    const asserted = decide(
      classified('source'),
      [{ check: 'sh/syntax', path: 'src/module.ts', inspects: ['syntax'], via: 'declared', supplier: false }],
      ['syntax'],
    )
    assert.equal(asserted.unverified, true)
  })
})
