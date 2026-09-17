import assert from 'node:assert/strict'
import { describe, it } from 'bun:test'
import { extensionOf } from '@/detect/extension'

describe('extensionOf', () => {
  it('treats a leading dot as a name, not an extension', () => {
    assert.equal(extensionOf('.gitignore'), '')
    assert.equal(extensionOf('a/b/.prettierrc'), '')
  })

  it('reports none for a file with no dot', () => {
    assert.equal(extensionOf('.mise/tasks/lint'), '')
  })

  it('lowercases, so a preset claims one spelling', () => {
    assert.equal(extensionOf('README.MD'), '.md')
  })

  it('reads the last extension of a doubled one', () => {
    assert.equal(extensionOf('a/b/module.test.ts'), '.ts')
  })
})
