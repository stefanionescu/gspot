import assert from 'node:assert/strict'
import { describe, it } from 'bun:test'
import { withBlock, withoutBlock } from '@/configuration/marked'

const THEIRS = '# House rules\n\nAlways write tests first.\n'

describe('withBlock', () => {
  it('leaves everything already in the file untouched', () => {
    assert.ok(withBlock(THEIRS, 'CLAUDE.md', 'pointer').startsWith(THEIRS))
  })

  it('writes a block a later read finds and takes back out', () => {
    const written = withBlock('node_modules\n', '.gitignore', '/.gspot/run/')
    assert.ok(written.includes('/.gspot/run/'))
    assert.equal(withoutBlock(written, '.gitignore').includes('/.gspot/run/'), false)
  })

  it('replaces only what is between the markers', () => {
    const first = withBlock('keep\n', '.gitignore', 'old')
    const second = withBlock(`${first}tail\n`, '.gitignore', 'new')
    assert.ok(second.includes('keep') && second.includes('tail') && second.includes('new'))
    assert.equal(second.includes('old'), false)
  })

  it('writes the same bytes when the body has not changed', () => {
    const once = withBlock('keep\n', '.gitignore', 'body')
    assert.equal(withBlock(once, '.gitignore', 'body'), once)
  })
})

describe('withoutBlock', () => {
  it('takes the block out and leaves the rest', () => {
    const written = withBlock(THEIRS, 'CLAUDE.md', 'pointer')
    assert.equal(withoutBlock(written, 'CLAUDE.md').trimEnd(), THEIRS.trimEnd())
  })

  it('changes nothing when there is no block', () => {
    assert.equal(withoutBlock(THEIRS, 'CLAUDE.md'), THEIRS)
  })
})
