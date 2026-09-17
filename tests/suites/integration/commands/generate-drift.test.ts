import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, it } from 'bun:test'
import { HIDDEN_SQL } from '@config/tests/repositories'
import { runGenerate } from '@/commands/generate'
import { removeRepository, plant, PRESETS } from '@tests/support/repository'

describe('runGenerate with --check', () => {
  let root = ''
  const run = (check: boolean) =>
    runGenerate({ cwd: root, presetsRoot: PRESETS, version: '0.1.0', check })

  beforeEach(async () => {
    root = await plant('drift', HIDDEN_SQL)
  })

  afterEach(async () => {
    await removeRepository(root)
  })

  it('passes when nothing was touched', async () => {
    await run(false)
    const outcome = await run(true)
    assert.equal(outcome.code, 0)
    assert.deepEqual(outcome.findings, [])
  })

  it('fails on a hand edit, and names both ways forward', async () => {
    await run(false)
    const target = join(root, '.gspot/generated/sqlfluff.cfg')
    await writeFile(target, `${await readFile(target, 'utf8')}\n# a hand edit\n`, 'utf8')

    const outcome = await run(true)
    assert.equal(outcome.code, 1)
    assert.equal(outcome.findings[0]?.kind, 'edited')
    assert.match(outcome.lines.join('\n'), /Move the change into gspot\.toml/u)
    assert.match(outcome.lines.join('\n'), /run `gspot generate` to discard it/u)
  })

  it('fails when a generated file was never written', async () => {
    const outcome = await run(true)
    assert.equal(outcome.code, 1)
    assert.ok(outcome.findings.every((finding) => finding.kind === 'absent'))
  })
})
