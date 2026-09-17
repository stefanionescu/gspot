import type { Reading } from 'types/detect'
import type { Scope } from 'types/settings'
import type { Answers, Plan, PlanEntry } from 'types/detect'

export function proposeAnswers(reading: Reading): Answers {
  return {
    runner: reading.runner ?? 'mise',
    presets: [...new Set(reading.detection.proposals.filter((proposal) => proposal.scope === '').map((proposal) => proposal.preset))].sort(),
    scopes: scopesFrom(reading),
    ownedTools: reading.existingTools.filter((entry) => entry.ownable).map((entry) => entry.tool),
    declarations: [],

    hooks: reading.hookRunner !== null,

    ci: 'none',
    rules: false,
  }
}

function scopesFrom(reading: Reading): readonly Scope[] {
  return reading.detection.scopes.map((path) => ({
    path,
    presets: [
      ...new Set(
        reading.detection.proposals
          .filter((proposal) => proposal.scope === path)
          .map((proposal) => proposal.preset),
      ),
    ].sort(),
  }))
}

export function planFrom(reading: Reading, answers: Answers): Plan {
  const settings = renderSettings(answers)
  const writes: PlanEntry[] = [
    { path: 'gspot.toml', note: `your policy, ${settings.split('\n').length} lines` },
    { path: '.gspot/', note: 'generated tool configuration and the coverage table' },
  ]
  if (answers.hooks) writes.push({ path: '.gspot/hooks/', note: 'pre-commit, pre-push, commit-msg' })

  const owned = reading.existingTools.filter((entry) => answers.ownedTools.includes(entry.tool))
  const deletes = owned.map((entry) => ({
    path: entry.config,
    note: `${entry.tool} settings carried into gspot.toml`,
  }))
  if (answers.hooks && reading.hookRunner !== null) {
    deletes.push({ path: `${reading.hookRunner}/`, note: 'replaced by .gspot/hooks/' })
  }

  const changes: PlanEntry[] = [{ path: '.gitignore', note: 'append one marked block' }]
  if (answers.runner === 'mise') {
    changes.push({ path: 'mise.toml', note: 'add tool pins. Your own pins are untouched.' })
  }
  for (const path of reading.agentRules) {
    changes.push({ path, note: 'append one marked block. Nothing of yours is read or moved.' })
  }

  const leaveAlone = reading.existingTools
    .filter((entry) => !answers.ownedTools.includes(entry.tool))
    .map((entry) => ({ path: entry.config, note: notOwnedNote(entry.ownable) }))

  return { writes, deletes, changes, leaveAlone, settings }
}

function notOwnedNote(ownable: boolean): string {
  return ownable ? 'you said no; gspot does not drive it' : 'gspot has no equivalent'
}

export function renderSettings(answers: Answers): string {
  const lines = ['version = 1', `runner  = ${JSON.stringify(answers.runner)}`, '']
  lines.push('presets = [', ...answers.presets.map((id) => `  ${JSON.stringify(id)},`), ']', '')
  lines.push('[gate]', `hooks = ${answers.hooks}`, `ci    = ${JSON.stringify(answers.ci)}`, '')
  lines.push('[rules]', `install = ${answers.rules}`)

  for (const scope of answers.scopes) {
    lines.push('', '[[scope]]', `path    = ${JSON.stringify(scope.path)}`)
    lines.push(`presets = [${scope.presets.map((id) => JSON.stringify(id)).join(', ')}]`)
  }
  for (const declaration of answers.declarations) {
    lines.push('', '[[declare]]')
    lines.push(`paths  = [${declaration.paths.map((path) => JSON.stringify(path)).join(', ')}]`)
    lines.push(`reason = ${JSON.stringify(declaration.reason)}`)
  }
  return `${lines.join('\n')}\n`
}

export function describePlan(plan: Plan): readonly string[] {
  const lines: string[] = []
  section(lines, 'write', plan.writes)
  section(lines, 'delete', plan.deletes)
  section(lines, 'change', plan.changes)
  section(lines, 'leave alone', plan.leaveAlone)
  return lines
}

function section(lines: string[], title: string, entries: readonly PlanEntry[]): void {
  if (entries.length === 0) return
  lines.push(title)
  for (const entry of entries) lines.push(`  ${entry.path.padEnd(32)} ${entry.note}`)
  lines.push('')
}
