import type { Command } from 'commander';
import { compact } from '#cli/policy/normalize.ts';
import { everyManifest } from '#cli/kits/select.ts';
import { findRoot } from '#cli/repository/tracked.ts';
import { openSession } from '#cli/execution/session.ts';
import { directoryOf } from '#cli/platform/arguments.ts';
import { installTools } from '#cli/tools/installation.ts';
import { printCommand } from '#cli/commands/print-result.ts';
import { MISE_CONFIG_PATH } from '#cli/config/tools/tools.ts';
import { hookLocation } from '#cli/repository/hook-location.ts';
import type { Session } from '#cli/types/execution/execution.ts';
import { assertPinMatches } from '#cli/lifecycle/version-pin.ts';
import { pythonInstallSteps } from '#cli/tools/python-project.ts';
import { packageInstallSteps } from '#cli/tools/packages/project.ts';
import { toolEnvironment } from '#cli/generation/tools/environment.ts';
import type { InstallJson, CommandResult, InstallOptions } from '#cli/types/commands.ts';

function preparation(session: Session): { steps: string[][]; failures: string[]; hooks: string | undefined } {
    const failures: string[] = [];
    const projects = [
        { selected: session.packageClient !== undefined, preview: packageInstallSteps },
        { selected: toolEnvironment(everyManifest(session.scopes)).length > 0, preview: pythonInstallSteps },
    ];
    const steps = projects
        .filter((entry) => entry.selected)
        .flatMap((project) => {
            try {
                const commands = project.preview(session.root);
                if (commands.length === 0) throw new Error('Run: gspot apply, then gspot install');
                return commands;
            } catch (error) {
                failures.push(error instanceof Error ? error.message : 'Tool installation inputs are invalid.');
                return [];
            }
        });
    const runner = session.policyFiles.policy.runner?.tool;
    if (runner === 'mise') steps.unshift(['mise', 'trust', MISE_CONFIG_PATH], ['mise', 'install']);
    const hooks =
        session.repository.hasGit &&
        ['gspot', 'simple-git-hooks', 'pre-commit'].includes(session.policyFiles.policy.hooks?.tool ?? '')
            ? hookLocation(session.root).absolute
            : undefined;
    return { steps, failures, hooks };
}

function previewInstallation(steps: string[][], failures: string[], hooks: string | undefined): CommandResult {
    if (failures.length > 0) throw new Error([...new Set(failures)].join('\n'));
    const lines = [
        ...steps.map((step) => step.join(' ')),
        ...(hooks === undefined
            ? []
            : [`install hook dispatchers in ${hooks}; retain original executables as siblings`]),
    ];
    return {
        text: lines.length === 0 ? 'No managed tools or hooks to install.\n' : `${lines.join('\n')}\n`,
        json: { isDryRun: true, steps, ...compact({ hooks }) } satisfies InstallJson,
        exitCode: 0,
    };
}

/**
 * Register immutable installation for a clone.
 * @param program the command-line program
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

/**
 * Preview or install this clone's locked tools without regenerating tracked configuration.
 * @param options the working directory and whether this is a dry run
 * @returns the text to print and the exit code
 */
export async function installCommand(options: InstallOptions): Promise<CommandResult> {
    const root = findRoot(options.cwd);
    assertPinMatches(root);
    const session = await openSession(root);
    try {
        const { steps, failures, hooks } = preparation(session);
        if (options.isDryRun) return previewInstallation(steps, failures, hooks);
        const note = await installTools(session, true).catch((error: unknown) => {
            failures.push(error instanceof Error ? error.message : 'Tool installation failed.');
            return '';
        });
        if (failures.length > 0) throw new Error([note, ...new Set(failures)].filter(Boolean).join('\n'));
        return {
            text: `${note === '' ? 'No managed tools to install.' : note}\n`,
            json: { installed: true, steps } satisfies InstallJson,
            exitCode: 0,
        };
    } catch (error) {
        const text = error instanceof Error ? error.message : 'Tool installation failed.';
        return { text: `${text}\n`, json: { installed: false, error: text } satisfies InstallJson, exitCode: 2 };
    }
}
