// gspot init
import type { Command } from 'commander';

import { initCommand } from '#cli/render/install.ts';
import type { InitOptions } from '#cli/render/install.ts';
import { emit } from '#cli/commands/emit.ts';
import { binaryPath } from '#cli/platform/assets.ts';

const list = (value: string): string[] =>
    value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);

/** Registers init. */
export function registerInit(program: Command): void {
    program
        .command('init')
        .description('Read this repository, propose a policy, and write it after a yes')
        .option('--yes', 'Take every proposal without asking')
        .option('--presets <ids>', 'The root presets, comma separated, instead of the detected ones', list)
        .option('--without <ids>', 'Presets to leave out of the proposal, comma separated', list)
        .option(
            '--scope <path=ids>',
            'A scope and its presets; repeat for each scope',
            (value: string, previous: string[] = []) => [...previous, value],
        )
        .option(
            '--own <tools>',
            'The tools gspot takes over, comma separated; the default is every tool it has a preset for',
            list,
        )
        .option('--no-install', 'Skip the install step and print the command instead')
        .option('--hooks <manager>', 'Where hooks go: gspot, lefthook, husky or none')
        .option('--ci <provider>', 'Write a CI workflow: github or none')
        .option('--rules <yes|no>', 'Install the agent rule files')
        .option('--format <keep|shipped>', 'Keep your formatter settings, or take the shipped ones')
        .option('--project-templates', 'Copy the project templates that match into the project rule layer')
        .option('--runner <surface>', 'The task runner surface: mise, npm, bun, pnpm, uv or none')
        .option('--dry-run', 'Print the plan and write nothing')
        .action(async (flags: Record<string, unknown>, command: Command) => {
            const global = command.optsWithGlobals() as Record<string, unknown>;
            const binary = binaryPath();
            const options: InitOptions = {
                cwd: String(global['directory'] ?? process.cwd()),
                yes: Boolean(flags['yes']) || (Boolean(global['json']) && Boolean(flags['yes'])),
                dryRun: Boolean(flags['dryRun']),
                json: Boolean(global['json']),
                install: flags['install'] !== false,
                projectTemplates: Boolean(flags['projectTemplates']),
                ...(flags['presets'] ? { presets: flags['presets'] as string[] } : {}),
                ...(flags['without'] ? { without: flags['without'] as string[] } : {}),
                ...(flags['scope'] ? { scopes: flags['scope'] as string[] } : {}),
                ...(flags['own'] ? { own: flags['own'] as string[] } : {}),
                ...(flags['hooks'] ? { hooks: flags['hooks'] as NonNullable<InitOptions['hooks']> } : {}),
                ...(flags['ci'] ? { ci: flags['ci'] as NonNullable<InitOptions['ci']> } : {}),
                ...(flags['rules'] ? { rules: flags['rules'] as NonNullable<InitOptions['rules']> } : {}),
                ...(flags['format'] ? { format: flags['format'] as NonNullable<InitOptions['format']> } : {}),
                ...(flags['runner'] ? { runner: flags['runner'] as NonNullable<InitOptions['runner']> } : {}),
                ...(binary !== undefined ? { binaryPath: binary } : {}),
            };
            await emit(() => initCommand(options), global);
        });
}
