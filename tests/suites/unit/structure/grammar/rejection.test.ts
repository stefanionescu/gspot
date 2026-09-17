import assert from 'node:assert/strict'
import { describe, it } from 'bun:test'
import { PARSEABLE_SHELL, UNPARSEABLE_SHELL } from '@config/tests/sources'
import { describeParseFailure, parseSource, registerGrammars } from '@/structure/grammar'

await registerGrammars()

describe('parseSource', () => {
  it('rejects source holding a node the grammar could not read', () => {
    const parsed = parseSource('ops/deploy', 'bash', UNPARSEABLE_SHELL)
    assert.equal(parsed.outcome, 'broken')
  })

  it('reads the same script once the construct is written so the grammar can read it', () => {
    assert.equal(parseSource('ops/deploy', 'bash', PARSEABLE_SHELL).outcome, 'read')
  })

  it('reads an empty file, which is the one input an empty result is the right answer for', () => {
    assert.equal(parseSource('src/empty.ts', 'TypeScript', '').outcome, 'read')
  })

  it('names the path, the position and the source either side of the fault', () => {
    const parsed = parseSource('ops/deploy', 'bash', UNPARSEABLE_SHELL)
    if (parsed.outcome !== 'broken') throw new Error('expected a broken parse')
    assert.equal(parsed.broken.path, 'ops/deploy')
    assert.equal(parsed.broken.kind, 'ERROR')
    assert.ok(parsed.broken.at.line >= 1 && parsed.broken.at.column >= 1)
    assert.match(describeParseFailure(parsed.broken), /the grammar could not read this source/u)
  })
})
