import assert from 'node:assert/strict'
import { afterAll, beforeAll, describe, it } from 'bun:test'
import { PARSEABLE_SHELL, UNPARSEABLE_SHELL } from '@config/tests/sources'
import { runBuiltin } from '@/structure/builtin'
import { removeRepository, plant } from '@tests/support/repository'

const LONG_FUNCTION = `#!/usr/bin/env bash
wide() {
${Array.from({ length: 12 }, (_, at) => `  echo ${at}`).join('\n')}
}

narrow() {
  echo 1
}
`

const TREE = {
  'ops/long.sh': LONG_FUNCTION,
  'ops/deploy.sh': PARSEABLE_SHELL,
  'ops/broken.sh': UNPARSEABLE_SHELL,

  'ops/caller.sh': '#!/usr/bin/env bash\ndeploy /tmp\n',
}

describe('runBuiltin', () => {
  let root = ''

  const over = (name: string, paths: readonly string[], limit: number, entryPoints: string[] = []) =>
    runBuiltin(name, { root, paths, rule: 'r', limit, setting: 's', entryPoints })

  beforeAll(async () => {
    root = await plant('builtins', TREE)
  })

  afterAll(async () => {
    await removeRepository(root)
  })

  it('counts a file by its lines, blank and commented ones included', async () => {
    const outcome = await over('file-length', ['ops/long.sh'], 10)
    assert.equal(outcome.findings.length, 1)
    assert.match(outcome.findings[0]?.message ?? '', /This file is 19 lines, against a limit of 10/u)
  })

  it('reports the long function and leaves the short one', async () => {
    const outcome = await over('function-length', ['ops/long.sh'], 10)
    assert.deepEqual(outcome.findings.map((finding) => finding.at.line), [2])
  })

  it('reports a file the grammar could not read rather than counting nothing in it', async () => {
    const outcome = await over('function-length', ['ops/broken.sh'], 10)
    assert.deepEqual(outcome.broken.map((broken) => broken.path), ['ops/broken.sh'])
    assert.deepEqual(outcome.read, [])
  })

  it('reports a function nothing names anywhere', async () => {
    const outcome = await over('unused-functions', ['ops/long.sh'], 0)
    assert.deepEqual(
      outcome.findings.map((finding) => finding.message),
      ['Nothing calls `wide`.', 'Nothing calls `narrow`.'],
    )
  })

  it('leaves a function an entry point outside the check calls', async () => {
    const outcome = await over('unused-functions', ['ops/deploy.sh'], 0, ['ops/caller.sh'])
    assert.deepEqual(outcome.findings, [])
  })
})
