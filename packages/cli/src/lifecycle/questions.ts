// The questions init asks, each answered by a flag or the terminal, with the default read from the repository.
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import type { Manifest } from '#types/manifest.ts';
import type { FormatSettings } from '#types/config.ts';
import { shippedFormat } from '#cli/presets/listing.ts';
import type { ExistingTooling } from '#types/repository.ts';
import { askChoice, askMany, askConfirmation } from '#cli/output/prompts.ts';
import type { CarrySource, InitAnswers, InitOptions, InitSelection } from '#types/lifecycle.ts';

const HOOK_CHOICES: { value: InitAnswers['hooks']; label: string }[] = [
    { value: 'gspot', label: 'gspot writes .gspot/hooks' },
    { value: 'lefthook', label: 'a block in lefthook.yml' },
    { value: 'husky', label: 'lines in .husky/' },
    { value: 'none', label: 'no hooks' },
];

const CI_CHOICES: { value: InitAnswers['ci']; label: string }[] = [
    { value: 'github', label: '.github/workflows/gspot.yml' },
    { value: 'none', label: 'no workflow' },
];

const RUNNER_CHOICES: { value: InitAnswers['runner']; label: string }[] = [
    { value: 'mise', label: 'mise (.config/mise/conf.d/gspot.toml)' },
    { value: 'bun', label: 'bun (package.json scripts)' },
    { value: 'npm', label: 'npm (package.json scripts)' },
    { value: 'pnpm', label: 'pnpm (package.json scripts)' },
    { value: 'uv', label: 'uv (dependency group)' },
    { value: 'none', label: 'none' },
];

function differingFormat(parsed: Record<string, unknown>): Partial<FormatSettings> | undefined {
    const found: Partial<FormatSettings> = {};
    const tabWidth = parsed['tabWidth'];
    const printWidth = parsed['printWidth'];
    const trailingComma = parsed['trailingComma'];
    const shipped = shippedFormat();
    if (typeof tabWidth === 'number' && tabWidth !== shipped['indent_width']) found.indent_width = tabWidth;
    if (typeof printWidth === 'number' && printWidth !== shipped['print_width']) found.print_width = printWidth;
    if (trailingComma === 'es5' || trailingComma === 'none') found.trailing_comma = trailingComma;
    const format = { ...found, ...flagFormat(parsed) };
    return Object.keys(format).length === 0 ? undefined : format;
}

function flagFormat(parsed: Record<string, unknown>): Partial<FormatSettings> {
    const found: Partial<FormatSettings> = {};
    if (parsed['singleQuote'] === false) found.quotes = 'double';
    if (parsed['semi'] === false) found.semicolons = false;
    if (parsed['useTabs'] === true) found.indent_style = 'tab';
    return found;
}

function hooksDefault(tooling: ExistingTooling): InitAnswers['hooks'] {
    if (tooling.hooks.some((hook) => hook.kind === 'husky')) return 'husky';
    return tooling.hooks.some((hook) => hook.kind === 'lefthook') ? 'lefthook' : 'gspot';
}

function ciDefault(root: string, tooling: ExistingTooling): InitAnswers['ci'] {
    return existsSync(join(root, '.github')) && tooling.ci.length === 0 ? 'github' : 'none';
}

function runnerDefault(tooling: ExistingTooling): InitAnswers['runner'] {
    return tooling.runner === 'yarn' ? 'npm' : tooling.runner;
}

async function askHooks(options: InitOptions, tooling: ExistingTooling): Promise<InitAnswers['hooks']> {
    if (options.hooks !== undefined) return options.hooks;
    return askChoice('Install git hooks?', '--hooks', HOOK_CHOICES, hooksDefault(tooling), options.yes);
}

async function askCi(root: string, options: InitOptions, tooling: ExistingTooling): Promise<InitAnswers['ci']> {
    if (options.ci !== undefined) return options.ci;
    return askChoice('Write a CI workflow?', '--ci', CI_CHOICES, ciDefault(root, tooling), options.yes);
}

async function askRuleFiles(options: InitOptions): Promise<boolean> {
    if (options.rules !== undefined) return options.rules === 'yes';
    return askConfirmation('Install agent rule files?', '--no-rules', true, options.yes);
}

async function askRunner(options: InitOptions, tooling: ExistingTooling): Promise<InitAnswers['runner']> {
    if (options.runner !== undefined) return options.runner;
    return askChoice('Task runner?', '--runner', RUNNER_CHOICES, runnerDefault(tooling), options.yes);
}

async function askFormat(
    options: InitOptions,
    differing: Partial<FormatSettings> | undefined,
): Promise<Partial<FormatSettings> | undefined> {
    if (!differing) return undefined;
    const shown = Object.entries(differing)
        .map(([key, value]) => `${key} ${String(value)}`)
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
 * @param formatSource the formatter input already parsed during takeover observation
 * @returns the answers
 */
export async function askInitQuestions(
    root: string,
    options: InitOptions,
    tooling: ExistingTooling,
    formatSource: CarrySource | undefined,
): Promise<InitAnswers> {
    const hooks = await askHooks(options, tooling);
    const ci = await askCi(root, options, tooling);
    const isRules = await askRuleFiles(options);
    const runner = await askRunner(options, tooling);
    const differing = formatSource === undefined ? undefined : differingFormat(formatSource.parsed);
    const format = await askFormat(options, differing);
    return { hooks, ci, isRules, runner, ...(format ? { format } : {}) };
}
