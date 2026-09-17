import assert from 'node:assert/strict'
import { describe, it } from 'bun:test'
import { mergeSettings } from '@/settings/merge'
import { entriesFrom, SLOTS } from '@tests/support/merge'
import { presetWith } from '@tests/support/preset'

describe('mergeSettings', () => {
  it('starts from the preset default and names it as the source', () => {
    const merged = mergeSettings([presetWith(SLOTS, [['limits.file_lines', 300]])], [])
    assert.equal(merged.settings.get('limits.file_lines')?.value, 300)
    assert.deepEqual(merged.settings.get('limits.file_lines')?.sources, ['language:bash'])
  })

  it('replaces a scalar and keeps every layer that touched it', () => {
    const merged = mergeSettings(
      [presetWith(SLOTS, [['limits.file_lines', 300]])],
      entriesFrom('[limits]\nset.file_lines = 250\n'),
    )
    const resolved = merged.settings.get('limits.file_lines')
    assert.equal(resolved?.value, 250)
    assert.deepEqual(resolved?.sources, ['language:bash', 'gspot.toml [limits] set.file_lines'])
  })

  it('appends to a list without repeating a value already there', () => {
    const merged = mergeSettings(
      [presetWith(SLOTS, [['naming.banned_terms', ['helper']]])],
      entriesFrom('[naming]\nadd.banned_terms = ["wrapper", "helper"]\n'),
    )
    assert.deepEqual(merged.settings.get('naming.banned_terms')?.value, ['helper', 'wrapper'])
  })

  it('subtracts from a list', () => {
    const merged = mergeSettings(
      [presetWith(SLOTS, [['naming.banned_terms', ['helper', 'wrapper']]])],
      entriesFrom('[naming]\nremove.banned_terms = ["wrapper"]\n'),
    )
    assert.deepEqual(merged.settings.get('naming.banned_terms')?.value, ['helper'])
  })

  it('lets a root entry have the last word over a scope entry', () => {
    const merged = mergeSettings(
      [presetWith(SLOTS, [['limits.file_lines', 300]])],
      [
        ...entriesFrom('[limits]\nset.file_lines = 250\n'),
        ...entriesFrom('[limits]\nset.file_lines = 500\n', 'api'),
      ],
    )
    assert.equal(merged.settings.get('limits.file_lines')?.value, 250)
  })
})
