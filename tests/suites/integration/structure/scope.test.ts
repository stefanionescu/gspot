import assert from 'node:assert/strict'
import { afterAll, beforeAll, describe, it } from 'bun:test'
import { settingsFor, SHELL_SCRIPT } from '@config/tests/repositories'
import { runChecks } from '@/commands/check'
import { runCoverage } from '@/commands/coverage'
import { removeRepository, plant, PRESETS } from '@tests/support/repository'
import type { CheckOutcome, CoverageOutcome } from 'types/commands'

const TREE = {
  'gspot.toml': settingsFor(['language:bash']),
  'ops/run.sh': SHELL_SCRIPT,
  'src/index.ts': 'export * from "./a"\nexport * from "./b"\n',
  'src/redirect.ts': 'export * from "./a"\n',
}

const CHECK = 'structure/reexports-in-index-only'

describe('a check that narrows itself with paths', () => {
  let root = ''
  let coverage: CoverageOutcome
  let outcome: CheckOutcome

  beforeAll(async () => {
    root = await plant('scope', TREE)
    coverage = await runCoverage({ cwd: root, presetsRoot: PRESETS, version: '0.1.0', diff: false })
    outcome = await runChecks({
      cwd: root,
      presetsRoot: PRESETS,
      version: '0.1.0',
      only: CHECK,
      skip: [],
      unchecked: false,
    })
  })

  afterAll(async () => {
    await removeRepository(root)
  })

  function claims(path: string): boolean {
    return coverage.table.paths[path]?.checks.some((entry) => entry.check === CHECK) === true
  }

  it('claims the files inside its scope', () => {
    assert.equal(claims('src/redirect.ts'), true)
  })

  it('claims none outside it, so the coverage table says what it reads', () => {
    assert.equal(claims('src/index.ts'), false)
  })

  it('reports the re-export outside an index and leaves the two inside one', () => {
    const result = outcome.results.find((entry) => entry.check === CHECK)
    assert.equal(result?.findings, 1)
    assert.match(result?.output ?? '', /src\/redirect\.ts/u)
    assert.doesNotMatch(result?.output ?? '', /src\/index\.ts/u)
  })
})
