import { emitAll } from '#cli/generation/files.ts';
import { readSettings } from '#cli/settings/read.ts';
import { printResult } from '#cli/terminal/print.ts';
import { openSession } from '#cli/commands/session.ts';
import { installTools } from '#cli/install/install.ts';
import { findRoot } from '#cli/repository/find-root.ts';
import { openOwnershipLog } from '#cli/ownership/log.ts';
import { type Command } from '@commander-js/extra-typings';
import { COMMAND_HELP } from '#cli/config/commands/help.ts';
import { type CommandResult } from '#cli/types/terminal.ts';
import { assertVersionPin } from '#cli/apply/version-pin.ts';

/**
 * Install the selected tools and set the Git hooks as the settings require.
 * @param cwd the directory the command starts in
 * @returns the installation result
 */
export async function installCommand(cwd: string): Promise<CommandResult> {
    const root = findRoot(cwd);
    await assertVersionPin(root);
    const session = await openSession(root, readSettings(root));
    const generated = emitAll(session);
    using log = openOwnershipLog(root);
    const { note, exitCode, steps } = await installTools(session, log, generated);
    return {
        text: `${note === '' ? 'Nothing to install.' : note}\n`,
        json: exitCode === 0 ? { installed: true, steps } : { error: 'installation', message: note, steps },
        exitCode,
    };
}

/**
 * Register tool installation.
 * @param program the command program
 */
export function registerInstall(program: Command): void {
    program
        .command('install')
        .summary(COMMAND_HELP.install.summary)
        .description(COMMAND_HELP.install.description)
        .action(async () => {
            printResult(await installCommand(process.cwd()));
        });
}
