import assert from 'node:assert/strict'
import { describe, it } from 'bun:test'
import { compileSelector } from '@/settings/selector'
import { classified, decide } from '@tests/support/status'
import type { Exception } from 'types/settings'

const AGAINST_COVERAGE: Exception = {
  check: 'coverage',
  reason: 'Xcode owns the format and rewrites it',
  paths: compileSelector(['src/**'], 'test'),
}

describe('statusOf, under an exception', () => {
  it('excepts the path it covers, keeping the reason', () => {
    const status = decide(classified('source'), [], ['style'], [AGAINST_COVERAGE])
    assert.equal(status.status, 'excepted')
    assert.equal(status.reason, 'Xcode owns the format and rewrites it')
  })

  it('outranks every other signal, including a nature', () => {
    assert.equal(decide(classified('binary'), [], [], [AGAINST_COVERAGE]).status, 'excepted')
  })

  it('leaves a path outside its selector alone', () => {
    const elsewhere = { ...AGAINST_COVERAGE, paths: compileSelector(['other/**'], 'test') }
    assert.equal(decide(classified('source'), [], ['style'], [elsewhere]).status, 'unchecked')
  })

  it('leaves a different check alone', () => {
    const other: Exception = { check: 'ts/eslint', reason: 'unrelated' }
    assert.equal(decide(classified('source'), [], ['style'], [other]).status, 'unchecked')
  })
})
