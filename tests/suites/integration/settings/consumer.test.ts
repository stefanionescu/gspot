import assert from 'node:assert/strict'
import { afterAll, beforeAll, describe, it } from 'bun:test'
import { CONSUMER_CHECK, settingsFor, SYMBOL_EXCEPTION } from '@config/tests/repositories'
import { WRAPPERS_AND_WORK } from '@config/tests/sources'
import { runChecks } from '@/commands/check'
import { removeRepository, plant, PRESETS } from '@tests/support/repository'
import type { CheckOutcome } from 'types/commands'

const TREE = {
  'gspot.toml': settingsFor(['repository:structure'], SYMBOL_EXCEPTION + CONSUMER_CHECK),
  'src/wrappers.ts': WRAPPERS_AND_WORK,
  'sql/0001_init.sql': 'select 1;\n',
}

describe('runChecks, over a repository with its own check and its own exemption', () => {
  let root = ''
  let outcome: CheckOutcome

  beforeAll(async () => {
    root = await plant('consumer', TREE)
    outcome = await runChecks({
      cwd: root,
      presetsRoot: PRESETS,
      version: '0.1.0',
      skip: [],
      unchecked: false,
    })
  })

  afterAll(async () => {
    await removeRepository(root)
  })

  it('runs the check the repository wrote, rather than reading it and dropping it', () => {
    const found = outcome.results.find((result) => result.check === 'ops/migration-header')
    assert.equal(found?.status, 'ran')
    assert.equal(found?.pathsRead, 1)
  })

  it('suppresses the one exempted finding and leaves its neighbour', () => {
    const found = outcome.results.find((result) => result.check === 'structure/trivial-function')
    assert.equal(found?.findings, 1)
    assert.equal(found?.suppressed, 1)
    assert.match(found?.output ?? '', /reordered/u)
    assert.doesNotMatch(found?.output ?? '', /forwards/u)
  })

  it('prints every exception with its reason and what it covered', () => {
    const report = outcome.lines.join('\n')
    assert.match(report, /structure\/trivial-function {2}symbol forwards {2}covered 1/u)
    assert.match(report, /The public name is the stable one/u)
  })
})
