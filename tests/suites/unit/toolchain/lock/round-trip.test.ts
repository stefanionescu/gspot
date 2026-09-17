import assert from 'node:assert/strict'
import { describe, it } from 'bun:test'
import { parseLock, renderLock } from '@/toolchain/lock'
import type { Lock } from 'types/toolchain'

const LOCK: Lock = {
  version: 1,
  tools: new Map([
    [
      'shellcheck',
      {
        id: 'shellcheck',
        version: '0.11.0',
        provider: 'download',
        assets: new Map([
          ['darwin-arm64', { url: 'https://example.invalid/sc-arm64.tar.xz', sha256: 'aa' }],
          ['linux-x64', { url: 'https://example.invalid/sc-x64.tar.xz', sha256: 'bb' }],
        ]),
      },
    ],
    ['eslint', { id: 'eslint', version: '9.38.0', provider: 'npm', package: 'eslint', assets: new Map() }],
  ]),
}

describe('renderLock and parseLock', () => {
  const written = renderLock(LOCK)
  const read = parseLock(written, 'tools.lock')

  it('reads back every tool it wrote', () => {
    assert.deepEqual([...read.tools.keys()].sort(), ['eslint', 'shellcheck'])
  })

  it('keeps a platform and its architecture together', () => {
    const shellcheck = read.tools.get('shellcheck')
    assert.equal(shellcheck?.assets.get('darwin-arm64')?.sha256, 'aa')
    assert.equal(shellcheck?.assets.get('linux-x64')?.sha256, 'bb')
  })

  it('writes tools in a stable order, so an upgrade diff reads as a list of versions', () => {
    assert.ok(written.indexOf('[eslint]') < written.indexOf('[shellcheck]'))
  })

  it('refuses a lock written by a different schema', () => {
    assert.throws(() => parseLock('version = 99\n', 'tools.lock'), /this gspot reads 1/u)
  })
})
