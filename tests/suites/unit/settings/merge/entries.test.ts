import assert from 'node:assert/strict'
import { describe, it } from 'bun:test'
import { entriesFrom } from '@tests/support/merge'

describe('readEntries', () => {
  it('reads the operation out of the key path', () => {
    assert.deepEqual(entriesFrom('[limits]\nset.file_lines = 250\n'), [
      {
        name: 'limits.file_lines',
        operation: 'set',
        value: 250,
        where: 'gspot.toml [limits] set.file_lines',
        scope: '',
      },
    ])
  })

  it('reads a nested table as part of the setting name', () => {
    const [entry] = entriesFrom('[spelling.typos]\nadd.words = ["fpr"]\n')
    assert.equal(entry?.name, 'spelling.typos.words')
    assert.equal(entry?.operation, 'add')
  })
})
