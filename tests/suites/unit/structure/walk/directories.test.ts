import assert from 'node:assert/strict'
import { describe, it } from 'bun:test'
import { prefixCollisions, singleFileFolders } from '@/structure/walk'

describe('singleFileFolders', () => {
  it('reports a directory holding one file', () => {
    const found = singleFileFolders(['lonely/only.ts', 'lib/a.ts', 'lib/b.ts'], 'r')
    assert.deepEqual(found.map((finding) => finding.path), ['lonely/only.ts'])
  })

  it('leaves a directory holding one file and a subdirectory, which is a namespace', () => {
    const found = singleFileFolders(['lib/index.ts', 'lib/deep/a.ts'], 'r')
    assert.deepEqual(found.map((finding) => finding.path), ['lib/deep/a.ts'])
  })

  it('leaves the repository root, which has nowhere to move a file up to', () => {
    assert.deepEqual(singleFileFolders(['README.md'], 'r'), [])
  })
})

describe('prefixCollisions', () => {
  it('reports files sharing the first two parts of their names', () => {
    const paths = ['lib/user-profile-view.ts', 'lib/user-profile-edit.ts', 'lib/session.ts']
    const found = prefixCollisions(paths, 'r', 2)
    assert.equal(found.length, 1)
    assert.match(found[0]?.message ?? '', /2 files in `lib` share the prefix `user-profile`/u)
  })

  it('counts each directory on its own, so one name in two places is not a collision', () => {
    const paths = ['a/user-profile-view.ts', 'b/user-profile-view.ts']
    assert.deepEqual(prefixCollisions(paths, 'r', 2), [])
  })

  it('leaves a two-part name, which is every file named after its subject', () => {
    assert.deepEqual(prefixCollisions(['lib/user-profile.ts', 'lib/user-session.ts'], 'r', 2), [])
  })

  it('reads the threshold rather than assuming two', () => {
    const paths = ['lib/a-b-one.ts', 'lib/a-b-two.ts', 'lib/a-b-three.ts']
    assert.equal(prefixCollisions(paths, 'r', 4).length, 0)
    assert.equal(prefixCollisions(paths, 'r', 3).length, 1)
  })
})
