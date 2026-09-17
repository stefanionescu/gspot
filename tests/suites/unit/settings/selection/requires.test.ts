import assert from 'node:assert/strict'
import { describe, it } from 'bun:test'
import { presetOf } from '@config/tests/manifests'
import { select } from '@/settings/selection'
import { available, presetFrom } from '@tests/support/preset'

const preset = (id: string, kind: string, requires: string[] = []) =>
  presetFrom(presetOf(id, kind, requires), `${id}.toml`)

describe('select, expanding what a preset requires', () => {
  it('pulls in what a preset requires', () => {
    const all = available(
      preset('framework:nextjs', 'framework', ['language:typescript']),
      preset('language:typescript', 'language'),
    )
    assert.deepEqual(select(all, ['framework:nextjs'], 'test').presets.map((entry) => entry.id), [
      'language:typescript',
      'framework:nextjs',
    ])
  })

  it('orders a preset after everything it requires, however deep', () => {
    const all = available(
      preset('platform:supabase', 'platform', ['database:postgres']),
      preset('database:postgres', 'database', ['language:sql']),
      preset('language:sql', 'language'),
    )
    assert.deepEqual(select(all, ['platform:supabase'], 'test').presets.map((entry) => entry.id), [
      'language:sql',
      'database:postgres',
      'platform:supabase',
    ])
  })

  it('selects a preset once however many things require it', () => {
    const all = available(
      preset('framework:nextjs', 'framework', ['language:typescript']),
      preset('library:zod', 'library', ['language:typescript']),
      preset('language:typescript', 'language'),
    )
    const chosen = select(all, ['framework:nextjs', 'library:zod'], 'test')
    assert.equal(chosen.presets.filter((entry) => entry.id === 'language:typescript').length, 1)
  })

  it('carries the structural and naming presets in with any language, and only then', () => {
    const all = available(
      preset('language:sql', 'language'),
      preset('repository:secrets', 'repository'),
      preset('repository:structure', 'repository'),
      preset('repository:naming', 'repository'),
    )
    assert.deepEqual([...select(all, ['language:sql'], 'test').implied].sort(), [
      'repository:naming',
      'repository:structure',
    ])
    assert.deepEqual(select(all, ['repository:secrets'], 'test').implied, [])
  })
})
