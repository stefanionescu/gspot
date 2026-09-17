import assert from 'node:assert/strict'
import { describe, it } from 'bun:test'
import { parsePreset } from '@/settings/preset'
import { manifestWith } from '@tests/support/preset'

describe('parsePreset, refusing a check', () => {
  it('refuses a check that inspects nothing', () => {
    assert.throws(
      () => parsePreset(manifestWith('inspects  = ["syntax"]', 'inspects  = []'), 'test.toml'),
      /declares no inspection/u,
    )
  })

  it('refuses a counting failure mode with no counting pattern', () => {
    assert.throws(
      () => parsePreset(manifestWith('fails_on  = "exit-code"', 'fails_on  = "finding-count"'), 'x.toml'),
      /needs `count_regex`/u,
    )
  })

  it('refuses a warning severity', () => {
    assert.throws(
      () => parsePreset(manifestWith('fails_on  = "exit-code"', 'fails_on  = "warn"'), 'test.toml'),
      /not one of: exit-code, finding-count/u,
    )
  })

  it('refuses a file listing that asks a tool with no command', () => {
    assert.throws(
      () => parsePreset(manifestWith('{ via = "declared" }', '{ via = "check-mode" }'), 'test.toml'),
      /needs `file_list.command`/u,
    )
  })

  it('refuses original code with no search behind it', () => {
    assert.throws(
      () => parsePreset(manifestWith('mechanism = "configured"', 'mechanism = "original"'), 'test.toml'),
      /owes `searched` and `verdict`/u,
    )
  })

  it('accepts original code that names the search and the verdict', () => {
    const justified = manifestWith(
      'mechanism = "configured"',
      'mechanism = "original"\nsearched  = ["shellcheck"]\nverdict   = "No tool counts shell branches."',
    )
    assert.equal(parsePreset(justified, 'test.toml').checks[0]?.mechanism, 'original')
  })

  it('refuses a check that runs at pre-commit and needs a build', () => {
    const impossible = manifestWith('stage     = "pre-commit"', 'stage     = "pre-commit"\nrequires  = ["build"]')
    assert.throws(() => parsePreset(impossible, 'test.toml'), /Stage follows from what a check needs/u)
  })
})
