import assert from 'node:assert/strict'
import { describe, it } from 'bun:test'
import { disablesCheck, exceptionFor } from '@/settings/declaration'
import { compileSelector } from '@/settings/selector'
import type { Exception } from 'types/settings'

const REASON = 'A reason, which is the one field that has to be there'

function entry(narrowing: Partial<Exception> = {}): Exception {
  return { check: 'structure/function-length', reason: REASON, ...narrowing }
}

describe('exceptionFor', () => {
  it('covers everything of its check when it narrows on nothing', () => {
    const found = exceptionFor([entry()], { check: 'structure/function-length', path: 'a.ts' })
    assert.equal(found?.reason, REASON)
  })

  it('leaves a different check alone', () => {
    assert.equal(exceptionFor([entry()], { check: 'structure/file-length', path: 'a.ts' }), undefined)
  })

  it('covers one symbol and leaves its neighbour', () => {
    const only = [entry({ symbol: 'buildMigrationPlan' })]
    const target = { check: 'structure/function-length', path: 'src/plan.ts' }
    assert.ok(exceptionFor(only, { ...target, symbol: 'buildMigrationPlan' }) !== undefined)
    assert.equal(exceptionFor(only, { ...target, symbol: 'buildOther' }), undefined)
  })

  it('requires every narrowing field to match, not one of them', () => {
    const both = [entry({ symbol: 'buildMigrationPlan', paths: compileSelector(['src/**'], 'test') })]
    const right = { check: 'structure/function-length', path: 'src/plan.ts', symbol: 'buildMigrationPlan' }
    assert.ok(exceptionFor(both, right) !== undefined)
    assert.equal(exceptionFor(both, { ...right, path: 'tests/plan.ts' }), undefined)
  })

  it('does not let a path-scoped entry cover a target that names no path', () => {
    const scoped = [entry({ paths: compileSelector(['src/**'], 'test') })]
    assert.equal(exceptionFor(scoped, { check: 'structure/function-length' }), undefined)
  })

  it('matches a finding id, which is how an advisory is accepted', () => {
    const advisory = [{ check: 'deps/osv', reason: REASON, finding: 'GHSA-82fw-gwwq-j7x9' }]
    const target = { check: 'deps/osv' }
    assert.ok(exceptionFor(advisory, { ...target, finding: 'GHSA-82fw-gwwq-j7x9' }) !== undefined)
    assert.equal(exceptionFor(advisory, { ...target, finding: 'GHSA-0000-0000-0000' }), undefined)
  })
})

describe('disablesCheck', () => {
  it('reads an entry with no narrowing field as turning the check off', () => {
    assert.equal(disablesCheck(entry()), true)
  })

  it('reads an entry with any narrowing field as leaving the check on', () => {
    assert.equal(disablesCheck(entry({ symbol: 'one' })), false)
    assert.equal(disablesCheck(entry({ paths: compileSelector(['src/**'], 'test') })), false)
  })
})
