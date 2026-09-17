import assert from 'node:assert/strict'
import { afterAll, beforeAll, describe, it } from 'bun:test'
import { settingsFor } from '@config/tests/repositories'
import { WRAPPERS_AND_WORK } from '@config/tests/sources'
import { runChecks } from '@/commands/check'
import { removeRepository, plant, PRESETS } from '@tests/support/repository'
import type { CheckOutcome } from 'types/commands'

const TREE = {
  'gspot.toml': settingsFor(['repository:structure']),
  'src/wrappers.ts': WRAPPERS_AND_WORK,
  'src/build.ts': '/** Joins the two halves. */\nexport function build(a: number, b: string) {\n  return `${a}:${b}`\n}\n',
}

describe('runChecks, over a repository with a wrapper in it', () => {
  let root = ''
  let outcome: CheckOutcome

  beforeAll(async () => {
    root = await plant('structure-check', TREE)
    outcome = await runChecks({
      cwd: root,
      presetsRoot: PRESETS,
      version: '0.1.0',
      only: 'structure/trivial-function',
      skip: [],
      unchecked: false,
    })
  })

  afterAll(async () => {
    await removeRepository(root)
  })

  it('fails the gate, naming the check the way a tool check is named', () => {
    assert.deepEqual(outcome.verdict.failing, ['structure/trivial-function'])
    assert.equal(outcome.verdict.passed, false)
  })

  it('carries the file, the position and the rule into the result a person reads', () => {
    const result = outcome.results.find((entry) => entry.check === 'structure/trivial-function')
    assert.equal(result?.findings, 2)
    assert.match(result?.output ?? '', /src\/wrappers\.ts:4:8 {2}structure\/trivial-function/u)
  })

  it('counts both TypeScript files as read, because the engine enumerates its own inputs', () => {
    const result = outcome.results.find((entry) => entry.check === 'structure/trivial-function')
    assert.equal(result?.pathsRead, 2)
  })
})
