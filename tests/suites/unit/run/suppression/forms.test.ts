import assert from 'node:assert/strict'
import { describe, it } from 'bun:test'
import { findSuppressions } from '@/run/suppression'

describe('findSuppressions', () => {
  it('finds a recognised form with its line', () => {
    const found = findSuppressions(
      'a.ts',
      ['const a = 1', '// eslint-disable-next-line no-eval  reason: The loader needs it.', 'eval(a)'].join(
        '\n',
      ),
    )
    assert.equal(found.length, 1)
    assert.equal(found[0]?.form, 'eslint-disable')
    assert.equal(found[0]?.line, 2)
  })

  it('takes one suppression per line, not one per pattern that matches', () => {
    assert.equal(findSuppressions('a.py', '# noqa: E501  # type: ignore').length, 1)
  })
})
