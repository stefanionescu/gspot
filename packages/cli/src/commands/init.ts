// gspot init
import { Option } from 'commander';
import type { Command } from 'commander';
import type { InitOptions } from '#types/lifecycle.ts';
import { initCommand } from '#cli/lifecycle/init/command.ts';
import { printCommand } from '#cli/commands/print-result.ts';
import { directoryOf, listFlag, textEntry, textFlag } from '#cli/commands/flags.ts';

function integrationChoice(flags: Record<string, unknown>, name: string): string | undefined {
    return flags[name] === false ? 'none' : textFlag(flags, name);
}

function optionsFrom(flags: Record<string, unknown>, global: Record<string, unknown>): InitOptions {
    const lists = {
        presets: listFlag(flags, 'presets'),
        without: listFlag(flags, 'without'),
        scopes: listFlag(flags, 'scope'),
    };
    const choices = {
        hooks: integrationChoice(flags, 'hooks') as InitOptions['hooks'],
        ci: integrationChoice(flags, 'ci') as InitOptions['ci'],
        runner: integrationChoice(flags, 'runner') as InitOptions['runner'],
        rules: flags['rules'] === false ? ('no' as const) : undefined,
        format: textFlag(flags, 'format') as InitOptions['format'],
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
        ...textEntry(flags, 'from', 'from'),
        ...given,
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
        .option('--from <profile>', 'Install from a profile: a path, an https URL or github:owner/repo')
        .option('--presets <presets...>', 'The root presets instead of the detected ones')
        .option('--without <presets...>', 'Presets to leave out of the proposal')
        .option('--scope <path=presets...>', 'Scopes and their comma-separated presets')
        .option('--no-install', 'Skip the install step and print the command instead')
        .option('--allow-dirty', 'Run although the working tree has uncommitted changes')
        .addOption(new Option('--hooks <tool>', 'Where hooks go').choices(['gspot', 'lefthook', 'husky']))
        .addOption(new Option('--ci <provider>', 'Write a CI workflow').choices(['github']))
        .option('--no-hooks', 'Do not install hooks')
        .option('--no-ci', 'Write no CI workflow')
        .option('--no-rules', 'Leave the agent rule files out')
        .addOption(
            new Option('--format <choice>', 'Keep existing or use shipped formatter settings').choices([
                'keep',
                'shipped',
            ]),
        )
        .addOption(new Option('--runner <tool>', 'The task runner').choices(['mise', 'npm', 'bun', 'pnpm', 'uv']))
        .option('--no-runner', 'Write no task-runner configuration')
        .option('--dry-run', 'Print the plan and write nothing')
        .action(async (flags: Record<string, unknown>, command: Command) => {
            const global = command.optsWithGlobals();
            await printCommand(() => initCommand(optionsFrom(flags, global)), global);
        });
}
