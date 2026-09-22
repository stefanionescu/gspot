import { ciLintJobs } from '#cli/repository/existing-tooling.ts';
import { readGitSetting } from '#cli/platform/spawn.ts';
import { MISE_CONFIG_PATH } from '#cli/emit/runner-tasks.ts';
// The questions init asks, each answered by a flag or the terminal, with the default read from the repository.
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import type { Manifest } from '#cli/presets/types.ts';
import type { FormatSettings, Policy } from '#cli/policy/types.ts';
import { shippedFormat } from '#cli/presets/listing.ts';
import type { ExistingTooling } from '#cli/repository/types.ts';
import { askChoice, askMany, askConfirmation } from '#cli/output/prompts.ts';
import type { CarriedFormatter, InitAnswers, InitOptions, InitSelection } from '#cli/lifecycle/types.ts';

const HOOK_CHOICES: { value: InitAnswers['hooks']; label: string }[] = [
    { value: 'gspot', label: 'gspot installs hooks in the Git-resolved directory' },
    { value: 'lefthook', label: 'a block in lefthook.yml' },
    { value: 'husky', label: 'lines in .husky/' },
    { value: 'none', label: 'no hooks' },
];

const CI_CHOICES: { value: InitAnswers['ci']; label: string }[] = [
    { value: 'github', label: '.github/workflows/gspot.yml' },
    { value: 'gitlab', label: '.gitlab/ci/gspot.yml (include from .gitlab-ci.yml)' },
    { value: 'none', label: 'no workflow' },
];

const RUNNER_CHOICES: { value: InitAnswers['runner']; label: string }[] = [
    { value: 'mise', label: `mise (${MISE_CONFIG_PATH})` },
    { value: 'bun', label: 'bun (package.json scripts)' },
    { value: 'npm', label: 'npm (package.json scripts)' },
    { value: 'pnpm', label: 'pnpm (package.json scripts)' },
    { value: 'uv', label: 'uv (private Python environment)' },
    { value: 'none', label: 'none' },
];

function hooksDefault(tooling: ExistingTooling): InitAnswers['hooks'] {
    if (tooling.hooks.some((hook) => hook.kind === 'husky')) return 'husky';
    return tooling.hooks.some((hook) => hook.kind === 'lefthook') ? 'lefthook' : 'gspot';
}

function ciDefault(root: string, tooling: ExistingTooling): InitAnswers['ci'] {
    if (tooling.ci.some((path) => path === '.gitlab-ci.yml')) return 'gitlab';
    if (tooling.ci.some((path) => path.startsWith('.github/workflows/'))) return 'github';
    if (existsSync(join(root, '.gitlab-ci.yml'))) return 'gitlab';
    if (existsSync(join(root, '.github/workflows'))) return 'github';
    if (tooling.ci.length > 0) return 'none';
    const remote = readGitSetting(root, 'remote.origin.url') ?? '';
    if (/^(?:https?:\/\/|ssh:\/\/(?:[^@/]+@)?|[^@/]+@)github\.com[:/]/u.test(remote)) return 'github';
    return /^(?:https?:\/\/|ssh:\/\/(?:[^@/]+@)?|[^@/]+@)gitlab\.com[:/]/u.test(remote) ? 'gitlab' : 'none';
}

async function askHooks(options: InitOptions, tooling: ExistingTooling): Promise<InitAnswers['hooks']> {
    if (options.hooks !== undefined) return options.hooks;
    return askChoice('Install git hooks?', '--hooks', HOOK_CHOICES, hooksDefault(tooling), options.yes);
}

async function askCi(root: string, options: InitOptions, tooling: ExistingTooling): Promise<InitAnswers['ci']> {
    if (options.ci === 'none' || ciLintJobs(root, tooling.ci).length > 0) return 'none';
    if (options.ci !== undefined) return options.ci;
    return askChoice('Write a CI workflow?', '--ci', CI_CHOICES, ciDefault(root, tooling), options.yes);
}

async function askRuleFiles(options: InitOptions): Promise<boolean> {
    if (options.rules !== undefined) return options.rules === 'yes';
    return askConfirmation('Install agent rule files?', '--no-rules', true, options.yes);
}

async function askRunner(options: InitOptions, tooling: ExistingTooling): Promise<InitAnswers['runner']> {
    if (options.runner !== undefined) return options.runner;
    return askChoice(
        'Task runner?',
        '--runner',
        RUNNER_CHOICES,
        tooling.runner === 'yarn' ? 'npm' : tooling.runner,
        options.yes,
    );
}

async function askFormat(
    options: InitOptions,
    differing: CarriedFormatter | undefined,
): Promise<CarriedFormatter | undefined> {
    if (!differing) return undefined;
    const shown = Object.entries({ ...differing.format, ...differing.extra })
        .filter(([key]) => key !== 'reason')
        .map(([key, value]) =>
            key === 'overrides' && Array.isArray(value)
                ? `${String(value.length)} current path overrides`
                : `${key} ${String(value)}`,
        )
        .join(', ');
    const keep =
        options.format ??
        (await askChoice<'keep' | 'shipped'>(
            'Your formatter settings differ from the shipped ones. Keep yours?',
            '--format keep or --format shipped',
            [
                { value: 'keep', label: `keep (${shown})` },
                { value: 'shipped', label: 'take the shipped values' },
            ],
            'keep',
            options.yes,
        ));
    return keep === 'keep' ? differing : undefined;
}

/**
 * Asks which presets to install: what init selected starts selected, every other shipped preset is offered.
 * @param options the init flags
 * @param selection what init selected from detection and recommendations
 * @param manifests every preset manifest
 * @returns the preset ids the person kept, or undefined when the question was not asked
 */
export async function askPresets(
    options: InitOptions,
    selection: InitSelection,
    manifests: Map<string, Manifest>,
): Promise<string[] | undefined> {
    if (options.yes || options.presets !== undefined || options.profile !== undefined) return undefined;
    const choices = manifests
        .values()
        .map((manifest) => {
            const how = selection.how.get(manifest.preset.name);
            const hint =
                how === 'required' ? 'required by another selected preset' : (how ?? manifest.preset.description);
            return { value: manifest.preset.name, label: manifest.preset.name, hint };
        })
        .toArray();
    const initial = [...selection.selectedIds];
    const kept = await askMany('Which presets?', choices, initial, options.yes);
    const isUnchanged = kept.length === initial.length && kept.every((id) => selection.selectedIds.has(id));
    return isUnchanged ? undefined : kept;
}

/**
 * Asks the init questions that flags left open: hooks, CI, rule files, task runner and formatter settings.
 * @param root the repository root
 * @param options the init flags
 * @param tooling the configuration files, hooks and runner found
 * @param carriedFormat the validated formatter choices captured during takeover observation
 * @returns the answers
 */
export async function askInitQuestions(
    root: string,
    options: InitOptions,
    tooling: ExistingTooling,
    carriedFormat: CarriedFormatter | undefined,
): Promise<InitAnswers> {
    const hooks = await askHooks(options, tooling);
    const ci = await askCi(root, options, tooling);
    const isRules = await askRuleFiles(options);
    const runner = await askRunner(options, tooling);
    const shipped = shippedFormat();
    const differences = Object.fromEntries(
        Object.entries(carriedFormat?.format ?? {}).filter(
            ([key, value]) => value !== shipped[key as keyof FormatSettings],
        ),
    ) as Policy['format'];
    const differing =
        Object.keys(differences).length === 0 && carriedFormat?.extra === undefined
            ? undefined
            : { format: differences, ...(carriedFormat?.extra === undefined ? {} : { extra: carriedFormat.extra }) };
    const formatter = await askFormat(options, differing);
    return { hooks, ci, isRules, runner, ...(formatter ? { formatter } : {}) };
}
