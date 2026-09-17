import assert from 'node:assert/strict'
import { afterAll, beforeAll, describe, it } from 'bun:test'
import { settingsFor, SHELL_SCRIPT } from '@config/tests/repositories'
import { runCoverage } from '@/commands/coverage'
import { removeRepository, plant, PRESETS } from '@tests/support/repository'
import type { CoverageOutcome } from 'types/commands'

const TREE = {
  'gspot.toml': settingsFor(['language:bash']),
  'ops/run.sh': SHELL_SCRIPT,
  'src/maths.ts': '/** Adds. */\nexport function add(a: number, b: number) {\n  const sum = a + b\n  return sum\n}\n',
}

describe('runCoverage, over a repository whose language preset owns only the shell', () => {
  let root = ''
  let outcome: CoverageOutcome

  beforeAll(async () => {
    root = await plant('supplier', TREE)
    outcome = await runCoverage({ cwd: root, presetsRoot: PRESETS, version: '0.1.0', diff: false })
  })

  afterAll(async () => {
    await removeRepository(root)
  })

  it('leaves a TypeScript file unchecked, however many structural checks read it', () => {
    const row = outcome.table.paths['src/maths.ts']
    assert.equal(row?.status, 'unchecked')
    assert.ok((row?.checks.length ?? 0) > 1)
  })

  it('says why, rather than claiming no check reads it', () => {
    const report = outcome.lines.join('\n')
    assert.match(report, /no selected preset says what this file is/u)
  })

  it('keeps the shell file partial, because a preset there does own it', () => {
    assert.equal(outcome.table.paths['ops/run.sh']?.status, 'partial')
  })

  it('does not read a grammar it cannot parse as an ignored path', () => {
    const report = outcome.lines.join('\n')
    assert.doesNotMatch(report, /skipped by structure\//u)
  })
})
