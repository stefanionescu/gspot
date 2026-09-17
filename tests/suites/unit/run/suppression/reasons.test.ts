import assert from 'node:assert/strict'
import { describe, it } from 'bun:test'
import { findSuppressions, unreasoned } from '@/run/suppression'

describe('findSuppressions, reading the reason', () => {
  it('reads the reason out of the one accepted shape', () => {
    const found = findSuppressions('a.sh', '# shellcheck disable=SC2086  reason: The split is wanted.')
    assert.equal(found[0]?.reason, 'The split is wanted.')
  })

  it('reports no reason when the line carries none', () => {
    assert.equal(findSuppressions('a.sh', '# shellcheck disable=SC2086')[0]?.reason, null)
  })

  it('does not read a ticket or an owner as a reason', () => {
    const found = findSuppressions('a.sh', '# shellcheck disable=SC2086  ticket: ABC-1  owner: me')
    assert.equal(found[0]?.reason, null)
  })
})

describe('unreasoned', () => {
  it('reports a form whose tool demands nothing and that carries no reason', () => {
    const found = findSuppressions('a.swift', '// swiftlint:disable redundant_self')
    assert.deepEqual(unreasoned(found).map((entry) => entry.form), ['swiftlint:disable'])
  })

  it('stays quiet about a form its own tool already polices', () => {
    assert.deepEqual(unreasoned(findSuppressions('a.ts', '// eslint-disable-next-line no-eval')), [])
  })

  it('stays quiet once a reason is there', () => {
    const found = findSuppressions('a.swift', '// swiftlint:disable redundant_self  reason: Generated.')
    assert.deepEqual(unreasoned(found), [])
  })
})
