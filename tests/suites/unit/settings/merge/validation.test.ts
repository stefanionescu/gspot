import assert from 'node:assert/strict'
import { describe, it } from 'bun:test'
import { mergeSettings } from '@/settings/merge'
import { entriesFrom, SLOTS } from '@tests/support/merge'
import { presetWith } from '@tests/support/preset'

describe('mergeSettings, refusing an entry', () => {
  it('refuses a key no selected preset exposes, and names the ones it does', () => {
    assert.throws(
      () => mergeSettings([presetWith(SLOTS)], entriesFrom('[limits]\nset.file_linez = 250\n')),
      /is not a setting any selected preset exposes[\s\S]*limits\.file_lines/u,
    )
  })

  it('refuses an operation the setting does not take', () => {
    assert.throws(
      () => mergeSettings([presetWith(SLOTS)], entriesFrom('[limits]\nadd.file_lines = [250]\n')),
      /does not take `add`[\s\S]*It takes: set/u,
    )
  })

  it('refuses a loosening entry with no reason', () => {
    assert.throws(
      () => mergeSettings([presetWith(SLOTS)], entriesFrom('[spelling.typos]\nadd.words = ["fpr"]\n')),
      /carries no reason/u,
    )
  })
})

describe('mergeSettings, reporting an entry that changed nothing', () => {
  it('reports a removal of something absent as dead, and loads anyway', () => {
    const merged = mergeSettings(
      [presetWith(SLOTS, [['naming.banned_terms', ['helper']]])],
      entriesFrom('[naming]\nremove.banned_terms = ["absent"]\n'),
    )
    assert.equal(merged.dead.length, 1)
    assert.match(merged.dead[0]?.why ?? '', /not there/u)
  })

  it('collects every loosening reason for the run report', () => {
    const merged = mergeSettings(
      [presetWith(SLOTS)],
      entriesFrom('[spelling.typos]\nadd.words = [{ word = "fpr", reason = "GPG field name" }]\n'),
    )
    assert.deepEqual(merged.loosenings, [{ name: 'spelling.typos.words', reason: 'GPG field name' }])
  })
})
