import assert from 'node:assert/strict'
import { describe, it } from 'bun:test'
import { listFiles } from '@/coverage/listing'
import type { ToolError } from 'types/manifest'

const BROKE: readonly ToolError[] = [
  { regex: 'Error loading config', message: 'The tool could not read its configuration.' },
]

const CANDIDATES = ['sql/schema.sql', 'sql/rls.sql']
const TRACKED = new Set(CANDIDATES)

describe('listFiles, in check mode', () => {
  it('keeps what the tool was handed, minus what it says it skipped', async () => {
    const listing = await listFiles({
      root: process.cwd(),
      plan: {
        via: 'check-mode',
        command: ['printf', 'path sql/rls.sql was ignored\\n'],
        ignoredRegex: 'path (\\S+) was ignored',
      },
      candidates: CANDIDATES,
      tracked: TRACKED,
      configArgs: [],
      toolErrors: BROKE,
    })
    assert.deepEqual([...listing.paths], ['sql/schema.sql'])
    assert.deepEqual(listing.ignored, ['sql/rls.sql'])
  })

  it('claims nothing when the output matches a pattern meaning the tool broke', async () => {
    const listing = await listFiles({
      root: process.cwd(),
      plan: { via: 'check-mode', command: ['printf', 'Error loading config\\n'] },
      candidates: CANDIDATES,
      tracked: TRACKED,
      configArgs: [],
      toolErrors: BROKE,
    })
    assert.equal(listing.paths.size, 0)
    assert.match(listing.failure ?? '', /could not read its configuration/u)
  })
})
