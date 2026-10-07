import { resolve } from 'node:path';
import { compact } from '#cli/platform/objects.ts';
import { findRoot } from '#cli/repository/root.ts';
import { printResult } from '#cli/output/messages.ts';
import { openSession } from '#cli/commands/session.ts';
import type { CommandResult } from '#cli/types/output.ts';
import type { Program } from '#cli/types/commands/program.ts';
import { openOwnership } from '#cli/lifecycle/ownership/log.ts';
import { assertVersionPin } from '#cli/lifecycle/version-pin.ts';
import { installTools, installationPlan } from '#cli/lifecycle/install.ts';
import type { InstallJson, InstallOptions } from '#cli/types/commands/install.ts';

/**
 * Registers tool and hook installation.
 * @param program the command-line program
 */
export function registerInstall(program: Program): void {
    program
        .command('install')
        .summary('Install the locked tools')
        .description(
            'Install the tools gspot.toml selects, at the versions in the committed locks, and the selected Git hooks. install prepares missing or stale tool locks before installing. Run it after you clone a configured repository. If a package install fails, the previous locks and installation stay. --refresh-locks resolves the declared pins again before installation. --dry-run prints the commands and writes nothing.',
        )
        .addHelpText(
            'after',
            '\nExit codes:\n- 0: the tools were installed, or the preview finished.\n- 2: the input was invalid, or install could not finish.\n\nExample:\ngspot install --dry-run',
        )
        .option('--dry-run', 'Print the install commands and write nothing')
        .option('--refresh-locks', 'Resolve the declared tool pins again and install the prepared locks')
        .action(async (flags, command) => {
            const global = command.optsWithGlobals();
            const cwd = resolve(global.C ?? process.cwd());
            printResult(
                await installCommand({
                    cwd,
                    isDryRun: flags.dryRun === true,
                    refreshLocks: flags.refreshLocks === true,
                }),
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
    assertVersionPin(root);
    const session = await openSession(root);
    const { steps, notes } = installationPlan(session, options.refreshLocks === true);
    if (options.isDryRun) {
        const lines = [...steps.map((step) => step.join(' ')), ...notes];
        const hooks = steps.find((step) => step[0] === 'git' && step[2] === 'core.hooksPath')?.[3];
        return {
            text: lines.length === 0 ? 'No managed tools or hooks to install.\n' : `${lines.join('\n')}\n`,
            json: { dryRun: true, steps, notes, ...compact({ hooks }) } satisfies InstallJson,
            exitCode: 0,
        };
    }
    using log = openOwnership(root);
    const { note, exitCode } = await installTools(session, log, { refreshLocks: options.refreshLocks === true });
    return {
        text: `${note === '' ? 'No managed tools to install.' : note}\n`,
        json:
            exitCode === 0
                ? ({ installed: true, steps } satisfies InstallJson)
                : ({ installed: false, error: 'installation', message: note } satisfies InstallJson),
        exitCode,
    };
}
