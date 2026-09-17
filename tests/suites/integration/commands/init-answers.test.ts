import assert from 'node:assert/strict'
import { join } from 'node:path'
import { describe, it } from 'bun:test'
import { UNTOUCHED } from '@config/tests/repositories'
import { runInit } from '@/commands/init'
import { removeRepository, plant, PRESETS } from '@tests/support/repository'

const OPTIONS = { presetsRoot: PRESETS, version: '0.1.0', yes: true, interactive: false }

describe('runInit, when the plan is declined', () => {
  it('writes nothing at all', async () => {
    const root = await plant('init-declined', UNTOUCHED)
    const outcome = await runInit({ ...OPTIONS, cwd: root, flags: {}, confirm: async () => false })

    assert.equal(outcome.code, 0)
    assert.equal(await Bun.file(join(root, 'gspot.toml')).exists(), false)
    assert.equal(await Bun.file(join(root, '.prettierrc.json')).exists(), true)
    await removeRepository(root)
  })
})

describe('runInit, without a terminal', () => {
  it('exits 2 and names every flag it has no answer for', async () => {
    const root = await plant('init-no-terminal', UNTOUCHED)
    const outcome = await runInit({ ...OPTIONS, cwd: root, yes: false, flags: {} })

    assert.equal(outcome.code, 2)
    for (const flag of ['--presets', '--runner', '--hooks', '--ci', '--rules']) {
      assert.match(outcome.lines.join('\n'), new RegExp(flag, 'u'))
    }
    await removeRepository(root)
  })
})
