import assert from 'node:assert/strict'
import { describe, it } from 'bun:test'
import { runsAt } from '@/run/graph'
import type { Check, Requirement, Stage } from 'types/manifest'

function check(stage: Stage, requires: Requirement[] = []): Check {
  return {
    id: 'x',
    inspects: ['syntax'],
    mechanism: 'configured',
    stage,
    takes: 'project',
    command: ['x'],
    failsOn: 'exit-code',
    fileList: { via: 'declared' },
    requires,
    invocationModes: [],
    toolErrors: [],
    tools: [],
  }
}

describe('runsAt', () => {
  it('runs only what needs nothing at pre-commit', () => {
    assert.equal(runsAt(check('pre-commit'), 'pre-commit'), true)
    assert.equal(runsAt(check('pre-push', ['build']), 'pre-commit'), false)
  })

  it('runs everything at pre-push, so no check is reachable from CI alone', () => {
    assert.equal(runsAt(check('pre-commit'), 'pre-push'), true)
    assert.equal(runsAt(check('pre-push', ['network']), 'pre-push'), true)
  })

  it('gives CI the same set as pre-push', () => {
    for (const stage of ['pre-commit', 'pre-push'] as const) {
      assert.equal(runsAt(check(stage), 'ci'), runsAt(check(stage), 'pre-push'))
    }
  })

  it('keeps the message checks out of every stage but their own', () => {
    assert.equal(runsAt(check('commit-msg'), 'commit-msg'), true)
    assert.equal(runsAt(check('commit-msg'), 'pre-push'), false)
    assert.equal(runsAt(check('commit-msg'), null), false)
  })
})
