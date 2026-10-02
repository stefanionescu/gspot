import type { Manifest } from '#cli/types/kits.ts';
import { readGitSetting } from '#cli/platform/git.ts';
import { ciLintJobs } from '#cli/repository/survey.ts';
import { openRoot } from '#cli/platform/filesystem.ts';
import { CI_CHOICES, HOOK_CHOICES } from '#cli/config/commands/init.ts';
import { MISE_CONFIG_PATH } from '#cli/config/generation/generation.ts';
import type { ExistingTooling } from '#cli/types/repository/repository.ts';
import { askMany, askChoice, askConfirmation } from '#cli/commands/prompts.ts';
import type { InitAnswers, InitOptions, InitSelection } from '#cli/types/commands/init.ts';

const RUNNER_CHOICES: { value: InitAnswers['runner']; label: string }[] = [
    { value: 'mise', label: `mise (${MISE_CONFIG_PATH})` },
    { value: 'bun', label: 'bun (package.json scripts)' },
    { value: 'npm', label: 'npm (package.json scripts)' },
    { value: 'pnpm', label: 'pnpm (package.json scripts)' },
    { value: 'yarn', label: 'yarn (package.json scripts)' },
    { value: 'none', label: 'none' },
];

function existingCi(root: string, tooling: ExistingTooling): InitAnswers['ci'] | undefined {
    if (tooling.ci.includes('.gitlab-ci.yml')) return 'gitlab';
    if (tooling.ci.some((path) => path.startsWith('.github/workflows/'))) return 'github';
    const files = openRoot(root);
    try {
        if (files.read('.gitlab-ci.yml') !== undefined) return 'gitlab';
        if (files.stat('.github/workflows')?.isDirectory() === true) return 'github';
    } finally {
        files.close();
    }
    return undefined;
}

function ciDefault(root: string, tooling: ExistingTooling): InitAnswers['ci'] {
    const existing = existingCi(root, tooling);
    if (existing !== undefined) return existing;
    if (tooling.ci.length > 0) return 'none';
    const remote = readGitSetting(root, 'remote.origin.url') ?? '';
    const host = remote.replace(/^(?:https?|ssh):\/\//u, '').replace(/^[^@/]+@/u, '');
    if (/^github\.com[:/]/u.test(host)) return 'github';
    return /^gitlab\.com[:/]/u.test(host) ? 'gitlab' : 'none';
}

async function askHooks(options: InitOptions): Promise<InitAnswers['hooks']> {
    if (options.hooks !== undefined) return options.hooks;
    return askChoice('Install Git hooks?', '--no-hooks', HOOK_CHOICES, 'gspot', options.yes);
}

async function askCi(root: string, options: InitOptions, tooling: ExistingTooling): Promise<InitAnswers['ci']> {
    if (options.ci === 'none' || ciLintJobs(root, tooling.ci).length > 0) return 'none';
    if (options.ci !== undefined) return options.ci;
    return askChoice('Write a CI workflow?', '--ci', CI_CHOICES, ciDefault(root, tooling), options.yes);
}

async function askRuleFiles(options: InitOptions): Promise<boolean> {
    if (options.rules !== undefined) return options.rules === 'yes';
    return askConfirmation('Install agent guides?', '--no-guides', true, options.yes);
}

async function askRunner(options: InitOptions, tooling: ExistingTooling): Promise<InitAnswers['runner']> {
    if (options.runner !== undefined) return options.runner;
    return askChoice('Task runner?', '--no-runner', RUNNER_CHOICES, tooling.runner, options.yes);
}

/**
 * Asks which kits to install: what init selected starts selected, every other shipped configuration is offered.
 * @param options the init flags
 * @param selection what init selected from detection and recommendations
 * @param manifests every kit manifest
 * @returns the kit ids the person kept, or undefined when the question was not asked
 */
export async function askKits(
    options: InitOptions,
    selection: InitSelection,
    manifests: Map<string, Manifest>,
): Promise<string[] | undefined> {
    if (options.yes || options.kits !== undefined || options.profile !== undefined) return undefined;
    const choices = manifests
        .values()
        .map((manifest) => {
            const how = selection.how.get(manifest.kit.name);
            const hint = how === 'required' ? 'required by another selected kit' : (how ?? manifest.kit.description);
            return { value: manifest.kit.name, label: manifest.kit.name, hint };
        })
        .toArray();
    const initial = [...selection.selectedIds];
    const kept = await askMany('Which kits?', '--kits <ids>', choices, initial, options.yes);
    const isUnchanged = kept.length === initial.length && kept.every((id) => selection.selectedIds.has(id));
    return isUnchanged ? undefined : kept;
}

/**
 * Asks the init questions that flags left open: hooks, CI, guides, and the task runner.
 * @param root the repository root
 * @param options the init flags
 * @param tooling the configuration files, hooks and runner found
 * @returns the answers
 */
export async function askInitQuestions(
    root: string,
    options: InitOptions,
    tooling: ExistingTooling,
): Promise<InitAnswers> {
    const hooks = await askHooks(options);
    const ci = await askCi(root, options, tooling);
    const isRules = await askRuleFiles(options);
    const runner = await askRunner(options, tooling);
    return { hooks, ci, isRules, runner };
}
