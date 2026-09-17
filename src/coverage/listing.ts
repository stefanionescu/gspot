import { isAbsolute, relative } from 'node:path'

import type { FileListMechanism, FileListPlan, ToolError } from 'types/manifest'
import type { Listing } from 'types/coverage'

import { describe as describeAnswer, invoke } from '@/run/invoke'

export type ListingRequest = {
  readonly root: string
  readonly plan: FileListPlan

  readonly candidates: readonly string[]

  readonly tracked: ReadonlySet<string>
  readonly configArgs: readonly string[]

  readonly toolErrors: readonly ToolError[]
}

export async function listFiles(request: ListingRequest): Promise<Listing> {
  switch (request.plan.via) {
    case 'declared':
      return asserted(request)
    case 'print-config':
      return await perCandidate(request)
    case 'file-list':
    case 'project-graph':
      return await reported(request)
    case 'check-mode':
      return await handed(request)
    case 'ignore-replay':
      throw new Error('ignore-replay listings are produced by the replay, not by asking a tool')
  }
}

function asserted(request: ListingRequest): Listing {
  return { via: 'declared', paths: new Set(request.candidates), untracked: [], ignored: [] }
}

async function reported(request: ListingRequest): Promise<Listing> {
  const answer = await run(request, request.candidates)
  if (answer.failure !== undefined) return failed(request.plan.via, answer.failure)

  const paths = new Set<string>()
  const untracked: string[] = []
  for (const line of answer.output.split('\n')) {
    const path = pathIn(line, request)
    if (path === null) continue
    if (request.tracked.has(path)) paths.add(path)
    else untracked.push(path)
  }
  return { via: request.plan.via, paths, untracked, ignored: ignoredIn(answer.output, request) }
}

async function handed(request: ListingRequest): Promise<Listing> {
  const answer = await run(request, request.candidates)
  if (answer.failure !== undefined) return failed('check-mode', answer.failure)
  const ignored = ignoredIn(answer.output, request)
  const skipped = new Set(ignored)
  const paths = new Set(request.candidates.filter((path) => !skipped.has(path)))
  return { via: 'check-mode', paths, untracked: [], ignored }
}

async function perCandidate(request: ListingRequest): Promise<Listing> {
  const paths = new Set<string>()
  for (const candidate of request.candidates) {
    const answer = await invoke({
      command: [...command(request), ...request.configArgs, candidate],
      cwd: request.root,
    })
    if (answer.outcome === 'missing') return failed('print-config', describeAnswer(answer))
    if (answer.outcome === 'ran' && answer.code === 0) paths.add(candidate)
  }
  return { via: 'print-config', paths, untracked: [], ignored: [] }
}

type Output = { readonly output: string; readonly failure?: string }

async function run(request: ListingRequest, paths: readonly string[]): Promise<Output> {
  const answer = await invoke({
    command: [...command(request), ...request.configArgs, ...paths],
    cwd: request.root,
  })
  if (answer.outcome !== 'ran') return { output: '', failure: describeAnswer(answer) }
  const output = `${answer.stdout}\n${answer.stderr}`
  const broke = brokenBy(request, output)
  return broke === null ? { output } : { output, failure: broke }
}

function brokenBy(request: ListingRequest, output: string): string | null {
  for (const toolError of request.toolErrors) {
    if (new RegExp(toolError.regex, 'u').test(output)) return toolError.message.trim()
  }
  return null
}

function command(request: ListingRequest): readonly string[] {
  const declared = request.plan.command
  if (declared === undefined || declared.length === 0) {
    throw new Error(`a ${request.plan.via} file listing needs a command`)
  }
  return declared
}

function pathIn(line: string, request: ListingRequest): string | null {
  const text = line.trim()
  if (text.length === 0) return null
  const pattern = request.plan.pathRegex
  if (pattern === undefined) return withinRoot(text, request.root)
  const found = new RegExp(pattern, 'u').exec(text)?.[1]
  return found === undefined ? null : withinRoot(found, request.root)
}

function ignoredIn(output: string, request: ListingRequest): readonly string[] {
  const pattern = request.plan.ignoredRegex
  if (pattern === undefined) return []
  const ignored: string[] = []
  for (const line of output.split('\n')) {
    const found = new RegExp(pattern, 'u').exec(line.trim())?.[1]
    if (found === undefined) continue
    const path = withinRoot(found, request.root)
    if (path !== null) ignored.push(path)
  }
  return ignored
}

function withinRoot(candidate: string, root: string): string | null {
  const path = isAbsolute(candidate) ? relative(root, candidate) : candidate
  return path.startsWith('..') || isAbsolute(path) || path.length === 0 ? null : path
}

function failed(via: FileListMechanism, failure: string): Listing {
  return { via, paths: new Set(), untracked: [], ignored: [], failure }
}
