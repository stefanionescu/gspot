// gspot init
import { Option } from 'commander';
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
        allowDirty: flags['allowDirty'] === true,
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
        .option('--allow-dirty', 'Run although the working tree has uncommitted changes')
        .addOption(new Option('--hooks <tool>', 'Where hooks go').choices(['gspot', 'lefthook', 'husky', 'none']))
        .addOption(new Option('--ci <provider>', 'Write a CI workflow').choices(['github', 'none']))
        .addOption(new Option('--rules <choice>', 'Install the agent rule files').choices(['yes', 'no']))
        .addOption(
            new Option('--format <choice>', 'Keep your formatter settings, or take the shipped ones').choices([
                'keep',
                'shipped',
            ]),
        )
        .option('--project-templates', 'Copy the project templates that match into the project rule layer')
        .addOption(
            new Option('--runner <surface>', 'The task runner surface').choices([
                'mise',
                'npm',
                'bun',
                'pnpm',
                'uv',
                'none',
            ]),
        )
        .option('--dry-run', 'Print the plan and write nothing')
        .action(async (flags: Record<string, unknown>, command: Command) => {
            const global = command.optsWithGlobals();
            await emit(() => initCommand(optionsFrom(flags, global)), global);
        });
}
