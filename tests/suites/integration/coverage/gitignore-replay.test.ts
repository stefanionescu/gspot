import assert from 'node:assert/strict'
import { describe, it } from 'bun:test'
import { IGNORE_IDIOMS } from '@config/tests/ignores'
import { ignores, readIgnoreFile } from '@/coverage/gitignore'
import { invoke } from '@/run/invoke'
import { removeRepository, plantUncommitted } from '@tests/support/repository'

async function gitSkips(root: string, paths: readonly string[]): Promise<ReadonlySet<string>> {
  const answer = await invoke({
    command: ['git', 'check-ignore', '--no-index', '--stdin'],
    cwd: root,
    stdin: `${paths.join('\n')}\n`,
  })
  assert.equal(answer.outcome, 'ran')
  if (answer.outcome !== 'ran') return new Set()
  assert.ok(answer.code === 0 || answer.code === 1, answer.stderr)
  return new Set(answer.stdout.split('\n').filter((line) => line.length > 0))
}

describe('the gitignore replay', () => {
  for (const [idiom, files] of Object.entries(IGNORE_IDIOMS)) {
    it(`agrees with git on ${idiom}`, async () => {
      const root = await plantUncommitted(`ignore-${idiom}`, files)
      const paths = Object.keys(files).filter((path) => path !== '.gitignore')
      const patterns = readIgnoreFile(files['.gitignore'] ?? '', '.gitignore')
      const theirs = await gitSkips(root, paths)

      const disagreements = paths
        .filter((path) => ignores(patterns, path) !== theirs.has(path))
        .map((path) => `${path}: git ${theirs.has(path) ? 'skips' : 'reads'} it, the replay does not`)
      assert.deepEqual(disagreements, [])
      await removeRepository(root)
    })
  }
})
