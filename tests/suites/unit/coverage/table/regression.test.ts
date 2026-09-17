import assert from 'node:assert/strict'
import { describe, it } from 'bun:test'
import { regressions } from '@/coverage/table'
import { at, tableOf } from '@tests/support/table'

describe('regressions', () => {
  it('reports a path that was covered and is now unchecked', () => {
    const before = tableOf([at('a.sql', 'covered')])
    const after = tableOf([at('a.sql', 'unchecked')])
    assert.deepEqual(regressions(before, after), [{ path: 'a.sql', was: 'covered', now: 'unchecked' }])
  })

  it('reports a failing path that is new to the tree', () => {
    const before = tableOf([at('a.sql', 'covered')])
    const after = tableOf([at('a.sql', 'covered'), at('b.sql', 'partial')])
    assert.deepEqual(regressions(before, after), [{ path: 'b.sql', was: 'absent', now: 'partial' }])
  })

  it('stays quiet about a path that was already failing', () => {
    const before = tableOf([at('a.sql', 'unchecked')])
    const after = tableOf([at('a.sql', 'partial')])
    assert.deepEqual(regressions(before, after), [])
  })

  it('stays quiet when a path gets better', () => {
    const before = tableOf([at('a.sql', 'unchecked')])
    const after = tableOf([at('a.sql', 'covered')])
    assert.deepEqual(regressions(before, after), [])
  })
})
