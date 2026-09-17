import type { Check, Inspection } from 'types/manifest'

import { claimCandidates, requiredFor } from '@/coverage/candidate'

import { explainIgnored, replay, replayListing } from '@/coverage/ignore-replay'

import { statusOf } from '@/coverage/status'

import type { Candidate, Claim, Listing } from 'types/coverage'
import type { ScopeSelection } from 'types/settings'
import type { ClassifyInputs, MeasureInputs, Measurement } from 'types/measure'
import { readAttributes } from '@/coverage/attribute'
import { readCandidates } from '@/coverage/candidate'
import { classifyAll } from '@/coverage/classify'
import { readIgnoreSources } from '@/coverage/ignore-replay'
import { listFiles } from '@/coverage/listing'
import { trackedFiles } from '@/coverage/tracked'
import { coveredPaths } from '@/structure/engine'
import { readRules } from '@/structure/rules'

export async function measure(inputs: MeasureInputs): Promise<Measurement> {
  const tracked = await trackedFiles(inputs.root)
  const paths = tracked.paths.map((entry) => entry.path)
  const candidates = await readCandidates(inputs.root, tracked.paths)
  const trackedSet = new Set(paths)

  const collected = await collectClaims(inputs, candidates, trackedSet, paths)
  const classifications = await classifyAll(paths, await classifyInputs(inputs, paths))

  const statuses = classifications.map((classification) =>
    statusOf({
      classification,
      claims: collected.claims.get(classification.path) ?? [],
      required: requiredOf(inputs.scopes, candidates, classification.path),
      exceptions: inputs.settings.exceptions,
    }),
  )
  return {
    tracked,
    candidates,
    statuses,
    untracked: collected.untracked,
    failures: collected.failures,
    unread: collected.unread,
  }
}

type Collected = {
  readonly claims: ReadonlyMap<string, Claim[]>
  readonly untracked: readonly string[]
  readonly failures: readonly { readonly check: string; readonly reason: string }[]
  readonly unread: ReadonlyMap<string, string>
}

async function collectClaims(
  inputs: MeasureInputs,
  candidates: readonly Candidate[],
  tracked: ReadonlySet<string>,
  paths: readonly string[],
): Promise<Collected> {
  const claims = new Map<string, Claim[]>()
  const untracked: string[] = []
  const failures: { check: string; reason: string }[] = []
  const unread = new Map<string, string>()

  for (const scope of inputs.scopes) {
    const within = candidates.filter((candidate) => inScope(scope.path, candidate.path))
    const claimed = claimCandidates(within, scope.presets).claimed
    for (const preset of scope.presets) {
      const mine = claimed.get(preset.id) ?? []
      if (mine.length === 0) continue
      for (const check of preset.checks) {
        const scoped = scopedTo(mine, check)
        if (scoped.length === 0) continue
        const listing = await listingFor(inputs, check, scoped, tracked, paths)
        record(claims, check, listing, preset.supplies)
        untracked.push(...listing.untracked)
        if (listing.failure !== undefined) failures.push({ check: check.id, reason: listing.failure })
        await recordUnread(unread, inputs, check, listing, paths)
      }
    }
  }

  for (const consumer of inputs.settings.checks) {
    const mine = paths.filter((path) => consumer.paths.matches(path))
    if (mine.length === 0) continue

    const listing = await listingFor(inputs, consumer.check, mine, tracked, paths)
    record(claims, consumer.check, listing, false)
    untracked.push(...listing.untracked)
    if (listing.failure !== undefined) {
      failures.push({ check: consumer.check.id, reason: listing.failure })
    }
    await recordUnread(unread, inputs, consumer.check, listing, paths)
  }
  return { claims, untracked, failures, unread }
}

async function recordUnread(
  unread: Map<string, string>,
  inputs: MeasureInputs,
  check: Check,
  listing: Listing,
  paths: readonly string[],
): Promise<void> {
  if (listing.ignored.length === 0) return
  const names = check.fileList.ignoreFiles ?? []
  const sources = names.length === 0 ? [] : await readIgnoreSources(inputs.root, paths, names)
  for (const path of listing.ignored) {
    const verdict = sources.length === 0 ? null : replay(sources, path)
    unread.set(path, verdict === null ? `skipped by ${check.id}` : explainIgnored(verdict))
  }
}

async function listingFor(
  inputs: MeasureInputs,
  check: Check,
  candidates: readonly string[],
  tracked: ReadonlySet<string>,
  paths: readonly string[],
): Promise<Listing> {
  if (check.builtin !== undefined) return everything(candidates)
  if (check.rules !== undefined) return await engineListing(inputs, check, candidates)
  if (check.fileList.via === 'ignore-replay') {
    const names = check.fileList.ignoreFiles ?? []
    return replayListing(await readIgnoreSources(inputs.root, paths, names), candidates)
  }
  return await listFiles({
    root: inputs.root,
    plan: check.fileList,
    candidates,
    tracked,
    configArgs: inputs.configArgs.get(check.id) ?? [],
    toolErrors: check.toolErrors,
  })
}

function everything(candidates: readonly string[]): Listing {
  return { via: 'file-list', paths: new Set(candidates), untracked: [], ignored: [] }
}

async function engineListing(
  inputs: MeasureInputs,
  check: Check,
  candidates: readonly string[],
): Promise<Listing> {
  const directory = inputs.ruleSets.get(check.id)
  if (directory === undefined) {
    throw new Error(`${check.id}: declares \`rules\` and no directory was resolved for it.`)
  }
  const covered = await coveredPaths(inputs.root, candidates, await readRules(directory))

  return { via: 'file-list', paths: new Set(covered), untracked: [], ignored: [] }
}

function record(
  claims: Map<string, Claim[]>,
  check: Check,
  listing: Listing,
  supplier: boolean,
): void {
  for (const path of listing.paths) {
    const existing = claims.get(path) ?? []
    existing.push({ check: check.id, path, inspects: check.inspects, via: listing.via, supplier })
    claims.set(path, existing)
  }
}

function scopedTo(candidates: readonly string[], check: Check): readonly string[] {
  if (check.paths === undefined) return candidates
  return candidates.filter((path) => check.paths?.matches(path) === true)
}

function inScope(scope: string, path: string): boolean {
  return scope === '' || path.startsWith(`${scope}/`)
}

function requiredOf(
  scopes: readonly ScopeSelection[],
  candidates: readonly Candidate[],
  path: string,
): readonly Inspection[] {
  const candidate = candidates.find((entry) => entry.path === path)
  if (candidate === undefined) return []
  const wanted = new Set<Inspection>()
  for (const scope of scopes) {
    if (!inScope(scope.path, path)) continue
    for (const preset of scope.presets) {
      for (const inspection of requiredFor(preset, candidate) ?? []) {
        wanted.add(inspection as Inspection)
      }
    }
  }
  return [...wanted]
}

async function classifyInputs(
  inputs: MeasureInputs,
  paths: readonly string[],
): Promise<ClassifyInputs> {
  return {
    root: inputs.root,
    declarations: inputs.settings.declarations,
    attributes: await readAttributes(inputs.root, paths),
    frozen: inputs.frozen,
    banners: inputs.banners,
  }
}

export function pathsByCheck(measurement: Measurement): ReadonlyMap<string, readonly string[]> {
  const paths = new Map<string, string[]>()
  for (const status of measurement.statuses) {
    for (const claim of status.claims) {
      const existing = paths.get(claim.check) ?? []
      existing.push(claim.path)
      paths.set(claim.check, existing)
    }
  }
  return paths
}

export function coverageCounts(measurement: Measurement): {
  unchecked: number
  partial: number
  orphan: number
} {
  const count = (status: string): number =>
    measurement.statuses.filter((entry) => entry.status === status).length
  return { unchecked: count('unchecked'), partial: count('partial'), orphan: count('orphan') }
}
