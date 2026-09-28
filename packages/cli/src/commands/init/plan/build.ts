import type { Manifest } from '#cli/types/kits.ts';
import { openRoot } from '#cli/platform/filesystem.ts';
import { xcodePlan } from '#cli/commands/init/xcode.ts';
import { agentFiles } from '#cli/agents/instructions.ts';
import { npmPins, pythonPins } from '#cli/tools/pins.ts';
import { misePins, pinnedTwice } from '#cli/tools/mise.ts';
import { submodulePaths } from '#cli/repository/tracked.ts';
import { MISE_CONFIG_PATH } from '#cli/config/tools/tools.ts';
import { noLongerRuns } from '#cli/policy/adoption/collect.ts';
import { runnerTaskPlan } from '#cli/generation/runner/plan.ts';
import { ciLintJobs } from '#cli/repository/existing-tooling.ts';
import type { AdoptionResult } from '#cli/types/policy/adoption.ts';
import type { ScopeEntry } from '#cli/types/repository/repository.ts';
import type { Policy, RunnerTaskNames } from '#cli/types/policy/policy.ts';
import { CI_SETUP, HOOKS_ROW, CURSOR_RULE } from '#cli/config/commands/init.ts';
import { SECONDS_PER_DAY, DEFAULT_RELEASE_AGE_DAYS } from '#cli/config/generation.ts';

import type {
    Planning,
    InitAnswers,
    ReplacePlan,
    InitSelection,
    DetectedSetting,
    InstallSettings,
    InitPlan as Plan,
} from '#cli/types/commands/init.ts';

// How many values a carried setting holds: the entries of a list or table, or one scalar.
function carriedCount(value: unknown): number {
    if (Array.isArray(value)) return value.length;
    if (typeof value === 'object' && value !== null) return Object.keys(value).length;
    return 1;
}

function carriedRows(kept: AdoptionResult): ReplacePlan['kept'] {
    const rows = [...kept.tools].flatMap(([tool, entries]) => {
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
    const scopeSettings = [...kept.scopes].flatMap(([scope, entry]) =>
        Object.entries(entry.tools).flatMap(([tool, settings]) =>
            Object.entries(settings).map(([key, value]) => ({
                from: `${scope}: ${tool} ${key}`,
                count: Array.isArray(value) ? value.length : 1,
                into: `[[scope]] ${scope}: tools.${tool}.${key}`,
            })),
        ),
    );
    return [...rows, ...scopeSettings];
}

function runnerRows(
    root: string,
    answers: InitAnswers,
    everySelected: Manifest[],
    names?: RunnerTaskNames,
): ReplacePlan['change'] {
    const count = Object.keys(npmPins(everySelected, answers.runner)).length;
    const rows: ReplacePlan['change'] =
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
function carryInstallSettings(kept: AdoptionResult, path: string, settings: InstallSettings): void {
    if (path === '') {
        const existing = kept.tools.get('install');
        kept.tools.set('install', {
            settings: { ...existing?.settings, ...settings },
            ignores: existing?.ignores ?? [],
        });
        return;
    }
    const scope = kept.scopes.get(path) ?? { kits: [], tools: {} };
    scope.tools['install'] = { ...scope.tools['install'], ...settings };
    kept.scopes.set(path, scope);
}

// Carries the install settings of every scope's bunfig.toml into the plan.
function carryBunfigSettings(root: string, selection: InitSelection, kept: AdoptionResult): void {
    const files = openRoot(root);
    try {
        for (const path of new Set(['', ...selection.scopes.map((scope) => scope.path)])) {
            const source = files.read(path === '' ? 'bunfig.toml' : `${path}/bunfig.toml`);
            if (source === undefined) continue;
            const settings = bunfigSettings(source.bytes.toString('utf8'));
            if (Object.keys(settings).length > 0) carryInstallSettings(kept, path, settings);
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

// The Xcode project plan, when the selection includes Xcode.
function xcodeRow(root: string, selection: InitSelection): ReturnType<typeof xcodePlan> | undefined {
    if (!selection.selectedIds.has('xcode')) return undefined;
    return xcodePlan(
        root,
        selection.scopes.map((scope) => scope.path),
    );
}

// The agent instruction files init writes, when any agent is configured.
function agentRows(agents: string[]): ReplacePlan['write'] {
    if (agents.length === 0) return [];
    const files = agents.map((path) => ({
        path,
        note: path === CURSOR_RULE ? 'owned Cursor rule; authored files preserved' : 'managed instruction block',
    }));
    return [...files, { path: '.gspot/guides/', note: 'agent guides' }];
}

// The CI workflow init writes for the chosen host.
function ciRows(ci: InitAnswers['ci']): ReplacePlan['write'] {
    if (ci === 'none') return [];
    if (ci === 'github') return [{ path: '.github/workflows/gspot.yml', note: 'check workflow' }];
    return [{ path: '.gitlab/ci/gspot.yml', note: 'add include: [{ local: .gitlab/ci/gspot.yml }] to .gitlab-ci.yml' }];
}

// The CI files init leaves alone: every one when no workflow is written, and every existing lint job.
function retainedCiRows(ci: InitAnswers['ci'], ciFiles: string[], lintJobs: string[]): ReplacePlan['retained'] {
    const untouched =
        ci === 'none' && lintJobs.length === 0
            ? ciFiles.map((path) => ({
                  path,
                  note: 'CI retained; add the setup commands listed below',
              }))
            : [];
    const jobs = lintJobs.map((path) => ({ path, note: 'existing lint job retained; no duplicate CI job proposed' }));
    return [...untouched, ...jobs];
}

/**
 * Builds the plan gspot.toml is rendered from.
 * @param root the repository root
 * @param selection what init selected
 * @param answers the answers to the init questions
 * @param kept the lists kept from old configuration files
 * @param detected the settings init filled from the repository
 * @returns the plan
 */
export function plan(
    root: string,
    selection: InitSelection,
    answers: InitAnswers,
    kept: AdoptionResult,
    detected: DetectedSetting[] = [],
): Plan {
    if (selection.selectedIds.has('dependencies')) carryBunfigSettings(root, selection, kept);
    const scopes: ScopeEntry[] = selection.scopes.filter((scope) => scope.path !== '');
    const commitScopes = commitScopeNames(scopes, selection);
    const xcode = xcodeRow(root, selection);
    return {
        kits: selection.rootIds,
        scopes: scopes.map((scope) => ({
            path: scope.path,
            kits: selection.scopePlans.get(scope.path) ?? [],
        })),
        kept,
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
 * @param planning the selected kit and adoption reads
 * @param policy the validated proposed policy
 * @param policyText the proposed policy text
 * @returns the plan
 */
export function buildInitPlan(planning: Planning, policy: Policy, policyText: string): ReplacePlan {
    const { root, tooling, everySelected, selection, answers, kept, options } = planning;
    const profile =
        options.profile === undefined
            ? undefined
            : {
                  name: options.profile.tables.profile,
                  digest: options.profile.digest,
                  selection: options.profile.tables.selection,
                  detected: selection.rootPlans.map((plan) => plan.kit).filter((id) => !selection.selectedIds.has(id)),
              };
    const agents = policy.guides.install ? agentFiles(root, policy.guides.agents) : [];
    const policyLines = policyText.split('\n').length;
    const lintJobs = ciLintJobs(root, tooling.ci);
    return {
        ...(profile ? { profile } : {}),
        ...(answers.ci === 'none' ? { ci: CI_SETUP } : {}),
        kits: everySelected.map((manifest) => ({
            kit: manifest.kit.name,
            how: selection.how.get(manifest.kit.name) ?? 'required',
            checks: manifest.checks.length,
        })),
        write: [
            { path: 'gspot.toml', note: `your policy, ${String(policyLines)} lines` },
            { path: '.gspot/', note: 'generated configuration and version pin' },
            ...everySelected
                .flatMap((manifest) => manifest.configs)
                .map((config) => config.pointer?.path)
                .filter((path) => path !== undefined)
                .map((path) => ({ path, note: 'pointer' })),
            ...agentRows(agents),
            ...ciRows(answers.ci),
        ],
        remove: kept.removed,
        unread: kept.unread,
        retained: [
            ...kept.retained,
            ...submodulePaths(root).map((path) => ({ path, note: 'submodule; contents are not read' })),
            ...retainedCiRows(answers.ci, tooling.ci, lintJobs),
        ],
        kept: carriedRows(kept),
        change: [
            { path: '.gitignore', note: 'one managed block' },
            { path: '.gitattributes', note: 'managed generated-file classification and LF line endings' },
            ...runnerRows(root, answers, everySelected, policy.runner?.tasks),
            ...(answers.hooks === 'gspot' ? [HOOKS_ROW] : []),
        ],
        noLongerRuns: noLongerRuns(tooling, pinnedTwice(root, everySelected)),
        ignores: [...kept.tools.values()].flatMap((tool) => tool.ignores),
    };
}
