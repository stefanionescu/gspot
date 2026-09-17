import assert from 'node:assert/strict'
import { describe, it } from 'bun:test'
import { judgeBaseline } from '@/run/baseline'
import type { Baseline } from 'types/run'

const BASELINE: Baseline = {
  check: 'ts/eslint',
  rule: 'vitest/expect-expect',
  count: 100,
  adopted: '2026-09-16',
  paths: { 'tests/turn.test.ts': 7, 'tests/web.test.ts': 3 },
}

describe('judgeBaseline', () => {
  it('passes at the recorded count and below it, reporting the lower number', () => {
    assert.equal(judgeBaseline(BASELINE, 100, {}).exceeded, false)
    const lower = judgeBaseline(BASELINE, 94, {})
    assert.equal(lower.exceeded, false)
    assert.equal(lower.count, 94)
  })

  it('fails above it', () => {
    assert.equal(judgeBaseline(BASELINE, 101, {}).exceeded, true)
  })

  it('fails a file that grew its own count while the total held', () => {
    const verdict = judgeBaseline(BASELINE, 100, { 'tests/turn.test.ts': 9 })
    assert.equal(verdict.exceeded, true)
    assert.deepEqual(verdict.grew, ['tests/turn.test.ts'])
  })

  it('fails a file that is new to the backlog', () => {
    assert.deepEqual(judgeBaseline(BASELINE, 100, { 'tests/fresh.test.ts': 1 }).grew, [
      'tests/fresh.test.ts',
    ])
  })

  it('passes a file that shrank', () => {
    assert.equal(judgeBaseline(BASELINE, 96, { 'tests/turn.test.ts': 3 }).exceeded, false)
  })
})
