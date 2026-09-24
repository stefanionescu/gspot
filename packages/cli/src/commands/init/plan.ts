import type { Proposal } from '#cli/policy/propose.ts';
import { noLongerRuns } from '#cli/lifecycle/takeover.ts';
import type { ScopeEntry } from '#cli/repository/scopes.ts';
import { submodulePaths } from '#cli/repository/tracked.ts';
import type { RunnerTaskNames } from '#cli/policy/runner.ts';
import type { TakeoverPlan } from '#cli/lifecycle/takeover.ts';
import { openConfinedRoot } from '#cli/platform/filesystem.ts';
import { ciLintJobs } from '#cli/repository/existing-tooling.ts';
import { xcodeProposal } from '#cli/lifecycle/xcode-proposal.ts';
import type { CarriedConfiguration } from '#cli/lifecycle/carry.ts';
import type { Manifest } from '#cli/configurations/read-manifests.ts';
import { pythonPins, npmPins } from '#cli/tools/tool-installation.ts';
// The proposal init writes and the plan it prints: what is written, removed, carried, changed, and stops running.
import type { InitAnswers, InitPlanInputs, InitSelection } from '#cli/commands/init/types.ts';
import { MISE_CONFIG_PATH, misePins, pinnedTwice, runnerTaskPlan } from '#cli/emit/runner-tasks.ts';

function carriedRows(carried: CarriedConfiguration): TakeoverPlan['carried'] {
    const rows = [...carried.tools].flatMap(([tool, entries]) => {
        const settings = Object.entries(entries.settings).map(([key, value]) => ({
            from: `${tool} ${key}`,
            count: Array.isArray(value)
                ? value.length
                : typeof value === 'object' && value !== null
                  ? Object.keys(value).length
                  : 1,
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
    for (const [scope, entry] of carried.scopes)
        for (const [tool, settings] of Object.entries(entry.tools))
            for (const [key, value] of Object.entries(settings))
                rows.push({
                    from: `${scope}: ${tool} ${key}`,
                    count: Array.isArray(value) ? value.length : 1,
                    into: `[[scope]] ${scope}: tools.${tool}.${key}`,
                });
    return rows;
}

function stubRows(everySelected: Manifest[]): TakeoverPlan['write'] {
    return everySelected
        .flatMap((manifest) => manifest.configs)
        .map((config) => config.stub?.path)
        .filter((path) => path !== undefined)
        .map((path) => ({ path, note: 'stub' }));
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

function xcodeFor(root: string, selection: InitSelection): Proposal['xcode'] {
    if (!selection.selectedIds.has('xcode')) return undefined;
    return xcodeProposal(
        root,
        selection.scopes.map((scope) => scope.path),
    );
}

/**
 * Builds the proposal gspot.toml is rendered from.
 * @param root the repository root
 * @param selection what init selected
 * @param answers the answers to the init questions
 * @param carried the lists carried from old configuration files
 * @returns the proposal
 */
export function buildProposal(
    root: string,
    selection: InitSelection,
    answers: InitAnswers,
    carried: CarriedConfiguration,
): Proposal {
    if (selection.selectedIds.has('dependencies')) {
        const files = openConfinedRoot(root);
        try {
            for (const path of new Set(['', ...selection.scopes.map((scope) => scope.path)])) {
                const source = files.read(path === '' ? 'bunfig.toml' : `${path}/bunfig.toml`);
                if (source === undefined) continue;
                const document = Bun.TOML.parse(source.bytes.toString('utf8')) as Record<string, unknown>;
                const install = document['install'] as Record<string, unknown> | undefined;
                const age = install?.['minimumReleaseAge'];
                const security = install?.['security'] as Record<string, unknown> | undefined;
                const scanner = security?.['scanner'];
                const settings = {
                    ...(typeof age === 'number' ? { min_release_age_days: Math.max(7, age / 86_400) } : {}),
                    ...(typeof scanner === 'string' ? { security_scanner: scanner } : {}),
                };
                if (Object.keys(settings).length === 0) continue;
                if (path === '') {
                    const existing = carried.tools.get('install');
                    carried.tools.set('install', {
                        settings: { ...existing?.settings, ...settings },
                        ignores: existing?.ignores ?? [],
                    });
                } else {
                    const scope = carried.scopes.get(path) ?? { configurations: [], tools: {} };
                    scope.tools['install'] = { ...scope.tools['install'], ...settings };
                    carried.scopes.set(path, scope);
                }
            }
        } finally {
            files.close();
        }
    }
    const scopes: ScopeEntry[] = selection.scopes.filter((scope) => scope.path !== '');
    const hasCommitScopes = scopes.length > 0 && selection.selectedIds.has('commits');
    const commitScopes = hasCommitScopes ? [...scopes.map((scope) => scope.name), 'root', 'hooks', 'deps'] : undefined;
    const xcode = xcodeFor(root, selection);
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
    };
}

/**
 * Builds the plan init prints before asking to continue.
 * @param inputs the root, the tooling found, every selected manifest, the answers, the carried lists and the policy line count
 * @returns the plan
 */
export function buildInitPlan(inputs: InitPlanInputs): TakeoverPlan {
    const { root, tooling, everySelected, how, answers, carried, policyLines, profile } = inputs;
    const agentRows =
        inputs.agents.length > 0
            ? [
                  ...inputs.agents.map((path) => ({
                      path,
                      note:
                          path === '.cursor/rules/gspot.mdc'
                              ? 'owned Cursor rule; authored files preserved'
                              : 'managed instruction block',
                  })),
                  { path: '.gspot/rules/', note: 'agent rule files' },
              ]
            : [];
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
            ...stubRows(everySelected),
            ...agentRows,
            ...(answers.ci === 'none'
                ? []
                : [
                      {
                          path: answers.ci === 'github' ? '.github/workflows/gspot.yml' : '.gitlab/ci/gspot.yml',
                          note:
                              answers.ci === 'github'
                                  ? 'check workflow'
                                  : 'add include: [{ local: .gitlab/ci/gspot.yml }] to .gitlab-ci.yml',
                      },
                  ]),
        ],
        remove: carried.removed,
        unread: carried.unread,
        retained: [
            ...carried.retained,
            ...submodulePaths(root).map((path) => ({ path, note: 'submodule; contents are not read' })),
            ...(answers.ci === 'none' && tooling.ci.length > 0 && ciLintJobs(root, tooling.ci).length === 0
                ? tooling.ci.map((path) => ({
                      path,
                      note: 'CI retained; add commands to install the pinned gspot version, gspot install, and gspot check',
                  }))
                : []),
            ...ciLintJobs(root, tooling.ci).map((path) => ({
                path,
                note: 'existing lint job retained; no duplicate CI job proposed',
            })),
        ],
        carried: carriedRows(carried),
        change: [
            { path: '.gitignore', note: 'one managed block' },
            { path: '.gitattributes', note: 'managed generated-file classification and LF line endings' },
            ...runnerRows(root, answers, everySelected, inputs.runnerTasks),
            ...(answers.hooks === 'gspot'
                ? [
                      {
                          path: 'Git-resolved hooks directory',
                          note: 'gspot install creates dispatchers; existing executables are retained as .gspot-original siblings; tracked hooks require hook-manager integration',
                      },
                  ]
                : []),
        ],
        noLongerRuns: noLongerRuns(tooling, pinnedTwice(root, everySelected)),
        ignores: [...carried.tools.values()].flatMap((tool) => tool.ignores),
    };
}
