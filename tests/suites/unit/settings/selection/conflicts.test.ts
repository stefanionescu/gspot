import assert from 'node:assert/strict'
import { describe, it } from 'bun:test'
import { presetOf } from '@config/tests/manifests'
import { select } from '@/settings/selection'
import { available, presetFrom } from '@tests/support/preset'

const preset = (id: string, kind: string, requires: string[] = [], conflicts: string[] = []) =>
  presetFrom(presetOf(id, kind, requires, conflicts), `${id}.toml`)

describe('select, refusing a selection', () => {
  it('refuses a preset that is not one, and lists the kind it looked in', () => {
    const all = available(preset('language:sql', 'language'))
    assert.throws(
      () => select(all, ['language:squeal'], 'gspot.toml presets'),
      /is not a preset[\s\S]*language:sql/u,
    )
  })

  it('refuses two presets that declare a conflict', () => {
    const all = available(preset('tool:vitest', 'tool', [], ['tool:jest']), preset('tool:jest', 'tool'))
    assert.throws(() => select(all, ['tool:vitest', 'tool:jest'], 'test'), /cannot both be selected/u)
  })

  it('refuses presets that require each other in a circle', () => {
    const all = available(preset('tool:a', 'tool', ['tool:b']), preset('tool:b', 'tool', ['tool:a']))
    assert.throws(() => select(all, ['tool:a'], 'test'), /in a circle/u)
  })
})
