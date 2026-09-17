import assert from 'node:assert/strict'
import { afterAll, beforeAll, describe, it } from 'bun:test'
import { HIDDEN_SQL } from '@config/tests/repositories'
import { runCoverage } from '@/commands/coverage'
import { runGenerate } from '@/commands/generate'
import { removeRepository, plant, PRESETS, statusOf } from '@tests/support/repository'
import type { CoverageOutcome } from 'types/commands'

describe('runCoverage, over a repository whose SQL is hidden', () => {
  let root = ''
  let outcome: CoverageOutcome

  beforeAll(async () => {
    root = await plant('coverage', HIDDEN_SQL)

    await runGenerate({ cwd: root, presetsRoot: PRESETS, version: '0.1.0', check: false })
    outcome = await runCoverage({ cwd: root, presetsRoot: PRESETS, version: '0.1.0', diff: false })
  })

  afterAll(async () => {
    await removeRepository(root)
  })

  it('reports both hidden files as unchecked, not only the one under a directory named sql', () => {
    assert.equal(outcome.code, 1)
    assert.equal(outcome.table.paths['sql/schema.sql']?.status, 'unchecked')
    assert.equal(outcome.table.paths['tests/suites/sql/rls/versioning.test.sql']?.status, 'unchecked')
  })

  it('names the ignore file, the line and the pattern that hid them', () => {
    const report = outcome.lines.join('\n')
    assert.match(report, /ignored by \.sqlfluffignore:9 {2}pattern sql\//u)
    assert.match(report, /remove the pattern, or declare the path in gspot\.toml/u)
  })

  it('claims a shell script by its interpreter, with no path list anywhere', () => {
    const claimed = outcome.table.paths['ops/run.sh']?.checks.map((entry) => entry.check) ?? []
    assert.deepEqual(
      claimed.filter((check) => check.startsWith('sh/')).sort(),
      ['sh/shellcheck', 'sh/shfmt', 'sh/syntax'],
    )
  })

  it('names the inspections a partial path is short of', () => {
    assert.deepEqual(outcome.table.paths['ops/run.sh']?.missing, ['naming', 'prose', 'spelling'])
  })

  it('marks a claim nobody could verify as unverified', () => {
    assert.equal(outcome.table.paths['ops/run.sh']?.unverified, true)
  })

  it('writes the path table for review', async () => {
    assert.match(await statusOf(root), /\.gspot\/coverage\.json/u)
  })
})
