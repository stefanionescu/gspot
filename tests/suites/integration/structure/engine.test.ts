import assert from 'node:assert/strict'
import { afterAll, beforeAll, describe, it } from 'bun:test'
import {
  PARSEABLE_SHELL,
  SHELL_WRAPPER_RULE,
  TRIVIAL_FUNCTION_RULE,
  UNPARSEABLE_SHELL,
  WRAPPERS_AND_WORK,
} from '@config/tests/sources'
import { runStructure } from '@/structure/engine'
import { parseRule } from '@/structure/rules'
import { removeRepository, plant } from '@tests/support/repository'
import type { StructureOutcome } from 'types/structure'

const RULES = [
  parseRule(TRIVIAL_FUNCTION_RULE, 'trivial.yml'),
  parseRule(SHELL_WRAPPER_RULE, 'shell.yml'),
]

const TREE = {
  'src/wrappers.ts': WRAPPERS_AND_WORK,
  'ops/deploy': PARSEABLE_SHELL,
  'ops/release': UNPARSEABLE_SHELL,
  'docs/guide.md': '# Guide\n',
}

describe('runStructure', () => {
  let root = ''
  let outcome: StructureOutcome

  beforeAll(async () => {
    root = await plant('structure', TREE)
    outcome = await runStructure({ root, paths: Object.keys(TREE), rules: RULES })
  })

  afterAll(async () => {
    await removeRepository(root)
  })

  it('reports the two functions that only forward and leaves the two that do work', () => {
    const lines = outcome.findings.filter((finding) => finding.path === 'src/wrappers.ts')
    assert.deepEqual(lines.map((finding) => finding.at.line), [4, 9])
  })

  it('claims a file with no extension by the interpreter its first line names', () => {
    const found = outcome.findings.find((finding) => finding.path === 'ops/deploy')
    assert.equal(found?.at.line, 6)
  })

  it('reads a path under whichever rule names its grammar, and skips one no rule reads', () => {
    assert.deepEqual([...outcome.read].sort(), ['ops/deploy', 'src/wrappers.ts'])
  })

  it('reports the file the grammar could not read, whose wrapper it would otherwise have missed', () => {
    assert.deepEqual(outcome.broken.map((broken) => broken.path), ['ops/release'])
    assert.equal(outcome.findings.some((finding) => finding.path === 'ops/release'), false)
  })
})
