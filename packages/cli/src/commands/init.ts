// gspot init
import type { Command } from 'commander';
import { emit } from '#cli/commands/emit.ts';
import type { InitOptions } from '#types/emit.ts';
import { initCommand } from '#cli/emit/install.ts';
import { binaryPath } from '#cli/platform/assets.ts';
import { commaList, directoryOf, listFlag, textFlag } from '#cli/commands/flags.ts';

function optionsFrom(flags: Record<string, unknown>, global: Record<string, unknown>): InitOptions {
    const binary = binaryPath();
    const lists = {
        presets: listFlag(flags, 'presets'),
        without: listFlag(flags, 'without'),
        scopes: listFlag(flags, 'scope'),
        own: listFlag(flags, 'own'),
    };
    const choices = {
        hooks: textFlag(flags, 'hooks') as InitOptions['hooks'],
        ci: textFlag(flags, 'ci') as InitOptions['ci'],
        rules: textFlag(flags, 'rules') as InitOptions['rules'],
        format: textFlag(flags, 'format') as InitOptions['format'],
        runner: textFlag(flags, 'runner') as InitOptions['runner'],
    };
    const given: Partial<InitOptions> = Object.fromEntries(
        [...Object.entries(lists), ...Object.entries(choices)].filter(([, value]) => value !== undefined),
    ) as Partial<InitOptions>;
    return {
        cwd: directoryOf(global),
        yes: flags['yes'] === true,
        isDryRun: flags['dryRun'] === true,
        json: global['json'] === true,
        install: flags['install'] !== false,
        projectTemplates: flags['projectTemplates'] === true,
        ...given,
        ...(binary === undefined ? {} : { binaryPath: binary }),
    };
}

/**
 * Registers init.
 * @param program the commander program
 */
export function registerInit(program: Command): void {
    program
        .command('init')
        .description('Read this repository, propose a policy, and write it after a yes')
        .option('--yes', 'Take every proposal without asking')
        .option('--presets <ids>', 'The root presets, comma separated, instead of the detected ones', commaList)
        .option('--without <ids>', 'Presets to leave out of the proposal, comma separated', commaList)
        .option(
            '--scope <path=ids>',
            'A scope and its presets; repeat for each scope',
            (value: string, previous: string[]) => [...previous, value],
        )
        .option(
            '--own <tools>',
            'The tools gspot takes over, comma separated; the default is every tool it has a preset for',
            commaList,
        )
        .option('--no-install', 'Skip the install step and print the command instead')
        .option('--hooks <tool>', 'Where hooks go: gspot, lefthook, husky or none')
        .option('--ci <provider>', 'Write a CI workflow: github or none')
        .option('--rules <yes|no>', 'Install the agent rule files')
        .option('--format <keep|shipped>', 'Keep your formatter settings, or take the shipped ones')
        .option('--project-templates', 'Copy the project templates that match into the project rule layer')
        .option('--runner <surface>', 'The task runner surface: mise, npm, bun, pnpm, uv or none')
        .option('--dry-run', 'Print the plan and write nothing')
        .action(async (flags: Record<string, unknown>, command: Command) => {
            const global = command.optsWithGlobals();
            await emit(() => initCommand(optionsFrom(flags, global)), global);
        });
}
