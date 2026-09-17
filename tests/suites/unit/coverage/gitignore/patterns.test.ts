import assert from 'node:assert/strict'
import { describe, it } from 'bun:test'
import { BARE_DIRECTORY } from '@config/tests/ignores'
import { judge, readIgnoreFile } from '@/coverage/gitignore'

describe('readIgnoreFile', () => {
  it('skips a comment, a blank line and trailing whitespace', () => {
    const patterns = readIgnoreFile('# a comment\n\n   \nbuild/\n', 'test')
    assert.equal(patterns.length, 1)
    assert.equal(patterns[0]?.directoryOnly, true)
  })

  it('keeps the pattern as written, so a report quotes the line back', () => {
    const [pattern] = readIgnoreFile('!keep.log\n', 'test')
    assert.equal(pattern?.text, '!keep.log')
    assert.equal(pattern?.negated, true)
  })
})

describe('judge', () => {
  it('names the file, line and pattern that decided', () => {
    const patterns = readIgnoreFile(BARE_DIRECTORY['.gitignore'] ?? '', '.sqlfluffignore')
    const verdict = judge(patterns, 'tests/suites/sql/rls/versioning.test.sql')

    assert.equal(verdict?.ignored, true)
    assert.equal(verdict?.pattern.source, '.sqlfluffignore')
    assert.equal(verdict?.pattern.line, 8)
    assert.equal(verdict?.pattern.text, 'sql/')
  })

  it('names the directory that decided, not the file under it', () => {
    const patterns = readIgnoreFile(BARE_DIRECTORY['.gitignore'] ?? '', '.sqlfluffignore')
    assert.equal(judge(patterns, 'tests/suites/sql/rls/versioning.test.sql')?.at, 'tests/suites/sql')
  })
})
