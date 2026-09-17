import assert from 'node:assert/strict'
import { describe, it } from 'bun:test'
import { verdictOf } from '@/run/verdict'
import { NOTHING_HELD } from '@tests/support/verdict'

describe('verdictOf, over the coverage table', () => {
  it('fails on each failing status, naming it', () => {
    const verdict = verdictOf({ ...NOTHING_HELD, coverage: { unchecked: 2, partial: 1, orphan: 3 } })
    const reasons = verdict.reasons.join('\n')
    assert.match(reasons, /2 path\(s\) no check reads/u)
    assert.match(reasons, /1 path\(s\) covered only in part/u)
    assert.match(reasons, /3 generated file\(s\) nothing reads/u)
  })
})

describe('verdictOf, over the drift check', () => {
  it('fails on a hand-edited generated file', () => {
    const verdict = verdictOf({
      ...NOTHING_HELD,
      drift: [{ kind: 'edited', path: '.gspot/generated/ruff.toml', message: 'was edited' }],
    })
    assert.match(verdict.reasons.join('\n'), /1 generated file\(s\) differ/u)
  })

  it('fails on a glob that matches nothing', () => {
    const verdict = verdictOf({
      ...NOTHING_HELD,
      drift: [{ kind: 'empty-glob', path: 'eslint', message: 'matches nothing' }],
    })
    assert.match(verdict.reasons.join('\n'), /1 glob\(s\) match nothing/u)
  })
})
