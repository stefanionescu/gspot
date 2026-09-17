import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, it } from 'bun:test'
import { HIDDEN_SQL } from '@config/tests/repositories'
import { runCoverage } from '@/commands/coverage'
import { removeRepository, plant, PRESETS } from '@tests/support/repository'

describe('runCoverage with --diff', () => {
  let root = ''
  const run = (diff: boolean) =>
    runCoverage({ cwd: root, presetsRoot: PRESETS, version: '0.1.0', diff })

  beforeEach(async () => {
    root = await plant('coverage-diff', HIDDEN_SQL)
  })

  afterEach(async () => {
    await removeRepository(root)
  })

  it('fails when there is no tracked table to compare against', async () => {
    const outcome = await run(true)
    assert.equal(outcome.code, 1)
    assert.match(outcome.lines.join('\n'), /no tracked table yet/u)
  })

  it('passes when nothing got worse, even with the gate already failing', async () => {
    await run(false)
    assert.equal((await run(true)).code, 0)
  })
})
