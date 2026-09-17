import { CANONICAL_TASKS } from '@config/tasks'
import type { Check, Preset, Stage, TaskNode } from 'types/manifest'
import type { ConsumerCheck, ScopeSelection } from 'types/settings'
import type { GraphNode } from 'types/run'

export function buildGraph(
  scopes: readonly ScopeSelection[],
  stage: Stage | null,
  consumers: readonly ConsumerCheck[] = [],
): readonly GraphNode[] {
  const nodes = new Map<string, GraphNode>()
  for (const scope of scopes) {
    for (const preset of scope.presets) {
      for (const task of preset.tasks) {
        merge(nodes, scope, preset, task, stage)
      }
    }
  }
  addConsumers(nodes, consumers, stage)
  return [...nodes.values()]
}

function addConsumers(
  nodes: Map<string, GraphNode>,
  consumers: readonly ConsumerCheck[],
  stage: Stage | null,
): void {
  const wanted = consumers.map((entry) => entry.check).filter((check) => runsAt(check, stage))
  if (wanted.length === 0) return

  const existing = nodes.get('check@')
  const seen = new Set(existing?.checks.map((check) => check.id) ?? [])
  nodes.set('check@', {
    name: 'check',
    scope: '',
    description: existing?.description ?? 'Every check, including the ones this repository wrote',
    checks: [...(existing?.checks ?? []), ...wanted.filter((check) => !seen.has(check.id))],
    deps: existing?.deps ?? [],
  })
}

function merge(
  nodes: Map<string, GraphNode>,
  scope: ScopeSelection,
  preset: Preset,
  task: TaskNode,
  stage: Stage | null,
): void {
  const at = task.scope === 'repo' ? '' : scope.path
  const identity = `${task.name}@${at}`
  const wanted = preset.checks.filter(
    (check) => task.checks.includes(check.id) && runsAt(check, stage),
  )
  if (wanted.length === 0) return

  const existing = nodes.get(identity)
  const seen = new Set(existing?.checks.map((check) => check.id) ?? [])
  nodes.set(identity, {
    name: task.name,
    scope: at,
    description: existing?.description ?? task.description,
    checks: [...(existing?.checks ?? []), ...wanted.filter((check) => !seen.has(check.id))],
    deps: [...new Set([...(existing?.deps ?? []), ...task.deps])],
  })
}

export function runsAt(check: Check, stage: Stage | null): boolean {
  if (stage === null) return check.stage !== 'commit-msg'
  switch (stage) {
    case 'pre-commit':
      return check.stage === 'pre-commit'
    case 'commit-msg':
      return check.stage === 'commit-msg'
    case 'pre-push':
    case 'ci':
      return check.stage !== 'commit-msg' && check.stage !== 'release'
    case 'release':
      return check.stage !== 'commit-msg'
  }
}

export function waves(nodes: readonly GraphNode[]): readonly (readonly GraphNode[])[] {
  const remaining = new Map(nodes.map((node) => [node.name, node]))
  const done = new Set<string>()
  const ordered: GraphNode[][] = []

  while (remaining.size > 0) {
    const ready = [...remaining.values()].filter((node) =>
      node.deps.every((name) => done.has(name) || !remaining.has(name)),
    )
    if (ready.length === 0) throw cycle([...remaining.values()])
    for (const node of ready) {
      remaining.delete(node.name)
      done.add(node.name)
    }
    ordered.push(ready)
  }
  return ordered
}

function cycle(stuck: readonly GraphNode[]): Error {
  const names = stuck.map((node) => node.name).join(', ')
  return new Error(`tasks depend on each other in a circle: ${names}.`)
}

export function checksIn(nodes: readonly GraphNode[]): ReadonlySet<string> {
  return new Set(nodes.flatMap((node) => node.checks.map((check) => check.id)))
}

export function collisions(theirs: readonly string[]): readonly string[] {
  return theirs.filter((name) => CANONICAL_TASKS.includes(name))
}
