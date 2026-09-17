import assert from 'node:assert/strict'
import { describe, it } from 'bun:test'
import { MINIMAL_PRESET } from '@config/tests/manifests'
import { parsePreset } from '@/settings/preset'

function withConfig(readers: string, template = 'configs/shellcheckrc.tmpl'): string {
  return `${MINIMAL_PRESET}
[[configs]]
target   = ".gspot/generated/shellcheckrc"
template = "${template}"
readers  = ${readers}
`
}

describe('parsePreset, refusing a configuration artifact', () => {
  it('refuses one with no reader', () => {
    assert.throws(() => parsePreset(withConfig('[]'), 'test.toml'), /names no reader, so nothing opens it/u)
  })

  it('refuses one whose reader is not a check here', () => {
    assert.throws(() => parsePreset(withConfig('["sh/shellcheck"]'), 'x.toml'), /not a check here/u)
  })

  it('refuses a template that reaches outside the preset', () => {
    assert.throws(
      () => parsePreset(withConfig('["sh/syntax"]', '../../api/docker-compose.yml'), 'test.toml'),
      /reaches outside the preset/u,
    )
  })
})
