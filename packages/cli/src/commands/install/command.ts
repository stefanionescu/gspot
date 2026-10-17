import { openSession } from '#cli/session.ts';
import { findRoot } from '#cli/repository/read.ts';
import { GspotError } from '#cli/system/errors.ts';
import { openWriter } from '#cli/ownership/writer.ts';
import { generate } from '#cli/generation/generate.ts';
import { type Command } from '@commander-js/extra-typings';
import { COMMAND_HELP } from '#cli/config/commands/help.ts';
import { installTools } from '#cli/commands/install/tools.ts';
import { runCancelableCommand } from '#cli/system/terminal.ts';
import type { InstallCommandJson } from '#cli/types/install.ts';
import { type CommandResult, type CommandCompletion } from '#cli/types/terminal.ts';

/**
 * Install the selected tools and set the Git hooks as the settings require.
 * @param cwd the directory the command starts in
 * @param cancelSignal the cancellation signal shared with installation processes.
 * @returns the installation result
 */
async function runInstallCommand(cwd: string, cancelSignal?: AbortSignal): Promise<CommandResult<InstallCommandJson>> {
    const root = findRoot(cwd);
    const session = await openSession(root);
    const generated = generate(session);
    using writer = openWriter(root);
    const { note, exitCode, steps } = await installTools(session, writer, generated, cancelSignal);
    if (exitCode !== 0) throw new GspotError('installation', note);
    return {
        text: `${note === '' ? 'No change: every tool is installed.' : note}\n`,
        json: { installed: true, steps },
        exitCode,
    };
}

/**
 * Register tool installation.
 * @param program the command program
 * @param onResult the sink that writes the completed command result.
 */
export function registerInstall(program: Command, onResult: CommandCompletion): void {
    program
        .command('install')
        .summary(COMMAND_HELP.install.summary)
        .description(COMMAND_HELP.install.description)
        .action(async () => {
            onResult(
                await runCancelableCommand(
                    (signal) => runInstallCommand(process.cwd(), signal),
                    'Installation stopped before every tool was installed.',
                ),
            );
        });
}
