import assert from 'node:assert/strict'
import { describe, it } from 'bun:test'
import { TWO_TASK_PRESET } from '@config/tests/manifests'
import { buildGraph, checksIn } from '@/run/graph'
import { presetFrom } from '@tests/support/preset'

const PRESET = presetFrom(TWO_TASK_PRESET)
const ROOT = [{ path: '', presets: [PRESET] }]

describe('buildGraph', () => {
  it('lists a check once per node when two tasks name it', () => {
    const check = buildGraph(ROOT, null).find((node) => node.name === 'check')
    assert.deepEqual(check?.checks.map((entry) => entry.id), ['sh/syntax', 'sh/build'])
  })

  it('reports each check once across the whole graph', () => {
    assert.deepEqual([...checksIn(buildGraph(ROOT, null))].sort(), ['sh/build', 'sh/syntax'])
  })

  it('puts a repo-scoped task at the root even inside a scope', () => {
    const nodes = buildGraph([{ path: 'api', presets: [PRESET] }], null)
    assert.equal(nodes.find((node) => node.name === 'check')?.scope, '')
    assert.equal(nodes.find((node) => node.name === 'lint:bash')?.scope, 'api')
  })

  it('drops a node whose checks the stage does not run', () => {
    const check = buildGraph(ROOT, 'pre-commit').find((node) => node.name === 'check')
    assert.deepEqual(check?.checks.map((entry) => entry.id), ['sh/syntax'])
  })
})
