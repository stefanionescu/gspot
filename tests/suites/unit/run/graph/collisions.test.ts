import assert from 'node:assert/strict'
import { describe, it } from 'bun:test'
import { collisions } from '@/run/graph'

describe('collisions', () => {
  it('reports a repository task that takes a name gspot owns', () => {
    assert.deepEqual(collisions(['lint', 'deploy', 'check']), ['lint', 'check'])
  })

  it('leaves a repository task with its own name alone', () => {
    assert.deepEqual(collisions(['deploy', 'seed']), [])
  })
})
