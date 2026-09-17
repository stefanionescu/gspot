import assert from 'node:assert/strict'
import { describe, it } from 'bun:test'
import { describeExceptions } from '@/run/report'
import type { AppliedException } from 'types/run'

const COVERED: AppliedException = {
  check: 'structure/trivial-function',
  reason: 'The public name is the stable one.',
  narrowedBy: ['symbol forwards'],
  covered: 1,
}

const STALE: AppliedException = {
  check: 'structure/file-length',
  reason: 'Upstream source, patched only by rebase.',
  narrowedBy: ['paths vendor/**'],
  covered: 0,
}

describe('describeExceptions', () => {
  it('prints the count, never the array itself', () => {
    const lines = describeExceptions([COVERED, STALE])
    assert.equal(lines[0], 'exceptions   2')
    assert.equal(lines.join('\n').includes('[object Object]'), false)
  })

  it('prints every reason, because the list is what gets read at every push', () => {
    const printed = describeExceptions([COVERED, STALE]).join('\n')
    assert.match(printed, /The public name is the stable one\./u)
    assert.match(printed, /Upstream source, patched only by rebase\./u)
  })

  it('says which entry covered nothing, so a stale one is visible', () => {
    const printed = describeExceptions([COVERED, STALE]).join('\n')
    assert.match(printed, /structure\/file-length {2}paths vendor\/\*\* {2}covered nothing this run/u)
    assert.match(printed, /structure\/trivial-function {2}symbol forwards {2}covered 1/u)
  })

  it('says none rather than nothing when there are none', () => {
    assert.deepEqual(describeExceptions([]), ['exceptions   0'])
  })
})
