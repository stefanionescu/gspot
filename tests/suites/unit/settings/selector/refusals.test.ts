import assert from 'node:assert/strict'
import { describe, it } from 'bun:test'
import { compileSelector } from '@/settings/selector'

describe('compileSelector, refusing a pattern', () => {
  it('refuses a bare directory name, naming the defect it prevents', () => {
    assert.throws(
      () => compileSelector(['sql/'], 'gspot.toml [[exception]] paths'),
      (error: Error) => {
        assert.match(error.message, /gspot\.toml \[\[exception\]\] paths/u)
        assert.match(error.message, /58 of 83 SQL files/u)
        return true
      },
    )
  })

  it('refuses a leading slash, an empty pattern and a relative prefix', () => {
    assert.throws(() => compileSelector(['/src/**'], 'test'), /leading slash/u)
    assert.throws(() => compileSelector([''], 'test'), /matches nothing/u)
    assert.throws(() => compileSelector(['./src/**'], 'test'), /from the repository root/u)
  })

  it('refuses a negation with nothing before it', () => {
    assert.throws(() => compileSelector(['!src/**'], 'test'), /cannot come first/u)
  })
})
