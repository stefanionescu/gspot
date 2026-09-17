import assert from 'node:assert/strict'
import { describe, it } from 'bun:test'
import { failingCount } from '@/coverage/table'
import { at, tableOf } from '@tests/support/table'

describe('buildTable', () => {
  it('writes one row per path in path order, counting each status', () => {
    const table = tableOf([at('b.sql', 'unchecked'), at('a.sh', 'covered')])
    assert.deepEqual(Object.keys(table.paths), ['a.sh', 'b.sql'])
    assert.equal(table.summary.covered, 1)
    assert.equal(table.summary.unchecked, 1)
  })

  it('records the inspections a partial path is short of', () => {
    const table = tableOf([at('a.sh', 'partial', ['prose', 'naming'])])
    assert.deepEqual(table.paths['a.sh']?.missing, ['prose', 'naming'])
  })
})

describe('failingCount', () => {
  it('counts the three failing statuses and nothing else', () => {
    const table = tableOf([
      at('a', 'covered'),
      at('b', 'partial'),
      at('c', 'unchecked'),
      at('d', 'orphan'),
      at('e', 'vendored'),
      at('f', 'excepted'),
    ])
    assert.equal(failingCount(table), 3)
  })
})
