import assert from 'node:assert/strict'
import { describe, it } from 'bun:test'
import { waves } from '@/run/graph'
import type { GraphNode } from 'types/run'

function node(name: string, deps: string[]): GraphNode {
  return { name, scope: '', description: name, checks: [], deps }
}

describe('waves', () => {
  it('puts a node after everything it depends on', () => {
    const ordered = waves([node('check', ['lint']), node('lint', []), node('fix', ['check'])])
    assert.deepEqual(
      ordered.map((wave) => wave.map((entry) => entry.name)),
      [['lint'], ['check'], ['fix']],
    )
  })

  it('puts independent nodes in one wave', () => {
    const ordered = waves([node('a', []), node('b', []), node('c', ['a', 'b'])])
    assert.deepEqual(ordered[0]?.map((entry) => entry.name), ['a', 'b'])
  })

  it('ignores a dependency on a task the stage left out', () => {
    assert.deepEqual(waves([node('check', ['absent'])])[0]?.map((entry) => entry.name), ['check'])
  })

  it('names the nodes when they depend on each other in a circle', () => {
    assert.throws(() => waves([node('a', ['b']), node('b', ['a'])]), /circle: a, b/u)
  })
})
