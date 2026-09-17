import assert from 'node:assert/strict'
import { afterAll, beforeAll, describe, it } from 'bun:test'
import { EXTENSIONLESS_SCRIPTS } from '@config/tests/sources'
import { grammarIn, parseEach } from '@/structure/grammar'
import { removeRepository, plant } from '@tests/support/repository'

describe('grammarIn', () => {
  let root = ''

  beforeAll(async () => {
    root = await plant('interpreter', EXTENSIONLESS_SCRIPTS)
  })

  afterAll(async () => {
    await removeRepository(root)
  })

  it('reads the interpreter through the env -S form, where the flag comes first', async () => {
    assert.equal(await grammarIn(root, 'ops/deploy'), 'bash')
  })

  it('reads a Python script as Python rather than as the shell', async () => {
    assert.equal(await grammarIn(root, 'ops/migrate'), 'python')
  })

  it('gives no grammar to an extensionless file that names no interpreter', async () => {
    assert.equal(await grammarIn(root, 'ops/notes'), null)
  })

  it('parses each file under the grammar its own first line named', async () => {
    const { parsed } = await parseEach(root, Object.keys(EXTENSIONLESS_SCRIPTS))
    assert.deepEqual(
      parsed.map((source) => [source.path, source.grammar]),
      [
        ['ops/deploy', 'bash'],
        ['ops/migrate', 'python'],
      ],
    )
  })
})
