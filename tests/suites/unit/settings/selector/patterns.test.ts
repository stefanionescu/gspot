import assert from 'node:assert/strict'
import { describe, it } from 'bun:test'
import { compileSelector } from '@/settings/selector'

describe('compileSelector', () => {
  it('does not let a single star cross a directory boundary', () => {
    const selector = compileSelector(['api/src/*.ts'], 'test')
    assert.equal(selector.matches('api/src/module.ts'), true)
    assert.equal(selector.matches('api/src/deep/module.ts'), false)
  })

  it('crosses a boundary on a double star', () => {
    const selector = compileSelector(['api/src/**/*.ts'], 'test')
    assert.equal(selector.matches('api/src/deep/nested/module.ts'), true)
    assert.equal(selector.matches('api/tests/module.ts'), false)
  })

  it('matches a dotted directory, which a repository is full of', () => {
    assert.equal(compileSelector(['.github/**'], 'test').matches('.github/workflows/gspot.yml'), true)
  })

  it('subtracts a negation from what came before it', () => {
    const selector = compileSelector(['src/**/*.ts', '!src/generated/**'], 'test')
    assert.equal(selector.matches('src/coverage/status.ts'), true)
    assert.equal(selector.matches('src/generated/types.ts'), false)
  })
})
