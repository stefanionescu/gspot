import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, it } from 'bun:test'
import { UNTOUCHED } from '@config/tests/repositories'
import { runInit } from '@/commands/init'
import { parseSettings } from '@/settings/document'
import { configOf, removeRepository, plant, PRESETS } from '@tests/support/repository'
import type { InitOutcome } from 'types/commands'

const OPTIONS = { presetsRoot: PRESETS, version: '0.1.0', yes: true, interactive: false }

describe('runInit', () => {
  let root = ''
  let outcome: InitOutcome

  beforeAll(async () => {
    root = await plant('init', UNTOUCHED)
    outcome = await runInit({ ...OPTIONS, cwd: root, flags: { hooks: true } })
  })

  afterAll(async () => {
    await removeRepository(root)
  })

  it('proposes the languages the tree holds, reaching a script with no extension', () => {
    const proposed = parseSettings(outcome.plan?.settings ?? '', 'proposed').presets
    assert.deepEqual([...proposed].sort(), ['language:bash', 'language:sql'])
  })

  it('writes a settings file gspot reads back', async () => {
    const written = parseSettings(await readFile(join(root, 'gspot.toml'), 'utf8'), 'gspot.toml')
    assert.equal(written.version, 1)
    assert.equal(written.runner, 'mise')
  })

  it('renders the configuration the claimed tools read', async () => {
    const rendered = await readFile(join(root, '.gspot/generated/sqlfluff.cfg'), 'utf8')
    assert.match(rendered, /sql_file_exts = \.sql,\.pgsql,\.psql/u)
  })

  it('deletes the second configuration for a tool it now drives', async () => {
    assert.ok(outcome.plan?.deletes.some((entry) => entry.path === '.prettierrc.json'))
    assert.equal(await Bun.file(join(root, '.prettierrc.json')).exists(), false)
  })

  it('appends to an existing agent index without moving anything already there', async () => {
    const written = await readFile(join(root, 'CLAUDE.md'), 'utf8')
    assert.ok(written.startsWith(UNTOUCHED['CLAUDE.md'] ?? ''))
    assert.match(written, /gspot managed/u)
  })

  it('installs hooks that call gspot, and points git at them', async () => {
    const hook = await readFile(join(root, '.gspot/hooks/pre-commit'), 'utf8')
    assert.match(hook, /exec gspot check --stage pre-commit/u)
    assert.equal(await configOf(root, 'core.hooksPath'), '.gspot/hooks')
  })

  it('refuses to run twice, and says where to go instead', async () => {
    const again = await runInit({ ...OPTIONS, cwd: root, flags: {} })
    assert.equal(again.code, 2)
    assert.match(again.lines.join('\n'), /already exists[\s\S]*gspot doctor/u)
  })
})
