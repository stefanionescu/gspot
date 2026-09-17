import assert from 'node:assert/strict'
import { describe, it } from 'bun:test'
import { grammarFor } from '@/structure/grammar'

describe('grammarFor', () => {
  it('reads the extension, mapping the three TypeScript spellings to one grammar', () => {
    assert.equal(grammarFor('src/module.ts'), 'TypeScript')
    assert.equal(grammarFor('src/module.mts'), 'TypeScript')
    assert.equal(grammarFor('src/view.tsx'), 'Tsx')
  })

  it('reads a interpreter only where the path carries no extension', () => {
    assert.equal(grammarFor('scripts/deploy', 'bash'), 'bash')
    assert.equal(grammarFor('scripts/deploy.md', 'bash'), null)
  })

  it('gives no grammar to an extension nothing parses, rather than guessing one', () => {
    assert.equal(grammarFor('README.md'), null)
    assert.equal(grammarFor('scripts/deploy', 'perl'), null)
  })

  it('gives no grammar to an extensionless file whose first line names no interpreter', () => {
    assert.equal(grammarFor('Makefile'), null)
  })
})
