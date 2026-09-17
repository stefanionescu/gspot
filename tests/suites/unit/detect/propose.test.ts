import assert from 'node:assert/strict'
import { describe, it } from 'bun:test'
import { claimingPreset, presetOf } from '@config/tests/manifests'
import { extensionOf } from '@/detect/extension'
import { detect } from '@/detect/propose'
import { available, presetFrom } from '@tests/support/preset'
import type { Candidate } from 'types/coverage'
import type { Manifest } from 'types/detect'

function candidate(path: string, interpreter: string | null = null): Candidate {
  return { path, extension: extensionOf(path), interpreter }
}

function manifest(path: string, dependencies: string[]): Manifest {
  const cut = path.lastIndexOf('/')
  return {
    path,
    name: 'package.json',
    directory: cut === -1 ? '' : path.slice(0, cut),
    dependencies,
    tables: [],
  }
}

const AVAILABLE = available(
  presetFrom(claimingPreset('language:sql', 'language', '.sql'), 'sql.toml'),
  presetFrom(presetOf('framework:express', 'framework'), 'express.toml'),
)

describe('detect', () => {
  it('proposes a language preset from the files that are there', () => {
    const found = detect({
      tracked: ['anywhere/at/all/schema.sql'],
      candidates: [candidate('anywhere/at/all/schema.sql')],
      manifests: [],
      available: AVAILABLE,
    })
    assert.ok(found.proposals.some((proposal) => proposal.preset === 'language:sql'))
  })

  it('proposes a framework from a dependency, naming the manifest it read', () => {
    const found = detect({
      tracked: ['api/package.json'],
      candidates: [],
      manifests: [manifest('api/package.json', ['express'])],
      available: AVAILABLE,
    })
    const express = found.proposals.find((proposal) => proposal.preset === 'framework:express')
    assert.equal(express?.scope, 'api')
    assert.match(express?.evidence ?? '', /api\/package\.json: express/u)
  })

  it('proposes nothing for a preset the distribution does not ship', () => {
    const found = detect({
      tracked: ['package.json'],
      candidates: [],
      manifests: [manifest('package.json', ['next'])],
      available: AVAILABLE,
    })
    assert.equal(found.proposals.some((proposal) => proposal.preset === 'framework:nextjs'), false)
  })

  it('takes scopes from where manifests are, not from a folder name', () => {
    const found = detect({
      tracked: ['api/package.json', 'web/package.json', 'package.json'],
      candidates: [],
      manifests: [
        manifest('api/package.json', []),
        manifest('web/package.json', []),
        manifest('package.json', []),
      ],
      available: AVAILABLE,
    })
    assert.deepEqual(found.scopes, ['api', 'web'])
  })

  it('reports an extension nothing proposed claims', () => {
    const found = detect({
      tracked: ['a.sql', 'b.rs', 'c.rs'],
      candidates: [candidate('a.sql'), candidate('b.rs'), candidate('c.rs')],
      manifests: [],
      available: AVAILABLE,
    })
    assert.deepEqual(found.unclaimed, [{ extension: '.rs', count: 2 }])
  })

  it('reports a file with no extension that nothing claims', () => {
    const found = detect({
      tracked: ['Makefile'],
      candidates: [candidate('Makefile')],
      manifests: [],
      available: AVAILABLE,
    })
    assert.deepEqual(found.unclaimed, [{ extension: '(no extension)', count: 1 }])
  })

  it('counts extensions most first, which is the order init prints', () => {
    const found = detect({
      tracked: [],
      candidates: [candidate('a.sql'), candidate('b.sql'), candidate('c.md')],
      manifests: [],
      available: AVAILABLE,
    })
    assert.deepEqual([...found.extensions], [['.sql', 2], ['.md', 1]])
  })
})
