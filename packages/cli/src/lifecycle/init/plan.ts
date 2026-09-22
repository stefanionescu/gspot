import { ciLintJobs } from '#cli/repository/existing-tooling.ts';
// The proposal init writes and the plan it prints: what is written, removed, carried, changed, and stops running.
import { pythonPins } from '#cli/emit/tool-environment.ts';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import type { Proposal } from '#cli/policy/types.ts';
import type { Manifest } from '#cli/presets/types.ts';
import type { ScopeEntry } from '#cli/repository/types.ts';
import { noLongerRuns } from '#cli/lifecycle/takeover.ts';
import { xcodeProposal } from '#cli/lifecycle/xcode-proposal.ts';
import { pinnedTwice, misePins, npmPins, MISE_CONFIG_PATH, MISE_TASKS } from '#cli/emit/runner-tasks.ts';
import type { CarriedLists, InitAnswers, InitPlanInputs, InitSelection, TakeoverPlan } from '#cli/lifecycle/types.ts';

const PACKAGE_RUNNERS = new Set(['bun', 'npm', 'pnpm']);

function carriedRows(carried: CarriedLists): TakeoverPlan['carried'] {
    const rows: { from: string; count: number; into: string }[] = [
        { from: 'typos words', count: carried.typosWords.length, into: 'words' },
        { from: 'gitleaks allowlist', count: carried.gitleaksAllow.length, into: 'entries' },
        { from: 'osv ignores', count: carried.osvIgnores.length, into: 'advisories' },
        { from: 'license exceptions', count: carried.licenseExceptions.length, into: 'exceptions' },
        { from: 'rules turned off', count: carried.ignores.length, into: '[[ignore]] entries' },
    ];
    return rows.filter((row) => row.count > 0);
}

function stubRows(everySelected: Manifest[]): TakeoverPlan['write'] {
    return everySelected
        .flatMap((manifest) => manifest.configs)
        .map((config) => config.stub?.path)
        .filter((path) => path !== undefined)
        .map((path) => ({ path, note: 'stub' }));
}

function runnerRows(root: string, answers: InitAnswers, everySelected: Manifest[]): TakeoverPlan['change'] {
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
    if (answers.runner === 'mise')
        rows.unshift({
            path: MISE_CONFIG_PATH,
            note: `${String(misePins(everySelected, count > 0).length)} tool pins, ${String(MISE_TASKS.length)} tasks`,
        });
    if (PACKAGE_RUNNERS.has(answers.runner) && existsSync(join(root, 'package.json')))
        rows.push({ path: 'package.json', note: 'scripts check, check:fix, apply' });
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
    carried: CarriedLists,
): Proposal {
    const scopes: ScopeEntry[] = selection.scopes.filter((scope) => scope.path !== '');
    const hasCommitScopes = scopes.length > 0 && selection.selectedIds.has('commits');
    const commitScopes = hasCommitScopes ? [...scopes.map((scope) => scope.name), 'root', 'hooks', 'deps'] : undefined;
    const xcode = xcodeFor(root, selection);
    return {
        presets: selection.rootIds,
        scopes: scopes.map((scope) => ({ path: scope.path, presets: selection.scopeProposals.get(scope.path) ?? [] })),
        carried,
        hooks: answers.hooks,
        ci: answers.ci,
        rules: answers.isRules,
        runner: answers.runner,
        ...(answers.formatter === undefined ? {} : { format: answers.formatter.format }),
        ...(answers.formatter?.extra === undefined ? {} : { prettierExtra: answers.formatter.extra }),
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
        presets: everySelected.map((manifest) => ({
            preset: manifest.preset.name,
            how: how.get(manifest.preset.name) ?? 'required',
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
            ...runnerRows(root, answers, everySelected),
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
        ignores: carried.ignores,
    };
}
