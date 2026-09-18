// The questions init asks, each answered by a flag or the terminal, with the default read from the repository.
import { join } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import type { FormatSettings } from '#types/config.ts';
import { shippedFormat } from '#cli/presets/listing.ts';
import type { ExistingTooling } from '#types/repository.ts';
import { askChoice, isConfirmed } from '#cli/output/prompts.ts';
import type { InitAnswers, InitOptions } from '#types/lifecycle.ts';

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

function readPrettier(root: string, path: string): Record<string, unknown> | undefined {
    try {
        return JSON.parse(readFileSync(join(root, path), 'utf8')) as Record<string, unknown>;
    } catch {
        return undefined;
    }
}

function differingFormat(parsed: Record<string, unknown>): Partial<FormatSettings> {
    const found: Partial<FormatSettings> = {};
    const tabWidth = parsed['tabWidth'];
    const printWidth = parsed['printWidth'];
    const trailingComma = parsed['trailingComma'];
    const shipped = shippedFormat();
    if (typeof tabWidth === 'number' && tabWidth !== shipped['indent_width']) found.indent_width = tabWidth;
    if (typeof printWidth === 'number' && printWidth !== shipped['print_width']) found.print_width = printWidth;
    if (trailingComma === 'es5' || trailingComma === 'none') found.trailing_comma = trailingComma;
    return { ...found, ...flagFormat(parsed) };
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

async function isRulesWanted(options: InitOptions): Promise<boolean> {
    if (options.rules !== undefined) return options.rules === 'yes';
    return isConfirmed('Install agent rule files?', '--no-rules', true, options.yes);
}

async function askRunner(options: InitOptions, tooling: ExistingTooling): Promise<InitAnswers['runner']> {
    if (options.runner !== undefined) return options.runner;
    return askChoice('Task runner surface?', '--runner', RUNNER_CHOICES, runnerDefault(tooling), options.yes);
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
            '--keep-format or --shipped-format',
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
 * The formatter settings a Prettier file holds that differ from the shipped ones.
 * @param root the repository root
 * @param tooling the configuration files found
 * @returns the differing settings, or undefined when there are none
 */
export function formatDiffers(root: string, tooling: ExistingTooling): Partial<FormatSettings> | undefined {
    const prettier = tooling.configs.find((config) => config.tool === 'prettier' && config.path.endsWith('.json'));
    const parsed = prettier ? readPrettier(root, prettier.path) : undefined;
    const found = parsed ? differingFormat(parsed) : {};
    return Object.keys(found).length > 0 ? found : undefined;
}

/**
 * Asks the init questions that flags left open: hooks, CI, rule files, runner surface and formatter settings.
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
    const hooks = await askHooks(options, tooling);
    const ci = await askCi(root, options, tooling);
    const isRules = await isRulesWanted(options);
    const runner = await askRunner(options, tooling);
    const format = await askFormat(options, formatDiffers(root, tooling));
    return { hooks, ci, isRules, runner, ...(format ? { format } : {}) };
}
