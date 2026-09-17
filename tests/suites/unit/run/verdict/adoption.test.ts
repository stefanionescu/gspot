import assert from 'node:assert/strict'
import { describe, it } from 'bun:test'
import { verdictOf } from '@/run/verdict'
import { NOTHING_HELD, ran } from '@tests/support/verdict'

describe('verdictOf, over the baselines', () => {
  it('fails on a baseline that was exceeded, naming both counts', () => {
    const verdict = verdictOf({
      ...NOTHING_HELD,
      baselines: [{ rule: 'ts/eslint', baseline: 100, count: 104, grew: [], exceeded: true }],
    })
    assert.match(verdict.reasons.join('\n'), /ts\/eslint is at 104 against a baseline of 100/u)
  })

  it('holds a check whose findings sit inside its baseline', () => {
    const verdict = verdictOf({
      ...NOTHING_HELD,
      results: [ran('ts/eslint', 98)],
      baselines: [{ rule: 'ts/eslint', baseline: 100, count: 98, grew: [], exceeded: false }],
    })
    assert.equal(verdict.passed, true)
  })
})

describe('verdictOf, over the suppressions', () => {
  it('fails on a suppression with no reason', () => {
    const verdict = verdictOf({
      ...NOTHING_HELD,
      suppressions: [
        {
          form: 'swiftlint:disable',
          path: 'Feed.swift',
          line: 42,
          text: '// swiftlint:disable redundant_self',
          reason: null,
          owned: false,
        },
      ],
    })
    assert.match(verdict.reasons.join('\n'), /1 suppression\(s\) carry no reason/u)
  })
})

describe('verdictOf, over the tool lock', () => {
  it('fails on a tool the lock names that is not here', () => {
    const verdict = verdictOf({ ...NOTHING_HELD, tools: [{ tool: 'shellcheck', why: 'missing' }] })
    assert.match(verdict.reasons.join('\n'), /shellcheck is in tools\.lock and is not installed/u)
  })

  it('fails on a checksum that does not match', () => {
    const verdict = verdictOf({ ...NOTHING_HELD, tools: [{ tool: 'typos', why: 'checksum' }] })
    assert.match(verdict.reasons.join('\n'), /does not match the checksum/u)
  })
})
