import assert from 'node:assert/strict'
import { describe, it } from 'bun:test'
import { MINIMAL_PRESET } from '@config/tests/manifests'
import { parsePreset } from '@/settings/preset'
import { manifestWith } from '@tests/support/preset'

function rulesCheck(directory: string): string {
  return MINIMAL_PRESET.replace('command   = ["bash", "-n"]', `rules = "${directory}"`)
    .replace('file_list = { via = "declared" }', 'file_list = { via = "file-list" }')
    .replace('fails_on  = "exit-code"', 'fails_on = "finding-count"')
}

describe('parsePreset, reading a manifest', () => {
  it('accepts a check that runs gspot\'s own rule engine, with no command and no count regex', () => {
    const preset = parsePreset(rulesCheck('rules'), 'test.toml')
    const check = preset.checks[0]
    assert.equal(check?.rules, 'rules')
    assert.equal(check?.command, undefined)
    assert.equal(check?.fileList.via, 'file-list')
  })
})

describe('parsePreset, reading a path scope', () => {
  it('compiles a check\'s own paths, keeping the patterns for a message that names them', () => {
    const scoped = manifestWith(
      'file_list = { via = "declared" }',
      'paths = ["**/*.sh", "!**/vendor/**"]\nfile_list = { via = "declared" }',
    )
    const check = parsePreset(scoped, 'test.toml').checks[0]
    assert.equal(check?.paths?.matches('ops/run.sh'), true)
    assert.equal(check?.paths?.matches('vendor/run.sh'), false)
    assert.deepEqual(check?.paths?.patterns, ['**/*.sh', '!**/vendor/**'])
  })
})

describe('parsePreset, refusing a manifest', () => {
  it('refuses an id that does not name its kind', () => {
    assert.throws(
      () => parsePreset(manifestWith('"language:bash"', '"bash"'), 'test.toml'),
      /does not name its kind/u,
    )
  })

  it('refuses a claimed extension that requires nothing of itself', () => {
    const silent = MINIMAL_PRESET.replace('".sh" = ["syntax", "spelling"]', '')
    assert.throws(() => parsePreset(silent, 'test.toml'), /requires nothing of it/u)
  })

  it('lets a supplier claim an extension it requires nothing of, because it owns none', () => {
    const supplier = MINIMAL_PRESET.replace('".sh" = ["syntax", "spelling"]', '').replace(
      'kind  = "language"',
      'kind  = "language"\nsupplies = true',
    )
    assert.equal(parsePreset(supplier, 'test.toml').supplies, true)
  })

  it('refuses a supplier that also requires an inspection, which is what owning is', () => {
    assert.throws(
      () => parsePreset(manifestWith('kind  = "language"', 'kind  = "language"\nsupplies = true'), 'test.toml'),
      /declares `supplies = true` and a \[required\] table/u,
    )
  })

  it('refuses a check that no task runs', () => {
    assert.throws(
      () => parsePreset(manifestWith('checks = ["sh/syntax"]', 'checks = []'), 'test.toml'),
      /is in no task, so nothing ever runs it/u,
    )
  })

  it('refuses a check that names no implementation at all', () => {
    assert.throws(
      () => parsePreset(manifestWith('command   = ["bash", "-n"]', ''), 'test.toml'),
      /declares none of `command`, `rules` or `builtin`/u,
    )
  })

  it('refuses a check that names two, which would be two implementations of one id', () => {
    assert.throws(
      () => parsePreset(manifestWith('fails_on  = "exit-code"', 'fails_on = "exit-code"\nrules = "rules"'), 'test.toml'),
      /declares command and rules/u,
    )
  })

  it('refuses a builtin that is not one of gspot\'s own analyses', () => {
    assert.throws(
      () => parsePreset(manifestWith('command   = ["bash", "-n"]', 'builtin = "guesswork"'), 'test.toml'),
      /is not one of gspot's own analyses/u,
    )
  })

  it('refuses a rule set outside the preset, which is a product path', () => {
    assert.throws(
      () => parsePreset(rulesCheck('../../elsewhere'), 'test.toml'),
      /reaches outside the preset/u,
    )
  })

  it('refuses a rule set whose file listing asks a tool about a check gspot runs itself', () => {
    assert.throws(
      () => parsePreset(rulesCheck('rules').replace('via = "file-list"', 'via = "declared"'), 'test.toml'),
      /reports the paths it read/u,
    )
  })

  it('refuses a task naming a check that does not exist', () => {
    assert.throws(
      () => parsePreset(manifestWith('checks = ["sh/syntax"]', 'checks = ["sh/typo"]'), 'test.toml'),
      /which is not a check here/u,
    )
  })
})
