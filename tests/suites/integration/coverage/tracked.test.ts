import assert from 'node:assert/strict'
import { chmod, symlink } from 'node:fs/promises'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, it } from 'bun:test'
import { TRACKED_SHAPES } from '@config/tests/repositories'
import { repositoryRoot, trackedFiles } from '@/coverage/tracked'
import { commitEverything, removeRepository, plantUncommitted } from '@tests/support/repository'
import type { TrackedFiles } from 'types/coverage'

describe('trackedFiles', () => {
  let root = ''
  let listing: TrackedFiles

  beforeAll(async () => {
    root = await plantUncommitted('tracked', { ...TRACKED_SHAPES, 'run.sh': '#!/bin/sh\nprintf ok\n' })
    await chmod(join(root, 'run.sh'), 0o755)
    await symlink('src/module.ts', join(root, 'inside.link'))
    await symlink('/etc/hosts', join(root, 'outside.link'))
    await commitEverything(root)
    listing = await trackedFiles(await repositoryRoot(root))
  })

  afterAll(async () => {
    await removeRepository(root)
  })

  it('lists tracked paths in a stable order and leaves untracked files out', () => {
    assert.deepEqual(listing.paths.map((entry) => entry.path), [
      '.gitignore',
      'inside.link',
      'notes.md',
      'outside.link',
      'run.sh',
      'src/module.ts',
    ])
  })

  it('reports the executable bit', () => {
    assert.equal(listing.paths.find((entry) => entry.path === 'run.sh')?.gitMode, 'executable')
  })

  it('classifies a symlink and keeps it in the list, rather than following it', () => {
    assert.equal(listing.paths.find((entry) => entry.path === 'inside.link')?.gitMode, 'symlink')

    const inside = listing.links.find((link) => link.path === 'inside.link')
    assert.equal(inside?.target, 'src/module.ts')
    assert.equal(inside?.inside, 'src/module.ts')

    const outside = listing.links.find((link) => link.path === 'outside.link')
    assert.equal(outside?.inside, null)
  })
})

describe('repositoryRoot', () => {
  it('refuses to run outside a git repository, and says why', async () => {
    await assert.rejects(() => repositoryRoot('/tmp'), /is not inside a git repository/u)
  })
})
