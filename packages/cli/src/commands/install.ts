import type { Command } from 'commander';
import { openSession } from '#cli/run/session.ts';
import { directoryOf } from '#cli/commands/flags.ts';
import { findRoot } from '#cli/repository/tracked.ts';
import { hookLocation } from '#cli/lifecycle/hooks.ts';
import { assertPinMatches } from '#cli/run/version-pin.ts';
import { installTools } from '#cli/tools/install-tools.ts';
import { MISE_CONFIG_PATH } from '#cli/emit/runner-tasks.ts';
import { printCommand } from '#cli/commands/print-result.ts';
import { toolEnvironment } from '#cli/emit/tool-environment.ts';
import { pythonInstallSteps } from '#cli/tools/python-project.ts';
import type { CommandResult } from '#cli/commands/print-result.ts';
import { packageInstallSteps } from '#cli/tools/package-project.ts';

/**
 * Register immutable installation for a clone.
 * @param program
 */
export function registerInstall(program: Command): void {
    program
        .command('install')
        .summary('Install locked tools')
        .description('Install locked tools for this clone without changing tracked configuration')
        .addHelpText(
            'after',
            '\nEffects:\nInstalls the locked tools selected by gspot.toml into the managed installation. It also installs selected hooks. It does not choose configurations. Use this after cloning a configured repository. A failed dependency installation preserves its previous tree. Completed setup steps can remain if a later step fails. --dry-run previews installation commands without writing files.\n\nExit codes:\n0: installation or its preview completed. 2: invalid input or inability to complete the request.\n\nExample:\ngspot install --dry-run',
        )
        .option('--dry-run', 'Preview installation commands without writing files')
        .action(async (flags: Record<string, unknown>, command: Command) => {
            const global = command.optsWithGlobals();
            await printCommand(
                () => installCommand({ cwd: directoryOf(global), isDryRun: flags['dryRun'] === true }),
                global,
            );
        });
}
type InstallOptions = { cwd: string; isDryRun: boolean };

/**
 * Preview or install this clone's locked tools without regenerating tracked configuration.
 * @param options
 */
export async function installCommand(options: InstallOptions): Promise<CommandResult> {
    const root = findRoot(options.cwd);
    assertPinMatches(root);
    const session = await openSession(root);
    try {
        const steps: string[][] = [];
        const failures: string[] = [];
        const projects = [
            { selected: session.packageManager !== undefined, preview: packageInstallSteps },
            { selected: toolEnvironment(session).length > 0, preview: pythonInstallSteps },
        ];
        for (const project of projects) {
            if (!project.selected) continue;
            try {
                const commands = project.preview(root);
                if (commands.length === 0) throw new Error('Run: gspot apply, then gspot install');
                steps.push(...commands);
            } catch (error) {
                failures.push(error instanceof Error ? error.message : 'Tool installation inputs are invalid.');
            }
        }
        const runner = session.policyFiles.policy.runner?.tool;
        if (runner === 'mise') steps.unshift(['mise', 'trust', MISE_CONFIG_PATH], ['mise', 'install']);
        const hooks =
            session.repository.hasGit &&
            ['gspot', 'simple-git-hooks', 'pre-commit'].includes(session.policyFiles.policy.hooks?.tool ?? '')
                ? hookLocation(root).absolute
                : undefined;
        if (options.isDryRun && failures.length > 0) throw new Error([...new Set(failures)].join('\n'));
        if (options.isDryRun)
            return {
                text:
                    steps.length === 0 && hooks === undefined
                        ? 'No managed tools or hooks to install.\n'
                        : `${[...steps.map((step) => step.join(' ')), ...(hooks === undefined ? [] : [`install hook dispatchers in ${hooks}; retain original executables as siblings`])].join('\n')}\n`,
                json: { isDryRun: true, steps, ...(hooks === undefined ? {} : { hooks }) },
                exitCode: 0,
            };
        let note = '';
        try {
            note = await installTools(session, true);
        } catch (error) {
            failures.push(error instanceof Error ? error.message : 'Tool installation failed.');
        }
        if (failures.length > 0) throw new Error([note, ...new Set(failures)].filter(Boolean).join('\n'));
        return {
            text: `${note === '' ? 'No managed tools to install.' : note}\n`,
            json: { installed: true, steps },
            exitCode: 0,
        };
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Tool installation failed.';
        return { text: `${message}\n`, json: { installed: false, error: message }, exitCode: 2 };
    }
}
