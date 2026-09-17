import assert from 'node:assert/strict'
import { describe, it } from 'bun:test'
import { verdictOf } from '@/run/verdict'
import { NOTHING_HELD, ran, skipped } from '@tests/support/verdict'

describe('verdictOf, over what the checks reported', () => {
  it('passes when no condition holds', () => {
    assert.equal(verdictOf(NOTHING_HELD).passed, true)
  })

  it('fails on findings, naming the check', () => {
    const verdict = verdictOf({ ...NOTHING_HELD, results: [ran('sh/shellcheck', 3)] })
    assert.equal(verdict.passed, false)
    assert.deepEqual(verdict.failing, ['sh/shellcheck'])
  })

  it('fails on a skip that is not the platform, naming the reason', () => {
    const verdict = verdictOf({ ...NOTHING_HELD, results: [skipped('docker/nginx', false)] })
    assert.equal(verdict.passed, false)
    assert.match(verdict.reasons.join('\n'), /docker daemon unavailable/u)
  })

  it('passes a skip the platform forced', () => {
    assert.equal(verdictOf({ ...NOTHING_HELD, results: [skipped('py/types-trt', true)] }).passed, true)
  })
})
