import assert from 'node:assert/strict'
import { describe, it } from 'bun:test'
import { assetUrl } from '@/toolchain/lock'

describe('assetUrl', () => {
  it('fills the version, the platform and the architecture', () => {
    const url = assetUrl('https://x.invalid/v{version}/tool-{os}-{arch}.tgz', '1.2.3', 'darwin-arm64')
    assert.equal(url, 'https://x.invalid/v1.2.3/tool-darwin-arm64.tgz')
  })
})
