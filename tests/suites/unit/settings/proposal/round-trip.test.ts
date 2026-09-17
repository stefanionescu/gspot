import assert from 'node:assert/strict'
import { describe, it } from 'bun:test'
import { parseSettings } from '@/settings/document'
import { renderSettings } from '@/settings/proposal'
import type { Answers } from 'types/detect'

const ANSWERS: Answers = {
  runner: 'mise',
  presets: ['language:bash', 'language:sql'],
  scopes: [{ path: 'api', presets: ['language:typescript'] }],
  ownedTools: [],
  declarations: [{ paths: ['vendor/**'], reason: 'Upstream source, patched only by rebase' }],
  hooks: true,
  ci: 'github',
  rules: false,
}

describe('renderSettings', () => {
  const read = parseSettings(renderSettings(ANSWERS), 'gspot.toml')

  it('keeps the selection at the root rather than inside a later table', () => {
    assert.deepEqual(read.presets, ['language:bash', 'language:sql'])
  })

  it('round-trips the runner, the gate and the scopes', () => {
    assert.equal(read.runner, 'mise')
    assert.deepEqual(read.gate, { hooks: true, ci: 'github' })
    assert.deepEqual(read.scopes, [{ path: 'api', presets: ['language:typescript'] }])
  })

  it('round-trips a declaration with its reason and its selector', () => {
    assert.equal(read.declarations[0]?.reason, 'Upstream source, patched only by rebase')
    assert.equal(read.declarations[0]?.paths.matches('vendor/left-pad/index.js'), true)
  })
})
