import { compact } from '#cli/platform/text.ts';
import { everyManifest } from '#cli/kits/select.ts';
import { findRoot } from '#cli/repository/tracked.ts';
import { openSession } from '#cli/execution/session.ts';
import type { Session } from '#cli/types/tools/tools.ts';
import { installProsePackages } from '#cli/tools/vale.ts';
import { pythonInstallSteps } from '#cli/tools/python.ts';
import { printCommand } from '#cli/commands/print-result.ts';
import { installTools } from '#cli/commands/install/steps.ts';
import { assertPinMatches } from '#cli/lifecycle/version-pin.ts';
import { packageInstallSteps } from '#cli/tools/packages/project.ts';
import { toolEnvironment } from '#cli/generation/tools/environment.ts';
import type { Program, CommandResult } from '#cli/types/commands/commands.ts';
import type { InstallJson, InstallOptions } from '#cli/types/commands/install.ts';
import { HOOKS_DIRECTORY, MISE_CONFIG_PATH } from '#cli/config/generation/generation.ts';

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
    const runner = session.policyFiles.policy.runner;
    if (runner === 'mise') steps.unshift(['mise', 'trust', MISE_CONFIG_PATH], ['mise', 'install']);
    const hooks =
        session.repository.hasGit && session.policyFiles.policy.hooks !== undefined ? HOOKS_DIRECTORY : undefined;
    return { steps, failures, hooks };
}

function previewInstallation(steps: string[][], failures: string[], hooks: string | undefined): CommandResult {
    if (failures.length > 0) throw new Error([...new Set(failures)].join('\n'));
    const lines = [
        ...steps.map((step) => step.join(' ')),
        ...(hooks === undefined
            ? []
            : [`git config core.hooksPath ${hooks}, unless the repository already runs other hooks`]),
    ];
    return {
        text: lines.length === 0 ? 'No managed tools or hooks to install.\n' : `${lines.join('\n')}\n`,
        json: { dryRun: true, steps, ...compact({ hooks }) } satisfies InstallJson,
        exitCode: 0,
    };
}

// The locked tools, then the Vale packages: they are not tracked, so a fresh clone gets them here as well as from apply.
async function installEverything(session: Session, failures: string[]): Promise<string> {
    const note = await installTools(session, true).catch((error: unknown) => {
        failures.push(error instanceof Error ? error.message : 'Tool installation failed.');
        return '';
    });
    if (failures.length > 0) return note;
    const installed = await installProsePackages(session);
    if (installed?.problem !== undefined) failures.push(`The Vale packages did not install: ${installed.problem}.`);
    return note;
}

/**
 * Register immutable installation for a clone.
 * @param program the command-line program
 */
export function registerInstall(program: Program): void {
    program
        .command('install')
        .summary('Install the locked tools')
        .description(
            'Install the tools gspot.toml selects, at the versions in the committed locks, and the selected Git hooks. install changes no tracked file. Run it after you clone a configured repository. If a package install fails, the previous installation stays. --dry-run prints the commands and writes nothing.',
        )
        .addHelpText(
            'after',
            '\nExit codes:\n- 0: the tools were installed, or the preview finished.\n- 2: the input was invalid, or install could not finish.\n\nExample:\ngspot install --dry-run',
        )
        .option('--dry-run', 'Print the install commands and write nothing')
        .action(async (flags, command) => {
            const global = command.optsWithGlobals();
            await printCommand((cwd) => installCommand({ cwd, isDryRun: flags.dryRun === true }), global);
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
        const note = await installEverything(session, failures);
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
