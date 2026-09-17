import assert from 'node:assert/strict'
import { describe, it } from 'bun:test'
import { slugOf, staleEntries } from '@/run/baseline'
import type { Baseline } from 'types/run'

const BASELINE: Baseline = {
  check: 'ts/eslint',
  rule: 'vitest/expect-expect',
  count: 100,
  adopted: '2026-09-16',
  paths: { 'tests/turn.test.ts': 7, 'tests/web.test.ts': 3 },
}

describe('staleEntries', () => {
  it('reports a recorded path the repository no longer tracks', () => {
    assert.deepEqual(staleEntries(BASELINE, new Set(['tests/turn.test.ts'])), ['tests/web.test.ts'])
  })

  it('reports nothing when every recorded path is still there', () => {
    const tracked = new Set(['tests/turn.test.ts', 'tests/web.test.ts'])
    assert.deepEqual(staleEntries(BASELINE, tracked), [])
  })
})

describe('slugOf', () => {
  it('keeps the namespace separate from the rule, so two rules never share a file', () => {
    assert.equal(slugOf('vitest/expect-expect'), 'vitest__expect-expect')
    assert.notEqual(slugOf('a/b-c'), slugOf('a-b/c'))
  })

  it('reduces a rule id to characters a file name takes', () => {
    assert.equal(slugOf('@typescript-eslint/no-explicit-any'), 'typescript-eslint__no-explicit-any')
  })
})
