import assert from 'node:assert/strict'
import { describe, it } from 'bun:test'
import { pinsFor } from '@/runner/mise'
import type { Lock } from 'types/toolchain'

const LOCK: Lock = {
  version: 1,
  tools: new Map([
    ['shellcheck', { id: 'shellcheck', version: '0.11.0', provider: 'download', assets: new Map() }],
    ['sqlfluff', { id: 'sqlfluff', version: '4.0.0', provider: 'uv', assets: new Map() }],
  ]),
}

describe('pinsFor', () => {
  it('pins a tool the repository has not pinned', () => {
    const { pins, conflicts } = pinsFor(LOCK, new Map())
    assert.deepEqual([...pins].sort(), [['shellcheck', '0.11.0'], ['sqlfluff', '4.0.0']])
    assert.deepEqual(conflicts, [])
  })

  it('leaves a matching pin alone rather than restating it', () => {
    assert.equal(pinsFor(LOCK, new Map([['sqlfluff', '4.0.0']])).pins.has('sqlfluff'), false)
  })

  it('reports both versions when they disagree, and pins neither', () => {
    const { pins, conflicts } = pinsFor(LOCK, new Map([['sqlfluff', '3.2.0']]))
    assert.equal(pins.has('sqlfluff'), false)
    assert.deepEqual(conflicts, [{ tool: 'sqlfluff', theirs: '3.2.0', ours: '4.0.0' }])
  })

  it('says nothing about a tool only the repository pins', () => {
    const { pins, conflicts } = pinsFor(LOCK, new Map([['deno', '2.0.0']]))
    assert.equal(pins.has('deno'), false)
    assert.deepEqual(conflicts, [])
  })
})
