import { npmPins, pythonPins } from '#cli/tools/pins.ts';
import type { ScopeEntry } from '#cli/repository/scopes.ts';
import { submodulePaths } from '#cli/repository/tracked.ts';
import { xcodeProposal } from '#cli/commands/init/xcode.ts';
import type { RunnerTaskNames } from '#cli/policy/runner.ts';
import type { Proposal } from '#cli/commands/init/propose.ts';
import { noLongerRuns } from '#cli/policy/adoption/collect.ts';
import { openConfinedRoot } from '#cli/platform/filesystem.ts';
import { runnerTaskPlan } from '#cli/lifecycle/runner-tasks.ts';
import type { Manifest } from '#cli/configurations/manifests.ts';
import { ciLintJobs } from '#cli/repository/existing-tooling.ts';
import type { DetectedSetting } from '#cli/commands/init/settings.ts';
import type { ConfigurationReason } from '#cli/commands/init/selection.ts';
import type { CarriedConfiguration } from '#cli/policy/adoption/results.ts';
import { MISE_CONFIG_PATH, misePins, pinnedTwice } from '#cli/tools/mise.ts';
import { DEFAULT_RELEASE_AGE_DAYS, SECONDS_PER_DAY } from '#cli/generation/bun.ts';
import type { InitAnswers, InitPlanInputs, InitSelection } from '#cli/commands/init/types.ts';

// How many values a carried setting holds: the entries of a list or table, or one scalar.
function carriedCount(value: unknown): number {
    if (Array.isArray(value)) return value.length;
    if (typeof value === 'object' && value !== null) return Object.keys(value).length;
    return 1;
}

type InstallSettings = { min_release_age_days?: number; security_scanner?: string };

const CURSOR_RULE = '.cursor/rules/gspot.mdc';
const HOOKS_ROW = {
    path: 'Git-resolved hooks directory',
    note: 'gspot install creates dispatchers; existing executables are retained as .gspot-original siblings; tracked hooks require hook-manager integration',
};

// The settings each scope carries from its own tool configuration files.
function scopeCarriedRows(carried: CarriedConfiguration): TakeoverPlan['carried'] {
    return [...carried.scopes].flatMap(([scope, entry]) =>
        Object.entries(entry.tools).flatMap(([tool, settings]) =>
            Object.entries(settings).map(([key, value]) => ({
                from: `${scope}: ${tool} ${key}`,
                count: Array.isArray(value) ? value.length : 1,
                into: `[[scope]] ${scope}: tools.${tool}.${key}`,
            })),
        ),
    );
}

function carriedRows(carried: CarriedConfiguration): TakeoverPlan['carried'] {
    const rows = [...carried.tools].flatMap(([tool, entries]) => {
        const settings = Object.entries(entries.settings).map(([key, value]) => ({
            from: `${tool} ${key}`,
            count: carriedCount(value),
            into: `tools.${tool}.${key}`,
        }));
        if (entries.ignores.length > 0)
            settings.push({
                from: `${tool} rules turned off`,
                count: entries.ignores.length,
                into: '[[ignore]] entries',
            });
        return settings.filter((row) => row.count > 0);
    });
    return [...rows, ...scopeCarriedRows(carried)];
}

function pointerRows(everySelected: Manifest[]): TakeoverPlan['write'] {
    return everySelected
        .flatMap((manifest) => manifest.configs)
        .map((config) => config.pointer?.path)
        .filter((path) => path !== undefined)
        .map((path) => ({ path, note: 'pointer' }));
}

function runnerRows(
    root: string,
    answers: InitAnswers,
    everySelected: Manifest[],
    names?: RunnerTaskNames,
): TakeoverPlan['change'] {
    const count = Object.keys(npmPins(everySelected, answers.runner)).length;
    const rows: TakeoverPlan['change'] =
        count === 0
            ? []
            : [{ path: '.gspot/package.json', note: `${String(count)} pinned npm tools; matching lockfile` }];
    const python = pythonPins(everySelected).length;
    if (python > 0)
        rows.push({
            path: '.gspot/pyproject.toml',
            note: `${String(python)} pinned Python tools; matching uv.lock and private environment`,
        });
    const tasks = runnerTaskPlan(root, answers.runner, names);
    if (answers.runner === 'mise')
        rows.unshift({
            path: MISE_CONFIG_PATH,
            note: `${String(misePins(everySelected, count > 0).length)} tool pins, ${String(tasks.tasks.length)} tasks`,
        });
    const configuration = tasks.configuration;
    if (configuration !== undefined)
        rows.push(
            ...configuration.changes.map((field) => ({
                path: configuration.path,
                note: `task ${String(field.path[1])}: ${String(field.value)}`,
            })),
        );
    rows.push(...tasks.notes.map((note) => ({ path: 'runner', note })));
    return rows;
}

// The install settings a bunfig.toml carries into the policy: the release age floor and the security scanner.
function bunfigSettings(text: string): InstallSettings {
    const document = Bun.TOML.parse(text) as Record<string, unknown>;
    const install = document['install'] as Record<string, unknown> | undefined;
    const age = install?.['minimumReleaseAge'];
    const scanner = (install?.['security'] as Record<string, unknown> | undefined)?.['scanner'];
    return {
        ...(typeof age === 'number'
            ? { min_release_age_days: Math.max(DEFAULT_RELEASE_AGE_DAYS, age / SECONDS_PER_DAY) }
            : {}),
        ...(typeof scanner === 'string' ? { security_scanner: scanner } : {}),
    };
}

// Records the install settings of one scope, merged over what the scope already carries.
function carryInstallSettings(carried: CarriedConfiguration, path: string, settings: InstallSettings): void {
    if (path === '') {
        const existing = carried.tools.get('install');
        carried.tools.set('install', {
            settings: { ...existing?.settings, ...settings },
            ignores: existing?.ignores ?? [],
        });
        return;
    }
    const scope = carried.scopes.get(path) ?? { configurations: [], tools: {} };
    scope.tools['install'] = { ...scope.tools['install'], ...settings };
    carried.scopes.set(path, scope);
}

// Carries the install settings of every scope's bunfig.toml into the proposal.
function carryBunfigSettings(root: string, selection: InitSelection, carried: CarriedConfiguration): void {
    const files = openConfinedRoot(root);
    try {
        for (const path of new Set(['', ...selection.scopes.map((scope) => scope.path)])) {
            const source = files.read(path === '' ? 'bunfig.toml' : `${path}/bunfig.toml`);
            if (source === undefined) continue;
            const settings = bunfigSettings(source.bytes.toString('utf8'));
            if (Object.keys(settings).length > 0) carryInstallSettings(carried, path, settings);
        }
    } finally {
        files.close();
    }
}

// The commit scopes a scoped repository with the commits configuration accepts, or undefined for none.
function commitScopeNames(scopes: ScopeEntry[], selection: InitSelection): string[] | undefined {
    if (scopes.length === 0 || !selection.selectedIds.has('commits')) return undefined;
    return [...scopes.map((scope) => scope.name), 'root', 'hooks', 'deps'];
}

// The Xcode project proposal, when the selection includes Xcode.
function xcodeRow(root: string, selection: InitSelection): ReturnType<typeof xcodeProposal> | undefined {
    if (!selection.selectedIds.has('xcode')) return undefined;
    return xcodeProposal(
        root,
        selection.scopes.map((scope) => scope.path),
    );
}

// The agent instruction files init writes, when any agent is configured.
function agentRows(agents: string[]): TakeoverPlan['write'] {
    if (agents.length === 0) return [];
    const files = agents.map((path) => ({
        path,
        note: path === CURSOR_RULE ? 'owned Cursor rule; authored files preserved' : 'managed instruction block',
    }));
    return [...files, { path: '.gspot/rules/', note: 'agent rule files' }];
}

// The CI workflow init writes for the chosen host.
function ciRows(ci: InitAnswers['ci']): TakeoverPlan['write'] {
    if (ci === 'none') return [];
    if (ci === 'github') return [{ path: '.github/workflows/gspot.yml', note: 'check workflow' }];
    return [{ path: '.gitlab/ci/gspot.yml', note: 'add include: [{ local: .gitlab/ci/gspot.yml }] to .gitlab-ci.yml' }];
}

// The CI files init leaves alone: every one when no workflow is written, and every existing lint job.
function retainedCiRows(ci: InitAnswers['ci'], ciFiles: string[], lintJobs: string[]): TakeoverPlan['retained'] {
    const untouched =
        ci === 'none' && lintJobs.length === 0
            ? ciFiles.map((path) => ({
                  path,
                  note: 'CI retained; add commands to install the pinned gspot version, gspot install, and gspot check',
              }))
            : [];
    const jobs = lintJobs.map((path) => ({ path, note: 'existing lint job retained; no duplicate CI job proposed' }));
    return [...untouched, ...jobs];
}

/**
 * Builds the proposal gspot.toml is rendered from.
 * @param root the repository root
 * @param selection what init selected
 * @param answers the answers to the init questions
 * @param carried the lists carried from old configuration files
 * @param detected the settings init filled from the repository
 * @returns the proposal
 */
export function buildProposal(
    root: string,
    selection: InitSelection,
    answers: InitAnswers,
    carried: CarriedConfiguration,
    detected: DetectedSetting[] = [],
): Proposal {
    if (selection.selectedIds.has('dependencies')) carryBunfigSettings(root, selection, carried);
    const scopes: ScopeEntry[] = selection.scopes.filter((scope) => scope.path !== '');
    const commitScopes = commitScopeNames(scopes, selection);
    const xcode = xcodeRow(root, selection);
    return {
        configurations: selection.rootIds,
        scopes: scopes.map((scope) => ({
            path: scope.path,
            configurations: selection.scopeProposals.get(scope.path) ?? [],
        })),
        carried,
        hooks: answers.hooks,
        ci: answers.ci,
        rules: answers.isRules,
        runner: answers.runner,
        ...(answers.formatter === undefined ? {} : { formatter: answers.formatter }),
        ...(commitScopes ? { commitScopes } : {}),
        ...(xcode ? { xcode } : {}),
        ...(detected.length === 0 ? {} : { detected }),
    };
}

/**
 * Builds the plan init prints before asking to continue.
 * @param inputs the root, the tooling found, every selected manifest, the answers, the carried lists and the policy line count
 * @returns the plan
 */
export function buildInitPlan(inputs: InitPlanInputs): TakeoverPlan {
    const { root, tooling, everySelected, how, answers, carried, policyLines, profile } = inputs;
    const lintJobs = ciLintJobs(root, tooling.ci);
    return {
        ...(profile ? { profile } : {}),
        configurations: everySelected.map((manifest) => ({
            configuration: manifest.configuration.name,
            how: how.get(manifest.configuration.name) ?? 'required',
            checks: manifest.checks.length,
        })),
        write: [
            { path: 'gspot.toml', note: `your policy, ${String(policyLines)} lines` },
            { path: '.gspot/', note: 'generated configuration and version pin' },
            ...pointerRows(everySelected),
            ...agentRows(inputs.agents),
            ...ciRows(answers.ci),
        ],
        remove: carried.removed,
        unread: carried.unread,
        retained: [
            ...carried.retained,
            ...submodulePaths(root).map((path) => ({ path, note: 'submodule; contents are not read' })),
            ...retainedCiRows(answers.ci, tooling.ci, lintJobs),
        ],
        carried: carriedRows(carried),
        change: [
            { path: '.gitignore', note: 'one managed block' },
            { path: '.gitattributes', note: 'managed generated-file classification and LF line endings' },
            ...runnerRows(root, answers, everySelected, inputs.runnerTasks),
            ...(answers.hooks === 'gspot' ? [HOOKS_ROW] : []),
        ],
        noLongerRuns: noLongerRuns(tooling, pinnedTwice(root, everySelected)),
        ignores: [...carried.tools.values()].flatMap((tool) => tool.ignores),
    };
}

export type TakeoverPlan = {
    profile?: { name: string; digest: string; selection: string; detected: string[] };
    configurations: { configuration: string; how: ConfigurationReason; checks: number }[];
    write: { path: string; note: string }[];
    remove: { path: string; note: string }[];
    unread: { path: string; note: string }[];
    retained: { path: string; note: string }[];
    carried: { from: string; count: number; into: string }[];
    change: { path: string; note: string }[];
    noLongerRuns: { path: string; note: string }[];
    ignores: { check: string; rule?: string; reason: string }[];
};
