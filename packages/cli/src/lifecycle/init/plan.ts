// The proposal init writes and the plan it prints: what is written, removed, carried, changed, and stops running.
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import type { Proposal } from '#types/config.ts';
import type { Manifest } from '#types/manifest.ts';
import type { ScopeEntry } from '#types/repository.ts';
import { noLongerRuns } from '#cli/lifecycle/takeover.ts';
import { pinnedTwice, collectPins, npmPins } from '#cli/emit/runner-surface.ts';
import type { CarriedLists, InitAnswers, InitPlanInputs, InitSelection, TakeoverPlan } from '#types/lifecycle.ts';

const TYPES_DIRECTORIES = ['types', 'src/types', 'api/types'];
const PACKAGE_RUNNERS = new Set(['bun', 'npm', 'pnpm']);
const MISE_TASKS = 5;

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

function runnerRows(answers: InitAnswers, everySelected: Manifest[]): TakeoverPlan['change'] {
    if (answers.runner === 'mise') {
        const pins = collectPins(everySelected).length;
        return [
            { path: '.config/mise/conf.d/gspot.toml', note: `${String(pins)} tool pins, ${String(MISE_TASKS)} tasks` },
        ];
    }
    if (!PACKAGE_RUNNERS.has(answers.runner)) return [];
    const count = Object.keys(npmPins(everySelected, answers.runner)).length;
    return [
        {
            path: 'package.json',
            note: `add ${String(count)} devDependencies gspot pins; scripts check, check:fix, apply, prepare`,
        },
    ];
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
    const typesDirectory = TYPES_DIRECTORIES.find((dir) => existsSync(join(root, dir)));
    const hasTypes = typesDirectory !== undefined && selection.selectedIds.has('typescript');
    return {
        presets: selection.rootIds,
        scopes: scopes.map((scope) => ({ path: scope.path, presets: selection.scopeProposals.get(scope.path) ?? [] })),
        carried,
        hooks: answers.hooks,
        ci: answers.ci,
        rules: answers.isRules,
        runner: answers.runner,
        ...(answers.format ? { format: answers.format } : {}),
        ...(commitScopes ? { commitScopes } : {}),
        ...(hasTypes ? { typesDirectory } : {}),
    };
}

/**
 * Builds the plan init prints before asking to continue.
 * @param inputs the root, the tooling found, every selected manifest, the answers, the carried lists and the policy line count
 * @returns the plan
 */
export function buildInitPlan(inputs: InitPlanInputs): TakeoverPlan {
    const { root, tooling, everySelected, how, answers, carried, policyLines, profile } = inputs;
    const agentRows = answers.isRules
        ? [
              { path: 'CLAUDE.md  AGENTS.md', note: 'one managed block each' },
              { path: '.gspot/rules/', note: 'agent rule files' },
          ]
        : [];
    return {
        ...(profile ? { profile } : {}),
        presets: everySelected.map((manifest) => ({
            id: manifest.preset.id,
            how: how.get(manifest.preset.id) ?? 'required',
            checks: manifest.checks.length,
        })),
        write: [
            { path: 'gspot.toml', note: `your policy, ${String(policyLines)} lines` },
            { path: '.gspot/', note: 'generated configuration, baselines, hooks, version pin' },
            ...stubRows(everySelected),
            ...agentRows,
        ],
        remove: carried.removed,
        unread: carried.unread,
        carried: carriedRows(carried),
        change: [{ path: '.gitignore', note: 'one managed block' }, ...runnerRows(answers, everySelected)],
        noLongerRuns: noLongerRuns(tooling, pinnedTwice(root, everySelected)),
        baselines: { rules: 0, findings: 0 },
        ignores: carried.ignores,
    };
}
