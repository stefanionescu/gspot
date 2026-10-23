import { openSession } from '#cli/session.ts';
import { openWriter } from '#cli/apply/writer.ts';
import { findRoot } from '#cli/repository/read.ts';
import { GspotError } from '#cli/system/errors.ts';
import { installTools } from '#cli/install/tools.ts';
import { generate } from '#cli/generation/generate.ts';
import { type Command } from '@commander-js/extra-typings';
import { COMMAND_HELP } from '#cli/config/commands/help.ts';
import { runCancelableCommand } from '#cli/system/terminal.ts';
import { listOutdatedFiles } from '#cli/apply/outdated-files.ts';
import { TOOL_PROJECT_FILES } from '#cli/config/commands/install.ts';
import type { InstallCommandJson } from '#cli/types/commands/install.ts';
import { type CommandResult, type CommandCompletion } from '#cli/types/terminal.ts';

/**
 * Install the tools, and set the Git hooks as the settings ask.
 *
 * @param cwd the folder where the command starts.
 * @param cancelSignal stops the install processes.
 * @returns the install result.
 */
async function runInstallCommand(cwd: string, cancelSignal: AbortSignal): Promise<CommandResult<InstallCommandJson>> {
    const root = findRoot(cwd);
    const session = await openSession(root, { cancelSignal });
    const generated = generate(session);
    // The tools install from the tool projects on disk, so those must match the settings first.
    if (listOutdatedFiles(session, generated).some((file) => TOOL_PROJECT_FILES.has(file.path)))
        throw new GspotError('install', 'The tool projects in .gspot do not match gspot.toml. Run gspot apply first.');
    using writer = openWriter(root);
    const { note, steps } = await installTools(session, writer, generated);
    return {
        text: `${note === '' ? 'No change: every tool is installed.' : note}\n`,
        json: { steps },
        exitCode: 0,
    };
}

/**
 * Register the install command.
 *
 * @param program the gspot program that gets the command.
 * @param onResult receives the result of the command.
 */
export function registerInstall(program: Command, onResult: CommandCompletion): void {
    program
        .command('install')
        .summary(COMMAND_HELP.install.summary)
        .description(COMMAND_HELP.install.description)
        .action(async () => {
            onResult(
                await runCancelableCommand(
                    (cancelSignal) => runInstallCommand(process.cwd(), cancelSignal),
                    'Installation stopped before every tool was installed.',
                ),
            );
        });
}
