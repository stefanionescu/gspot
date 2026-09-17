import assert from 'node:assert/strict'
import { afterAll, beforeAll, describe, it } from 'bun:test'
import { CALL_THROUGHS } from '@config/tests/sources'
import { runBuiltin } from '@/structure/builtin'
import { removeRepository, plant } from '@tests/support/repository'
import type { StructureOutcome } from 'types/structure'

describe('the call-through builtin', () => {
  let root = ''
  let outcome: StructureOutcome

  beforeAll(async () => {
    root = await plant('call-through', CALL_THROUGHS)
    outcome = await runBuiltin('call-through', {
      root,
      paths: Object.keys(CALL_THROUGHS),
      rule: 'structure/call-through',
      limit: Number.POSITIVE_INFINITY,
      setting: '',
      entryPoints: [],
    })
  })

  afterAll(async () => {
    await removeRepository(root)
  })

  function found(path: string): readonly string[] {
    return outcome.findings.filter((finding) => finding.path === path).map((finding) => finding.symbol ?? '')
  }

  it('reads a typed parameter list, which is the case a rule file cannot', () => {
    assert.deepEqual(found('src/wrap.ts'), ['passes'])
  })

  it('reads a Python annotation and a default, and leaves a reordering', () => {
    assert.deepEqual(found('src/wrap.py'), ['passes', 'typed'])
  })

  it('reads a Swift argument label, where the outer name is not the inner one', () => {
    assert.deepEqual(found('src/wrap.swift'), ['passes', 'labelled'])
  })
})
