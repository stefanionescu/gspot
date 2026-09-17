import assert from 'node:assert/strict'
import { afterAll, beforeAll, describe, it } from 'bun:test'
import { REPEATED_BODIES } from '@config/tests/sources'
import { runBuiltin } from '@/structure/builtin'
import { removeRepository, plant } from '@tests/support/repository'

describe('the duplicate-functions builtin', () => {
  let root = ''

  const at = (limit: number) =>
    runBuiltin('duplicate-functions', {
      root,
      paths: Object.keys(REPEATED_BODIES),
      rule: 'structure/duplicate-functions',
      limit,
      setting: 'limits.identical_functions',
      entryPoints: [],
    })

  beforeAll(async () => {
    root = await plant('duplicate', REPEATED_BODIES)
  })

  afterAll(async () => {
    await removeRepository(root)
  })

  it('matches bodies that differ only in their parameter names', async () => {
    const outcome = await at(3)
    assert.deepEqual(outcome.findings.map((finding) => finding.symbol), [
      'readUser',
      'readOrder',
      'readItem',
    ])
  })

  it('leaves a body that differs by one line', async () => {
    const outcome = await at(3)
    assert.equal(outcome.findings.some((finding) => finding.symbol === 'different'), false)
  })

  it('leaves a body too small to name, which every accessor in a repository shares', async () => {
    const outcome = await at(2)
    assert.equal(outcome.findings.some((finding) => finding.symbol === 'tiny'), false)
  })

  it('reads the threshold rather than assuming three', async () => {
    assert.equal((await at(4)).findings.length, 0)
  })

  it('names every copy in the message, so one finding locates all of them', async () => {
    const outcome = await at(3)
    assert.match(outcome.findings[0]?.text ?? '', /readUser.*readOrder.*readItem/u)
  })
})
